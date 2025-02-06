import { IModelMapping } from './../types/settings.d';
/* eslint-disable no-console */
import Debug from 'debug';
import { create } from 'zustand';
import { isNil, pick } from 'lodash';

import { FontSize, ThemeType } from '../types/appearance';
import { LanguageType } from '../types/settings';
import { IAPISettings, ISettings } from '../types/settings';
import { getProvider } from 'providers';

const debug = Debug('5ire:stores:useSettingsStore');

const defaultTheme = 'system';
const defaultLanguage = 'system';
const defaultFontSize = 'base';

const defaultAPI: IAPISettings = {
  provider: 'OpenAI',
  base: 'https://api.openai.com',
  key: '',
  model: '',
};

const defaultModelMapping: IModelMapping = {};

export interface ISettingStore {
  theme: ThemeType;
  language: LanguageType;
  fontSize: FontSize;
  api: IAPISettings;
  modelMapping: IModelMapping;
  setTheme: (theme: ThemeType) => void;
  setAPI: (api: Partial<IAPISettings>) => void;
  setModelMapping: (modelMapping: IModelMapping) => void;
  setLanguage: (language: LanguageType) => void;
  setFontSize: (fontSize: FontSize) => void;
}

const settings = window.electron.store.get('settings', {}) as ISettings;
let apiSettings = defaultAPI;
if (settings.api?.activeProvider) {
  apiSettings =
    settings.api.providers[settings.api.activeProvider] || defaultAPI;
}

const useSettingsStore = create<ISettingStore>((set, get) => ({
  theme: settings?.theme || defaultTheme,
  language: settings?.language || defaultLanguage,
  fontSize: settings?.fontSize || defaultFontSize,
  modelMapping: settings.modelMapping || defaultModelMapping,
  api: apiSettings,
  setTheme: async (theme: ThemeType) => {
    set({ theme });
    window.electron.store.set('settings.theme', theme);
  },
  setAPI: (api: Partial<IAPISettings>) => {
    set((state) => {
      const provider = isNil(api.provider) ? state.api.provider : api.provider;
      const base = isNil(api.base) ? state.api.base : api.base;
      const key = isNil(api.key) ? state.api.key : api.key;
      const secret = isNil(api.secret) ? state.api.secret : api.secret;
      const model = isNil(api.model) ? state.api.model : api.model;
      const deploymentId = isNil(api.deploymentId)
        ? state.api.deploymentId
        : api.deploymentId;
      const newAPI = {
        provider,
        base,
        key,
        secret,
        deploymentId,
        model,
      } as IAPISettings;
      const { apiSchema } = getProvider(provider).chat;
      window.electron.store.set('settings.api.activeProvider', provider);
      window.electron.store.set(
        `settings.api.providers.${provider}`,
        pick(newAPI, [...apiSchema, 'provider'])
      );
      return { api: newAPI };
    });
  },
  setModelMapping: (modelMapping: IModelMapping) => {
    set({ modelMapping });
    window.electron.store.set('settings.modelMapping', modelMapping);
  },
  setLanguage: (language: 'en' | 'zh' | 'system') => {
    set({ language });
    window.electron.store.set('settings.language', language);
  },
  setFontSize: (fontSize: FontSize) => {
    set({ fontSize });
    window.electron.store.set('settings.fontSize', fontSize);
  },
}));

export default useSettingsStore;
