import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatMessage,
  IAnthropicTool,
  IOpenAITool,
  IMCPTool,
  IGoogleTool,
} from 'intellichat/types';
import Ollama from '../../providers/Ollama';
import { isBlank } from 'utils/validators';
import { stripHtmlTags } from 'utils/util';
import NextChatService from './NextChatService';
import INextChatService from './INextCharService';
import OllamaReader from 'intellichat/readers/OllamaChatReader';
import { ITool } from 'intellichat/readers/IChatReader';

const debug = Debug('5ire:intellichat:OllamaChatService');

export default class OllamaChatService
  extends NextChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super({
      context,
      provider: Ollama,
    });
  }

  protected getReaderType() {
    return OllamaReader;
  }

  protected async convertPromptContent(
    content: string
  ): Promise<string> {
    return stripHtmlTags(content);
  }

  protected async makeMessages(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestMessage[]> {
    const result = [];
    const systemMessage = this.context.getSystemMessage();
    if (!isBlank(systemMessage)) {
      result.push({
        role: 'system',
        content: systemMessage,
      });
    }
    this.context.getCtxMessages().forEach((msg: IChatMessage) => {
      result.push({
        role: 'user',
        content: msg.prompt,
      });
      result.push({
        role: 'assistant',
        content: msg.reply,
      });
    });
    for (const msg of messages) {
      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: JSON.stringify(msg.content),
          name: msg.name,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        result.push(msg);
      } else {
        const content = msg.content;
        if (typeof content === 'string') {
          result.push({
            role: msg.role,
            content: await this.convertPromptContent(content),
          });
        } else {
          result.push({
            role: msg.role,
            content,
          });
        }
      }
    }
    return result as IChatRequestMessage[];
  }

  protected makeTool(
    tool: IMCPTool
  ): IOpenAITool | IAnthropicTool | IGoogleTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description.substring(0, 1000),
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
          additionalProperties: tool.inputSchema.additionalProperties,
        },
      },
    };
  }

  protected makeToolMessages(
    tool: ITool,
    toolResult: any
  ): IChatRequestMessage[] {
    return [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: tool.id,
            type: 'function',
            function: {
              arguments: JSON.stringify(tool.args),
              name: tool.name,
            },
          },
        ],
      },
      {
        role: 'tool',
        name: tool.name,
        content: toolResult.content,
        tool_call_id: tool.id,
      },
    ];
  }

  protected async makePayload(
    message: IChatRequestMessage[]
  ): Promise<IChatRequestPayload> {
    const model = this.context.getModel();
    const payload: IChatRequestPayload = {
      model: this.getModelName(),
      messages: await this.makeMessages(message),
      temperature: this.context.getTemperature(),
      stream: false,
    };
    if (model.toolEnabled) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const _tools = tools
          .filter((tool: any) => !this.usedToolNames.includes(tool.name))
          .map((tool: any) => {
            console.log(tool);
            return this.makeTool(tool);
          });
        if (_tools.length > 0) {
          payload.tools = _tools;
          payload.tool_choice = 'auto';
          payload.parallel_tool_calls = false;
        }
      }
    }
    if (this.context.getMaxTokens()) {
      payload.max_tokens = this.context.getMaxTokens();
    }
    return payload;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('Send Request, payload:\r\n', payload);
    console.log('Send Request, payload:\r\n', payload);
    const { base } = this.apiSettings;
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    console.log('Response:\r\n', response);
    return response;
  }
}
