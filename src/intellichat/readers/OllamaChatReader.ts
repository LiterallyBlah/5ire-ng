import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:OllamaReader');

export default class OllamaReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    // console.log('Raw chunk:', chunk);
    let data;
    try {
      data = JSON.parse(chunk);
    } catch (e) {
      // console.error('Failed to parse JSON:', e);
      // console.log('Invalid chunk:', chunk);
      return {
        content: '',
        isEnd: false
      };
    }
    
    // console.log('Parsed data:', data);
    if (data.done) {
      // console.log('Response (done):\r\n', data);
      let toolCalls;
      if (data.message?.tool_calls) {
        // console.log('Tool calls from message:', data.message.tool_calls);
        toolCalls = data.message.tool_calls.map((call: any, index: number) => {
          const args = call.function.arguments;
          // Handle both string and object arguments
          let parsedArgs = args;
          if (typeof args === 'string') {
            try {
              parsedArgs = JSON.parse(args);
            } catch (e) {
              debug('Failed to parse arguments as JSON:', e);
              debug('Using original string args:', args);
            }
          }
          // console.log('Raw args from function:', args);
          // console.log('Stringified args:', JSON.stringify(args))
          // console.log('Constructing tool call:', {
          //   id: `${Date.now()}-${index}`,
          //   type: 'function',
          //   function: {
          //     name: call.function.name,
          //     arguments: args
          //   }
          // });
          return {
            id: `${Date.now()}-${index}`,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: parsedArgs
            }
          };
        });
      } else if (data.message?.function) {
        // console.log('Function from message:', data.message.function);
        const args = data.message.function.arguments;
        // console.log('Raw args from function:', args);
        
        toolCalls = [{
          id: Date.now().toString(),
          type: 'function',
          function: {
            name: data.message.function.name,
            arguments: args
          }
        }];
      }
      
      return {
        content: data.message?.content || '',
        isEnd: true,
        inputTokens: data.prompt_eval_count,
        outputTokens: data.eval_count,
        toolCalls
      };
    }
    
    return {
      content: data.message?.content || '',
      isEnd: false
    };
  }

  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls && respMsg.toolCalls.length > 0) {
      const toolCall = respMsg.toolCalls[0];
      // console.log('Parsing tool call in parseTools:', JSON.stringify(toolCall, null, 2));
      
      let args = toolCall.function?.arguments;
      // console.log('Raw args in parseTools:', JSON.stringify(args, null, 2));
      
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
          // console.log('Parsed string args into:', JSON.stringify(args, null, 2));
        } catch (e) {
          // console.error('Failed to parse arguments as JSON:', e);
          // console.log('Keeping original string args:', args);
        }
      }
      
      const processedArgs = (typeof args === 'object' && args !== null) ? args : {};
      
      const result: ITool = {
        id: toolCall.id || '',
        name: toolCall.function?.name || '',
        args: processedArgs
      };
      
      // console.log('Final ITool object:', JSON.stringify(result, null, 2));
      
      if (!result.args || Object.keys(result.args).length === 0) {
        // console.warn('Warning: Tool args are empty after processing');
      }
      
      return result;
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
    const args = toolCall.function?.arguments;
    
    // Convert object arguments to string if necessary
    const stringArgs = typeof args === 'object' ? JSON.stringify(args) : args || '';
    
    return {
      index: 0,
      args: stringArgs,
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
