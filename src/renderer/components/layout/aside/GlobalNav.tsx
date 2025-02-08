import { Button } from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  Apps24Regular,
  Apps24Filled,
  ChatAdd24Regular,
  ChatAdd24Filled,
  BookmarkMultiple24Regular,
  BookmarkMultiple24Filled,
  EmojiSparkle24Regular,
  EmojiSparkle24Filled,
  Library24Regular,
  Library24Filled,
  bundleIcon,
  Wand24Filled,
  Wand24Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import useNav from 'hooks/useNav';
import { tempChatId } from '../../../../consts';
import WorkspaceMenu from './WorkspaceMenu';
import useMCPStore from 'stores/useMCPStore';
import { useEffect, useMemo, useState } from 'react';

const AppsIcon = bundleIcon(Apps24Filled, Apps24Regular);
const BookmarkMultipleIcon = bundleIcon(
  BookmarkMultiple24Filled,
  BookmarkMultiple24Regular
);
const EmojiSparkleIcon = bundleIcon(
  EmojiSparkle24Filled,
  EmojiSparkle24Regular
);
const ChatAddIcon = bundleIcon(ChatAdd24Filled, ChatAdd24Regular);
const KnowledgeIcon = bundleIcon(Library24Filled, Library24Regular);
const WandIcon = bundleIcon(Wand24Filled, Wand24Regular);

const IS_ASSISTANTS_ENABLED = false;

export default function GlobalNav({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNav();
  const setActiveServerNames = useMCPStore(
    (store) => store.setActiveServerNames
  );
  const activeServerNames = useMCPStore((state) => state.activeServerNames);

  const numOfActiveServers = useMemo(
    () => activeServerNames.length,
    [activeServerNames]
  );

  useEffect(() => {
    Mousetrap.bind('alt+1', () => navigate('/tool'));
    Mousetrap.bind('alt+2', () => navigate('/knowledge'));
    Mousetrap.bind('alt+3', () => navigate('/bookmarks'));
    Mousetrap.bind('mod+n', () => navigate(`/chats/${tempChatId}`));
    if (numOfActiveServers === 0) {
      window.electron.mcp.getActiveServers().then((serverNames: string[]) => {
        setActiveServerNames(serverNames);
      });
    }
    return () => {
      Mousetrap.unbind('alt+1');
      Mousetrap.unbind('alt+2');
      Mousetrap.unbind('alt+3');
      Mousetrap.unbind('mod+n');
    };
  }, []);

  return (
    <div
      className={`relative ${
        collapsed ? 'text-center' : ''
      } border-b border-base py-2`}
    >
      <div className={`px-2 my-1 ${collapsed ? 'mx-auto' : ''}`}>
        <WorkspaceMenu collapsed={collapsed} />
      </div>
      {IS_ASSISTANTS_ENABLED && (
        <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
          <Button
            appearance="subtle"
            icon={<EmojiSparkleIcon />}
            className="w-full justify-start"
          >
            {collapsed ? null : t('Common.Assistants')}
          </Button>
        </div>
      )}
      {false && (
        <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
          <Button
            appearance="subtle"
            icon={<AppsIcon />}
            className="w-full justify-start"
            onClick={() => navigate('/apps')}
          >
            {collapsed ? null : t('Common.Apps')}
          </Button>
        </div>
      )}
      <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
        <Button
          appearance="subtle"
           title='Alt+1'
          icon={<WandIcon />}
          className="w-full justify-start"
          onClick={() => navigate('/tool')}
        >
          {collapsed
            ? null
            : t('Common.Tools') +
              (numOfActiveServers ? `(${numOfActiveServers})` : '')}
        </Button>
      </div>
      <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
        <Button
          appearance="subtle"
           title='Alt+2'
          icon={<KnowledgeIcon />}
          className="w-full justify-start"
          onClick={() => navigate('/knowledge')}
        >
          {collapsed ? null : t('Common.Knowledge')}
        </Button>
      </div>
      <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
        <Button
          appearance="subtle"
          title='Alt+3'
          icon={<BookmarkMultipleIcon />}
          className="w-full justify-start"
          onClick={() => {
            navigate('/bookmarks');
          }}
        >
          {collapsed ? null : t('Common.Bookmarks')}
        </Button>
      </div>
      <div className={`px-2  my-1 ${collapsed ? 'mx-auto' : ''}`}>
        <Button
          appearance="subtle"
          title='Mod+n'
          icon={<ChatAddIcon />}
          className="w-full justify-start"
          onClick={async () => navigate(`/chats/${tempChatId}`)}
        >
          {collapsed ? null : t('Chat.New')}
        </Button>
      </div>
    </div>
  );
}
