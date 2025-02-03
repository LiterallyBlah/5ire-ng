import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:OpenAIReader');

export default class OpenAIReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    // console.log('Parsing reply:', chunk);
    const choice = JSON.parse(chunk).choices[0];
    const result = {
      content: choice.delta.content || '',
      isEnd: false,
      toolCalls: choice.delta.tool_calls,
    };
    return result;
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    // console.log('Parsing tools:', respMsg);
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      const tool = {
        id: respMsg.toolCalls[0].id,
        name: respMsg.toolCalls[0].function.name,
      };
      // console.log('Parsed tool:', tool);
      return tool;
    }
    // console.log('No tools found');
    return null;
  }

  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    // console.log('Parsing tool args:', respMsg);
    try {
      if (respMsg.isEnd || !respMsg.toolCalls) {
        console.log('No tool args to parse');
        return null;
      }
      const toolCalls = respMsg.toolCalls[0];
      const result = {
        index: toolCalls.index,
        args: toolCalls.function.arguments,
      };
      console.log('Parsed tool args:', result);
      return result;
    } catch (err) {
      console.error('Error parsing tool args:', err);
    }
    return null;
  }
}
