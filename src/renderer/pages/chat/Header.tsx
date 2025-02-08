import { useEffect, useState } from 'react';
import { Button, Tooltip } from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  MoreHorizontal24Regular,
  MoreHorizontal24Filled,
  FilterDismiss24Regular,
  Delete24Regular,
  Delete24Filled,
  bundleIcon,
} from '@fluentui/react-icons';
import useAppearanceStore from 'stores/useAppearanceStore';
import useChatStore from 'stores/useChatStore';
import { useTranslation } from 'react-i18next';
import useChatContext from 'hooks/useChatContext';
import ChatSettingsDrawer from './ChatSettingsDrawer';
import ConfirmDialog from 'renderer/components/ConfirmDialog';

import { tempChatId } from '../../../consts';
import useNav from 'hooks/useNav';
import useToast from 'hooks/useToast';

const DeleteIcon = bundleIcon(Delete24Filled, Delete24Regular);
const MoreHorizontalIcon = bundleIcon(
  MoreHorizontal24Filled,
  MoreHorizontal24Regular
);

export default function Header() {
  const { t } = useTranslation();
  const { notifySuccess } = useToast();
  const navigate = useNav();

  const activeChat = useChatContext().getActiveChat();
  const collapsed = useAppearanceStore((state) => state.sidebar.collapsed);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const [delConfirmDialogOpen, setDelConfirmDialogOpen] =
    useState<boolean>(false);
  const deleteChat = useChatStore((state) => state.deleteChat);

  const onDeleteChat = async () => {
    await deleteChat();
    navigate(`/chats/${tempChatId}`);
    notifySuccess(t('Chat.Notification.Deleted'));
  };

  const getKeyword = useChatStore((state) => state.getKeyword);
  const setKeyword = useChatStore((state) => state.setKeyword);

  const keyword = activeChat.isPersisted ? getKeyword(activeChat?.id) : null;

  useEffect(() => {
    Mousetrap.bind('mod+d', () => {
      if (activeChat?.id !== tempChatId) {
        setDelConfirmDialogOpen(true);
      }
    });
    return () => {
      Mousetrap.unbind('mod+d');
    };
  }, [activeChat?.id]);

  return (
    <div
      className={`chat-header absolute p-2.5 -mx-2.5 flex justify-end items-center ${
        collapsed
          ? 'left-[12rem] md:left-[5rem]'
          : 'left-[12rem] md:left-0 lg:left-0'
      }`}
    >
      <div className="flex justify-end items-center gap-1">
        {activeChat.isPersisted ? (
          <>
            <Button
              icon={<DeleteIcon className="text-color-tertiary" />}
              appearance="transparent"
              title="Mod+d"
              onClick={() => setDelConfirmDialogOpen(true)}
            />
            {keyword ? (
              <Tooltip content={t('Common.ClearFilter')} relationship="label">
                <Button
                  icon={<FilterDismiss24Regular />}
                  appearance="subtle"
                  onClick={() => setKeyword(activeChat?.id, '')}
                />
              </Tooltip>
            ) : null}
          </>
        ) : null}
        <Button
          icon={<MoreHorizontalIcon />}
          appearance="subtle"
          onClick={() => setDrawerOpen(true)}
        />
      </div>
      <ChatSettingsDrawer open={drawerOpen} setOpen={setDrawerOpen} />
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        title={t('Chat.DeleteConfirmation')}
        message={t('Chat.DeleteConfirmationInfo')}
        onConfirm={onDeleteChat}
      />
    </div>
  );
}
