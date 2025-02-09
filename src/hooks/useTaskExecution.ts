import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { typeid } from 'typeid-js';
import useChatStore from 'stores/useChatStore';
import useSettingsStore from 'stores/useSettingsStore';
import useChatService from './useChatService';
import useNav from './useNav';

export default function useTaskExecution() {
  const { t } = useTranslation();
  const navigate = useNav();
  const createChat = useChatStore((state) => state.createChat);
  const createMessage = useChatStore((state) => state.createMessage);
  const chatService = useChatService();

  useEffect(() => {
    // Handle task execution completion events
    const handleTaskExecuted = (event: any, data: { taskId: string, chatId: string }) => {
      console.log(`[TaskExecution] Task ${data.taskId} executed, navigating to chat ${data.chatId}`);
      navigate(`/chat/${data.chatId}`);
    };

    // Use the existing onExecute event as that's what's available in the API
    window.electron.tasks.onExecute((task: any) => {
      console.log('[TaskExecution] Task execution event received:', task);
      if (task.chatId) {
        navigate(`/chat/${task.chatId}`);
      }
    });

    console.log('[TaskExecution] Task execution handlers registered');

    return () => {
      console.log('[TaskExecution] Cleaning up task execution handlers');
      // Cleanup handled by electron bridge
    };
  }, [navigate]);
}