import Message from './Message';
import { IChatMessage } from 'intellichat/types';
import ErrorBoundary from 'renderer/components/ErrorBoundary';
import { groupMessageWithTools } from 'utils/messageUtils';
import { useMemo } from 'react';

export default function Messages({ messages }: { messages: IChatMessage[] }) {
  const groupedMessages = useMemo(() => {
    return groupMessageWithTools(messages);
  }, [messages]);

  return (
    <ErrorBoundary>
      <div id="messages">
        {groupedMessages.map((msg) => {
          return (
            <ErrorBoundary key={msg.id}>
              <Message message={msg} />
            </ErrorBoundary>
          );
        })}
        <div className="h-10">&nbsp;</div>
      </div>
    </ErrorBoundary>
  );
}
