import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import BaseReader from './BaseReader';
import IChatReader, { ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:OllamaReader');

export default class OllamaReader extends BaseReader implements IChatReader {
  protected parseReply(chunk: string): IChatResponseMessage {
    console.log('Raw chunk:', chunk);
    let data;
    try {
      data = JSON.parse(chunk);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      console.log('Invalid chunk:', chunk);
      return {
        content: '',
        isEnd: false
      };
    }
    
    console.log('Parsed data:', data);
    if (data.done) {
      console.log('Response (done):\r\n', data);
      // Handle tool calls in the final response
      let toolCalls;
      if (data.message?.tool_calls) {
        console.log('Tool calls from message:', data.message.tool_calls);
        toolCalls = data.message.tool_calls.map((call: any, index: number) => {
          // Extract the actual arguments from the function call
          const args = call.function.arguments;
          console.log('Raw args from function:', args);

          console.log('Stringified args:', JSON.stringify(args))
          
          console.log('Constructing tool call:', {
            id: `${Date.now()}-${index}`,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: args
            }
          });
          return {
            id: `${Date.now()}-${index}`,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: args
            }
          };
        });
      } else if (data.message?.function) {
        // Handle legacy function format
        console.log('Function from message:', data.message.function);
        const args = data.message.function.arguments;
        console.log('Raw args from function:', args);
        
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
      console.log('Parsing tool call in parseTools:', JSON.stringify(toolCall, null, 2));
      
      // Extract arguments and parse them if they're a string
      let args = toolCall.function?.arguments;
      console.log('Raw args in parseTools:', JSON.stringify(args, null, 2));
      
      // If args is a string, try to parse it as JSON
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
          console.log('Parsed string args into:', JSON.stringify(args, null, 2));
        } catch (e) {
          console.error('Failed to parse arguments as JSON:', e);
          // If parsing fails, keep the original string
          console.log('Keeping original string args:', args);
        }
      }
      
      // Ensure args is a non-null object
      const processedArgs = (typeof args === 'object' && args !== null) ? args : {};
      
      // Create the tool result with guaranteed non-null args
      const result: ITool = {
        id: toolCall.id || '',
        name: toolCall.function?.name || '',
        args: processedArgs
      };
      
      // Log the final result with stringification to capture the exact state
      console.log('Final ITool object:', JSON.stringify(result, null, 2));
      
      // Additional validation to ensure args weren't lost
      if (!result.args || Object.keys(result.args).length === 0) {
        console.warn('Warning: Tool args are empty after processing');
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
      console.log('No tool args to parse');
      return null;
    }
    const toolCall = respMsg.toolCalls[0];
    console.log('Parsing tool args in parseToolArgs:', toolCall);
    console.log('Tool args:', toolCall.function?.arguments);
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
