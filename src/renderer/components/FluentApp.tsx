import { useEffect } from 'react';
import Debug from 'debug';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { captureException } from '../logging';
import {
  FluentProvider,
  Toaster,
  BrandVariants,
  createLightTheme,
  Theme,
  createDarkTheme,
} from '@fluentui/react-components';
import useSettingsStore from '../../stores/useSettingsStore';
import useAppearanceStore from '../../stores/useAppearanceStore';
import useAuthStore from 'stores/useAuthStore';
import useMCPStore from 'stores/useMCPStore';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useToast from 'hooks/useToast';
import useTaskExecution from 'hooks/useTaskExecution';
import { useTranslation } from 'react-i18next';
import Mousetrap from 'mousetrap';
import AppHeader from './layout/AppHeader';
import AppSidebar from './layout/aside/AppSidebar';
import Chat from '../pages/chat';
import Knowledge from '../pages/knowledge';
import KnowledgeCollectionForm from '../pages/knowledge/CollectionForm';
import Tools from '../pages/tool';
import Bookmarks from '../pages/bookmark';
import Bookmark from '../pages/bookmark/Bookmark';
import Usage from '../pages/usage';
import Login from '../pages/user/Login';
import Register from '../pages/user/Register';
import Account from '../pages/user/Account';
import Settings from '../pages/settings';
import Prompts from '../pages/prompt';
import PromptForm from '../pages/prompt/Form';
import AppLoader from '../apps/Loader';
import Tasks from '../pages/task';
import TaskForm from '../pages/task/TaskForm';

const debug = Debug('5ire:components:FluentApp');

const fire: BrandVariants = {
  10: '#030303',
  20: '#171717',
  30: '#252525',
  40: '#313131',
  50: '#3D3D3D',
  60: '#494949',
  70: '#565656',
  80: '#636363',
  90: '#717171',
  100: '#7F7F7F',
  110: '#8D8D8D',
  120: '#9B9B9B',
  130: '#AAAAAA',
  140: '#B9B9B9',
  150: '#C8C8C8',
  160: '#D7D7D7',
};

const lightTheme: Theme = {
  ...createLightTheme(fire),
};

const darkTheme: Theme = {
  ...createDarkTheme(fire),
};

darkTheme.colorBrandForeground2 = fire[130];

export default function FluentApp() {
  const { i18n } = useTranslation();
  const themeSettings = useSettingsStore((state) => state.theme);
  const theme = useAppearanceStore((state) => state.theme);
  const language = useSettingsStore((state) => state.language);
  const setTheme = useAppearanceStore((state) => state.setTheme);
  const loadAuthData = useAuthStore((state) => state.load);
  const setSession = useAuthStore((state) => state.setSession);
  const { setActiveServerNames } = useMCPStore();
  const { onAuthStateChange } = useAuthStore();
  const { notifyError } = useToast();
  const { t } = useTranslation();
  const { createFile } = useKnowledgeStore();

  useEffect(() => {
    loadAuthData();
    Mousetrap.prototype.stopCallback = () => {
      return false;
    };
    const subscription = onAuthStateChange();

    window.electron.ipcRenderer.on(
      'mcp-server-loaded',
      async (serverNames: any) => {
        debug('🚩 MCP Server Loaded:', serverNames);
        setActiveServerNames(serverNames);
      }
    );

    window.electron.ipcRenderer.on('sign-in', async (authData: any) => {
      if (authData.accessToken && authData.refreshToken) {
        try {
          await setSession(authData);
        } catch (err: any) {
          notifyError(t('Error.Login'));
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      window.electron.ipcRenderer.unsubscribeAll('mcp-server-loaded');
      window.electron.ipcRenderer.unsubscribeAll('sign-in');
    };
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.on('native-theme-change', (_theme: unknown) => {
      if (themeSettings === 'system') {
        setTheme(_theme as 'light' | 'dark');
        debug(`Theme Change to: ${_theme}`);
      }
    });
    return () => {
      window.electron.ipcRenderer.unsubscribeAll('native-theme-change');
    };
  }, [themeSettings, setTheme]);

  useEffect(() => {
    if (themeSettings === 'system') {
      window.electron
        .getNativeTheme()
        .then((_theme) => {
          debug(`Theme: ${_theme}`);
          return setTheme(_theme);
        })
        .catch(captureException);
    } else {
      setTheme(themeSettings);
    }

    if (language === 'system') {
      window.electron
        .getSystemLanguage()
        .then((_lang) => {
          return i18n.changeLanguage(_lang);
        })
        .catch(captureException);
    } else {
      i18n.changeLanguage(language);
    }
  }, [themeSettings, setTheme]);

  return (
    <FluentProvider
      theme={theme === 'light' ? lightTheme : darkTheme}
      data-theme={theme}
    >
      <Router>
        <AppHeader />
        <Toaster toasterId="toaster" limit={5} offset={{ vertical: 25 }} />
        <div className="relative flex h-screen w-full overflow-hidden main-container">
          <AppSidebar />
          <main className="relative px-5 flex h-full w-full flex-col overflow-hidden">
            <Routes>
              <Route index element={<Chat />} />
              <Route path="/chats/:id?/:anchor?" element={<Chat />} />
              <Route path="/knowledge" element={<Knowledge />} />
              <Route
                path="/knowledge/collection-form/:id?"
                element={<KnowledgeCollectionForm />}
              />
              <Route path="/tool" element={<Tools />} />
              <Route path="/apps/:key" element={<AppLoader />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/bookmarks/:id" element={<Bookmark />} />
              <Route path="/user/login" element={<Login />} />
              <Route path="/user/register" element={<Register />} />
              <Route path="/user/account" element={<Account />} />
              <Route path="/usage" element={<Usage />} />
              <Route path="/prompts" element={<Prompts />} />
              <Route path="/prompts/form/:id?" element={<PromptForm />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/form/:id?" element={<TaskForm />} />
            </Routes>
          </main>
        </div>
      </Router>
    </FluentProvider>
  );
}
