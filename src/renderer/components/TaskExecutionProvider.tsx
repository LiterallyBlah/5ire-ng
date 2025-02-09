import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Debug from 'debug';

const debug = Debug('5ire:components:TaskExecutionProvider');

interface Props {
  children: ReactNode;
}

export default function TaskExecutionProvider({ children }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // Handle task execution completion events
    window.electron.tasks.onExecute((task: any) => {
      debug('[TaskExecution] Task execution event received:', task);
      if (task.chatId) {
        navigate(`/chat/${task.chatId}`);
      }
    });

    debug('[TaskExecution] Task execution handlers registered');

    return () => {
      debug('[TaskExecution] Cleaning up task execution handlers');
      // Cleanup handled by electron bridge
    };
  }, [navigate]);

  return <>{children}</>;
}