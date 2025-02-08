import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatMessage,
  IChatRequestMessageContent,
  IAnthropicTool,
  IOpenAITool,
  IMCPTool,
  IGoogleTool,
} from 'intellichat/types';
import OpenAI from '../../providers/OpenAI';
import { isBlank } from 'utils/validators';
import { splitByImg, stripHtmlTags } from 'utils/util';
import NextChatService from './NextChatService';
import INextChatService from './INextCharService';
import OpenAIReader from 'intellichat/readers/OpenAIReader';
import { ITool } from 'intellichat/readers/IChatReader';

const debug = Debug('5ire:intellichat:OpenAIChatService');

export default class OpenAIChatService
  extends NextChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super({
      context,
      provider: OpenAI,
    });
  }

  protected getReaderType() {
    return OpenAIReader;
  }

  protected async convertPromptContent(
    content: string
  ): Promise<string | IChatRequestMessageContent[]> {
    if (this.context.getModel().vision?.enabled) {
      const items = splitByImg(content);
      const result: IChatRequestMessageContent[] = [];
      items.forEach((item: any) => {
        if (item.type === 'image') {
          result.push({
            type: 'image_url',
            image_url: {
              url: item.data,
            },
          });
        } else if (item.type === 'text') {
          result.push({
            type: 'text',
            text: item.data,
          });
        } else {
          console.error('Unknown message type', item);
          throw new Error('Unknown message type');
        }
      });
      return result;
    }
    return stripHtmlTags(content);
  }

  protected async makeMessages(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestMessage[]> {
    const result = [];
    const systemMessage = this.context.getSystemMessage();
    let sysRole = 'system';
    if (['o1', 'o3'].some((prefix) => this.getModelName().startsWith(prefix))) {
      sysRole = 'developer';
    }
    if (!isBlank(systemMessage)) {
      result.push({
        role: sysRole,
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
            role: 'user',
            content: await this.convertPromptContent(content),
          });
        } else {
          result.push({
            role: 'user',
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
        description: tool.description.substring(0, 1000), // some models have a limit on the description length, like gpt series, so we truncate it
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
    console.log('Making tool messages for tool:', JSON.stringify(tool, null, 2));
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
      stream: true,
    };
    if (model.toolEnabled) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const _tools = tools
          .filter((tool: any) => !this.usedToolNames.includes(tool.name))
          .map((tool: any) => {
            return this.makeTool(tool);
          });
        if (_tools.length > 0) {
          payload.tools = _tools;
          payload.tool_choice = 'auto';
        }
      }
    }
    if (this.context.getMaxTokens()) {
      /**
       * max_tokens is deprecated, use max_completion_tokens instead for new models
       */
      if (model.name.startsWith('o1') || model.name.startsWith('o3')) {
        payload.max_completion_tokens = this.context.getMaxTokens();
        payload.temperature = 1; // o1 and o3 models require temperature to be 1
      } else {
        payload.max_tokens = this.context.getMaxTokens();
      }
    }
    return payload;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('About to make a request, payload:\r\n', payload);
    const { base, key } = this.apiSettings;
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    return response;
  }
}
