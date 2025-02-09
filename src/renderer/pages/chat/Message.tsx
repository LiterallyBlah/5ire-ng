/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable react/no-danger */
import Debug from 'debug';
import useChatStore from 'stores/useChatStore';
import { useCallback, useEffect, useMemo } from 'react';
import useMarkdown from 'hooks/useMarkdown';
import MessageToolbar from './MessageToolbar';
import {highlight } from '../../../utils/util';
import { IChatMessage } from 'intellichat/types';
import { useTranslation } from 'react-i18next';
import { Divider } from '@fluentui/react-components';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useToast from 'hooks/useToast';
import ToolSpinner from 'renderer/components/ToolSpinner';
import useSettingsStore from 'stores/useSettingsStore';
import ErrorBoundary from 'renderer/components/ErrorBoundary';
import ToolInteraction from 'renderer/components/ToolInteraction';
import ThinkingLLM from 'renderer/components/ThinkingLLM';

const debug = Debug('5ire:pages:chat:Message');

const SafeJSONParse = (jsonString: string | null | undefined | any, defaultValue: any = []): any => {
  // Handle non-string values first
  if (typeof jsonString !== 'string') {
    if (jsonString === null || jsonString === undefined) {
      return defaultValue;
    }
    // If it's already an object/array, return it
    if (typeof jsonString === 'object') {
      return jsonString;
    }
    // Convert to string for other types
    jsonString = String(jsonString);
  }

  // Now handle string values
  if (jsonString.trim() === '' || jsonString.trim() === '[]') {
    return defaultValue;
  }

  try {
    const parsed = JSON.parse(jsonString);
    // Check for null/undefined/empty array after parsing
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      return defaultValue;
    }
    return parsed;
  } catch (e) {
    console.debug('JSON parse failed for:', jsonString); // Changed to debug level
    return defaultValue;
  }
};

export default function Message({ message }: { 
  message: IChatMessage & { 
    toolInteractions?: { call: IChatMessage; response: IChatMessage; }[] 
  } 
}) {
  const { t } = useTranslation();
  const { notifyInfo } = useToast();
  const fontSize = useSettingsStore((state) => state.fontSize);
  const keywords = useChatStore((state: any) => state.keywords);
  const states = useChatStore().getCurState();
  const { showCitation } = useKnowledgeStore();
  const keyword = useMemo(
    () => keywords[message.chatId],
    [keywords, message.chatId]
  );
  const citedFiles = useMemo(
    () => {
      const parsed = SafeJSONParse(message.citedFiles, []);
      return Array.isArray(parsed) ? parsed : [];
    },
    [message.citedFiles]
  );

  const citedChunks = useMemo(
    () => {
      const parsed = SafeJSONParse(message.citedChunks, []);
      return Array.isArray(parsed) ? parsed : [];
    },
    [message.citedChunks]
  );

  const { render } = useMarkdown();

  const onCitationClick = useCallback(
    (event: any) => {
      const url = new URL(event.target?.href);
      if (url.pathname === '/citation' || url.protocol.startsWith('file:')) {
        event.preventDefault();
        const chunkId = url.hash.replace('#', '');
        const chunk = citedChunks.find((chunk: any) => chunk.id === chunkId);
        if (chunk) {
          showCitation(chunk.content);
        } else {
          notifyInfo(t('Knowledge.Notification.CitationNotFound'));
        }
      }
    },
    [citedChunks, showCitation]
  );

  const registerCitationClick = useCallback(() => {
    const links = document.querySelectorAll('.msg-reply a');
    links.forEach((link) => {
      link.addEventListener('click', onCitationClick);
    });
  }, [onCitationClick]);

  useEffect(() => {
    registerCitationClick();
    return () => {
      const links = document.querySelectorAll('.msg-reply a');
      links.forEach((link) => {
        link.removeEventListener('click', onCitationClick);
      });
    };
  }, [message.isActive, registerCitationClick]);

  const replyNode = useCallback(() => {
    // Show loader for active messages
    if (message.isActive && states.loading) {
      return (
        <div className="w-full mt-1.5">
          {states.runningTool && (
            <div className="flex flex-row justify-start items-center gap-1">
              <ToolSpinner size={20} style={{ marginBottom: '-3px' }} />
              <span>{states.runningTool}</span>
            </div>
          )}
          <span className="skeleton-box" style={{ width: '80%' }} />
          <span className="skeleton-box" style={{ width: '90%' }} />
        </div>
      );
    }

    return (
      <div className="msg-reply-content">
        <ThinkingLLM content={message.reply} />
        <div
          className={`mt-1 break-all ${fontSize === 'large' ? 'font-lg' : ''}`}
          dangerouslySetInnerHTML={{
            __html: render(`${highlight(message.reply.replace(/<think>[\s\S]*?<\/think>/g, ''), keyword)}` || ''),
          }}
        />
        
        {/* Tool interactions */}
        {message.toolInteractions && message.toolInteractions.length > 0 && (
          <div className="tool-interactions mt-4">
            {message.toolInteractions.map((interaction, index) => (
              <ToolInteraction 
                key={`${message.id}-tool-${index}`}
                toolCall={interaction.call}
                toolResponse={interaction.response}
              />
            ))}
          </div>
        )}
      </div>
    );
  }, [message, keyword, fontSize, states, render, t]);

  return (
    <ErrorBoundary>
      <div className="leading-6 message" id={message.id}>
        <div>
          <a
            id={`prompt-${message.id}`}
            aria-label={`prompt of message ${message.id}`}
          />

          <div
            className="msg-prompt my-2 flex flex-start"
            style={{ minHeight: '40px' }}
          >
            <div className="avatar flex-shrink-0 mr-2" />
            <div
              className={`mt-1 break-all ${
                fontSize === 'large' ? 'font-lg' : ''
              }`}
              dangerouslySetInnerHTML={{
                __html: render(highlight(message.prompt, keyword) || ''),
              }}
            />
          </div>
        </div>
        <div className="msg-reply mt-2">
          <div className="flex flex-start" style={{ minHeight: '40px' }}>
            <div className="avatar flex-shrink-0 mr-2" />
            <div className="flex-grow">
              {replyNode()}
            </div>
          </div>
          {citedFiles.length > 0 && (
            <div className="message-cited-files mt-2">
              <div className="mt-4 mb-2">
                <Divider>{t('Common.References')}</Divider>
              </div>
              <ul>
                {citedFiles.map((file: string) => (
                  <li className="text-gray-500" key={file}>
                    {file}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <MessageToolbar message={message} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
