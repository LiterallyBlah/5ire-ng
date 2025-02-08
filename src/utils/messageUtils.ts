import { IChatMessage } from 'intellichat/types';

interface MessageWithTools extends IChatMessage {
  toolInteractions?: {
    call: IChatMessage;
    response: IChatMessage;
  }[];
}

export const isToolMessage = (message: IChatMessage): boolean => {
  // Check explicit tool flag
  if (message.isTool) return true;

  // Check for tool-related properties
  if (message.toolCall || message.toolResponse) return true;

  // Check prompt prefixes
  if (message.prompt.startsWith('Tool Call:') || 
      message.prompt.startsWith('Tool Response:')) return true;

  return false;
};

export const filterToolMessages = (messages: IChatMessage[]): IChatMessage[] => {
  return messages.filter(msg => !isToolMessage(msg));
};

export const groupMessageWithTools = (messages: IChatMessage[]): MessageWithTools[] => {
  const result: MessageWithTools[] = [];
  let currentMessage: MessageWithTools | null = null;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    
    // If this is a tool message, try to pair it with its response
    if (message.prompt.startsWith('Tool Call:')) {
      // Look for corresponding tool response
      const response = messages[i + 1];
      if (response?.prompt.startsWith('Tool Response:')) {
        // Add to previous message's tool interactions
        if (currentMessage) {
          if (!currentMessage.toolInteractions) {
            currentMessage.toolInteractions = [];
          }
          currentMessage.toolInteractions.push({
            call: message,
            response: response
          });
        }
        i++; // Skip the response message since we've handled it
        continue;
      }
    }
    
    // Regular message
    if (!isToolMessage(message)) {
      if (currentMessage) {
        result.push(currentMessage);
      }
      currentMessage = { ...message };
    }
  }

  // Add the last message if exists
  if (currentMessage) {
    result.push(currentMessage);
  }

  return result;
};
