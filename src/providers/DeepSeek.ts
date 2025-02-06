import { IServiceProvider } from './types';

export default {
  name: 'DeepSeek',
  apiBase: 'https://api.deepseek.com',
  currency: 'CNY',
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ['base', 'key', 'model'],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 2, default: 1 },
    options: {
      modelCustomizable: true,
    },
    models: {
      'deepseek-chat': {
        name: 'deepseek-chat',
        contextWindow: 65536,
        maxTokens: 8192,
        defaultMaxTokens: 512,
        inputPrice: 0.0006,
        outputPrice: 0.002,
        isDefault: true,
        description: `60 tokens/second, Enhanced capabilities，API compatibility intact`,
        toolEnabled: true,
        group: 'DeepSeek',
      },
      'deepseek-reasoner': {
        name: 'deepseek-reasoner',
        contextWindow: 65536,
        maxTokens: 8192,
        defaultMaxTokens: 512,
        inputPrice: 0.003,
        outputPrice: 0.016,
        isDefault: true,
        description: `Performance on par with OpenAI-o1`,
        toolEnabled: false,
        group: 'DeepSeek',
      },
    },
  },
} as IServiceProvider;
