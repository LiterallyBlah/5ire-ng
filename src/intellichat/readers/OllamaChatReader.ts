import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:OllamaReader');

export default class OllamaReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    const data = JSON.parse(chunk);
    if (data.done) {
      console.log('Response:\r\n', data);
      return {
        content: data.message.content,
        isEnd: true,
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
      };
    }
    console.log('Response:\r\n', data);
    return {
      content: data.message.content,
      isEnd: false,
      toolCalls: data.tool_calls,
    };
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      const toolCall = respMsg.toolCalls[0];
      return {
        id: toolCall.id || '',
        name: toolCall.function?.name || '',
        args: toolCall.function?.arguments || '',
      };
    }
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    const toolCall = respMsg.toolCalls[0];
    return {
      index: 0,
      args: toolCall.function?.arguments || '',
    };
  }

  protected processChunk(chunk: string): IChatResponseMessage | null {
    if (!chunk || chunk.trim() === '') {
      return null;
    }
    try {
      return this.parseReply(chunk);
    } catch (error) {
      debug('Failed to process chunk:', error);
      return null;
    }
  }
}
