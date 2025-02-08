import * as logging from './logging';
import path from 'path';
import fs from 'node:fs';
import { app } from 'electron';
export interface IClientConfig {
  key: string;
  command: 'npx' | 'uvx';
  args: string[];
  env?: Record<string, string>;
}

export const DEFAULT_INHERITED_ENV_VARS =
  process.platform === 'win32'
    ? [
        'APPDATA',
        'HOMEDRIVE',
        'HOMEPATH',
        'LOCALAPPDATA',
        'PATH',
        'PROCESSOR_ARCHITECTURE',
        'SYSTEMDRIVE',
        'SYSTEMROOT',
        'TEMP',
        'USERNAME',
        'USERPROFILE',
      ]
    : /* list inspired by the default env inheritance of sudo */
      ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
/**
 * Returns a default environment object including only environment variables deemed safe to inherit.
 */
export function getDefaultEnvironment() {
  const env: Record<string, string> = {};
  for (const key of DEFAULT_INHERITED_ENV_VARS) {
    const value = process.env[key];
    if (value === undefined) {
      continue;
    }
    if (value.startsWith('()')) {
      // Skip functions, which are a security risk.
      continue;
    }
    env[key] = value;
  }
  return env;
}

export default class ModuleContext {
  private clients: { [key: string]: any } = {};
  private Client: any;
  private Transport: any;
  private cfgPath: string;
  constructor() {
    this.cfgPath = path.join(app.getPath('userData'), 'mcp.json');
  }

  public async init() {
    this.Client = await this.importClient();
    this.Transport = await this.importTransport();
  }

  private async importClient() {
    const { Client } = await import(
      '@modelcontextprotocol/sdk/client/index.js'
    );
    return Client;
  }

  private async importTransport() {
    const { StdioClientTransport } = await import(
      '@modelcontextprotocol/sdk/client/stdio.js'
    );
    return StdioClientTransport;
  }

  public async getConfig() {
    const defaultConfig = { servers: [] };
    try {
      if (!fs.existsSync(this.cfgPath)) {
        fs.writeFileSync(this.cfgPath, JSON.stringify(defaultConfig, null, 2));
      }
      const config = JSON.parse(fs.readFileSync(this.cfgPath, 'utf-8'));
      return config;
    } catch (err: any) {
      logging.captureException(err);
      return defaultConfig;
    }
  }

  public async putConfig(config: any) {
    try {
      fs.writeFileSync(this.cfgPath, JSON.stringify(config, null, 2));
      return true;
    } catch (err: any) {
      logging.captureException(err);
      return false;
    }
  }

  public async load() {
    const { servers } = await this.getConfig();
    for (const server of servers) {
      logging.debug('Activating server:', server.key);
      const { error } = await this.activate(server);
      if (error) {
        logging.error('Failed to activate server:', server.key, error);
      }
    }
  }

  public async activate(config: IClientConfig): Promise<{ error: any }> {
    try {
      const { key, command, args = [], env = {} } = config;
      if (this.clients[key]) {
        return { error: new Error('Client already exists') };
      }
      await this.importClient();
      await this.importTransport();

      const mergedEnv = {
        ...getDefaultEnvironment(),
        ...env,
      };

      // Prepare spawn configuration
      const spawnConfig = {
        command,
        args,
        stderr: process.platform === 'win32' ? 'pipe' : 'inherit',
        env: mergedEnv,
        shell: process.platform === 'win32' ? true : false // Use shell on Windows to handle command extensions
      };

      const client = new this.Client(
        {
          name: key,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );
      const transport = new this.Transport(spawnConfig);
      await client.connect(transport);
      this.clients[key] = client;
      return { error: null };
    } catch (err: any) {
      logging.captureException(err);
      return { error: err };
    }
  }

  public async deactivate(key: string) {
    try {
      if (this.clients[key]) {
        await this.clients[key].close();
        delete this.clients[key];
      }
      return true;
    } catch (err: any) {
      logging.captureException(err);
      return false;
    }
  }

  public async close() {
    for (const key in this.clients) {
      logging.info(`Closing MCP Client ${key}`);
      await this.clients[key].close();
      delete this.clients[key];
    }
  }

  public async listTools(key?: string) {
    let allTools: any = [];
    if (key) {
      if (!this.clients[key]) {
        throw new Error(`MCP Client ${key} not found`);
      }
      const { tools } = await this.clients[key].listTools();
      allTools = tools.map((tool: any) => {
        tool.name = `${key}--${tool.name}`;
        return tool;
      });
    } else {
      for (const key in this.clients) {
        const { tools } = await this.clients[key].listTools();
        allTools = allTools.concat(
          tools.map((tool: any) => {
            tool.name = `${key}--${tool.name}`;
            return tool;
          })
        );
      }
    }
    // logging.debug('All Tools:', JSON.stringify(allTools, null, 2));
    return allTools;
  }

  public async callTool({
    client,
    name,
    args,
  }: {
    client: string;
    name: string;
    args: any;
  }) {
    if (!this.clients[client]) {
      throw new Error(`MCP Client ${client} not found`);
    }
    logging.debug('Calling:', client, name, args);
    const result = await this.clients[client].callTool({
      name,
      arguments: args,
    });
    return result;
  }

  public getClient(name: string) {
    return this.clients[name];
  }

  public getClientNames() {
    return Object.keys(this.clients);
  }
}
