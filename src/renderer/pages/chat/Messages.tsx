import Message from './Message';
import { IChatMessage } from 'intellichat/types';
import ErrorBoundary from 'renderer/components/ErrorBoundary';

export default function Messages({ messages }: { messages: IChatMessage[] }) {
  return (
    <ErrorBoundary>
      <div id="messages">
        {messages.map((msg: IChatMessage) => {
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
