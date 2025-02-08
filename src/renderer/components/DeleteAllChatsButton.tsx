import { Button } from '@fluentui/react-components';
import { Delete24Regular } from '@fluentui/react-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Debug from 'debug';
import { captureException } from '../logging';
import useToast from 'hooks/useToast';
import useChatStore from 'stores/useChatStore';
import { tempChatId } from '../../consts';
import ConfirmDialog from './ConfirmDialog';
import useNav from 'hooks/useNav';

const debug = Debug('5ire:components:DeleteAllChatsButton');

export default function DeleteAllChatsButton() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { notifySuccess, notifyError } = useToast();
  const navigate = useNav();

  const deleteAllChats = async () => {
    setLoading(true);
    try {
      // Delete all chats and related messages from DB
      await window.electron.db.run('DELETE FROM messages', []);
      await window.electron.db.run('DELETE FROM chats', []);
      await window.electron.db.run('DELETE FROM chat_knowledge_rels', []);

      // Reset chat store state
      const chatStore = useChatStore.getState();
      chatStore.chat = { id: tempChatId, model: '' };
      chatStore.chats = [];
      chatStore.messages = [];

      // Fetch chats to refresh view
      await chatStore.fetchChat();
      
      // Navigate to temp chat
      navigate(`/chats/${tempChatId}`);

      notifySuccess("All chats have been deleted.");
    } catch (error: any) {
      debug(error);
      captureException(error instanceof Error ? error : new Error(String(error)));
      notifyError(t('Settings.Notification.DeleteAllChatsFailed'));
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <>
      <Button 
        icon={<Delete24Regular />}
        onClick={() => setConfirmOpen(true)}
        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
        disabled={loading}
      >
        Delete All Chats
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        setOpen={setConfirmOpen}
        title="Delete All Chats"
        message="Are you sure you want to delete all chats? This action cannot be undone."
        onConfirm={deleteAllChats}
      />
    </>
  );
}
