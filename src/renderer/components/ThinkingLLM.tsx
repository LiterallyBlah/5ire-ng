import { useState } from 'react';
import './ThinkingLLM.scss';

interface ThinkingLLMProps {
  content: string;
}

export default function ThinkingLLM({ content }: ThinkingLLMProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content.includes('<think>')) return null;

  const thinkingContent = content
    .match(/<think>([\s\S]*?)<\/think>/)?.[1]
    .trim();

  if (!thinkingContent) return null;

  return (
    <div className="thinking-llm">
      <button
        className="thinking-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? '🤔 Hide Thinking Process' : '🤔 Show Thinking Process'}
      </button>
      {isExpanded && (
        <div className="thinking-content">
          {thinkingContent.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
