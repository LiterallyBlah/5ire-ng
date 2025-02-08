import { useState } from 'react';
import { IChatMessage } from 'intellichat/types';
import { Button, Text } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronRight16Regular } from '@fluentui/react-icons';

interface ToolInteractionProps {
  toolCall: IChatMessage;
  toolResponse: IChatMessage;
}

export default function ToolInteraction({ toolCall, toolResponse }: ToolInteractionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolName = toolCall.prompt.replace('Tool Call: ', '');

  return (
    <div className="tool-interaction">
      <Button 
        appearance="subtle"
        icon={isExpanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center text-sm w-full justify-start"
      >
        <Text>{toolName}</Text>
      </Button>
      
      {isExpanded && (
        <div className="mt-2">
          {/* <div className="tool-details">
            <Text className="tool-label">Tool Details</Text>
            <pre>
              {JSON.stringify(toolCall.toolCall, null, 2)}
            </pre>
          </div> */}
          
          <div className="tool-response">
            <Text className="tool-label">Response</Text>
            <pre>
              {toolResponse.reply || JSON.stringify(toolResponse.toolResponse?.content, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
