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
    // console.log('Processing messages:', messages);
    for (const msg of messages) {
      // console.log('Processing message:', msg);
      if (msg.role === 'tool') {
        result.push({
          role: 'tool',
          content: JSON.stringify(msg.content),
          name: msg.name,
          tool_call_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant') {
        // Convert OpenAI tool_calls format to Ollama function format
        // console.log('Processing assistant:', msg);
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          result.push({
            role: 'assistant',
            content: msg.content || '',
            function: {
              name: msg.tool_calls[0].function.name,
              arguments: msg.tool_calls[0].function.arguments
            }
          });
        } else {
          result.push({
            role: 'assistant',
            content: msg.content || '',
          });
        }
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
    // console.log('Final messages:', result);
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
    // Log the incoming tool object
    // console.log('Making tool messages for tool:', JSON.stringify(tool, null, 2));
    
    // Validate that tool has required properties
    if (!tool || typeof tool !== 'object') {
      throw new Error('Tool must be a valid object');
    }
    
    // Create a deep copy of the entire tool to prevent mutations
    const processedTool = structuredClone(tool);
    
    // Ensure args exists and is an object
    if (!processedTool.args || typeof processedTool.args !== 'object') {
      console.error('Invalid args format:', processedTool.args);
      throw new Error('Tool args must be an object');
    }
    
    // console.log('Processed tool:', JSON.stringify(processedTool, null, 2));
    
    // Additional validation to ensure args weren't lost
    if (Object.keys(processedTool.args).length === 0 && Object.keys(tool.args || {}).length > 0) {
      console.error('Args were lost during processing:', {
        original: tool.args,
        processed: processedTool.args
      });
      throw new Error('Tool args were lost during processing');
    }
    
    // Log the tool result
    // console.log('Tool result:', JSON.stringify(toolResult, null, 2));
    
    return [
      {
        role: 'assistant',
        content: '',  // Empty content when there's a tool call
        tool_calls: [
          {
            id: processedTool.id,
            type: 'function',
            function: {
              name: processedTool.name,
              arguments: processedTool.args
            },
          },
        ],
      },
      {
        role: 'tool',
        name: processedTool.name,
        content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content),
        tool_call_id: processedTool.id,
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
            // console.log(tool);
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
    // console.log('Send Request, payload:\r\n', payload);
    const { base } = this.apiSettings;
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    // console.log('Response:\r\n', response);
    return response;
  }
}
