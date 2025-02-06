import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:OpenAIReader');

export default class OpenAIReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    const data = JSON.parse(chunk);
    if (data.error) {
      throw new Error(data.error.message);
    }
    const choice = data.choices[0];
    return {
      content: choice.delta.content || '',
      isEnd: false,
      toolCalls: choice.delta.tool_calls,
    };
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      return {
        id: respMsg.toolCalls[0].id,
        name: respMsg.toolCalls[0].function.name,
      };
    }
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    try {
      if (respMsg.isEnd || !respMsg.toolCalls) {
        return null;
      }
      const toolCalls = respMsg.toolCalls[0];
      return {
        index: toolCalls.index,
        args: toolCalls.function.arguments,
      };
    } catch (err) {
      console.error('parseToolArgs', err);
    }
    return null;
  }
}
