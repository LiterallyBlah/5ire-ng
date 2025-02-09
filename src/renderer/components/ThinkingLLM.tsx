import { useState } from 'react';
import './ThinkingLLM.scss';

interface ThinkingLLMProps {
  content: string;
}

export default function ThinkingLLM({ content }: ThinkingLLMProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Add safety checks for null/undefined content
  if (!content || typeof content !== 'string' || !content.includes('<think>')) return null;

  const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const thinkingContent = thinkingMatch?.[1]?.trim();

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
