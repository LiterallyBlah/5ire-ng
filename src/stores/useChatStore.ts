import Debug from 'debug';
import { create } from 'zustand';
import { typeid } from 'typeid-js';
import { produce } from 'immer';
import { isNil, isNumber, isString } from 'lodash';
import { NUM_CTX_MESSAGES, tempChatId } from 'consts';
import { captureException } from '../renderer/logging';
import { date2unix } from 'utils/util';
import { isBlank, isNotBlank } from 'utils/validators';
import useSettingsStore from './useSettingsStore';
import useStageStore from './useStageStore';
import { IChat, IChatMessage } from 'intellichat/types';
import { isValidTemperature } from 'intellichat/validators';
import { getProvider, getChatModel } from 'providers';

const debug = Debug('5ire:stores:useChatStore');

const safeParseJSON = (jsonString: string | null, fallback: any = null) => {
  if (!jsonString) return fallback;
  try {
    // Handle empty string cases
    if (jsonString.trim() === '') return fallback;
    const parsed = JSON.parse(jsonString);
    // Check if parsed result is null/undefined
    return parsed ?? fallback;
  } catch (e) {
    console.error('Failed to parse JSON:', e);
    return fallback;
  }
};

const ensureValidJson = (value: any, defaultValue: any = null): string => {
  if (!value) return JSON.stringify(defaultValue);
  if (typeof value === 'string') {
    try {
      // Try parsing and re-stringifying to validate
      JSON.parse(value);
      return value;
    } catch (e) {
      return JSON.stringify(defaultValue);
    }
  }
  // If it's an object/array, stringify it
  try {
    return JSON.stringify(value);
  } catch (e) {
    return JSON.stringify(defaultValue);
  }
};

const validateJson = (value: any): string | null => {
  if (!value) return null;
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch (e) {
    console.error('[validateJson] Failed to stringify JSON:', e);
    return null;
  }
};

const standardizeToolResponse = (response: any): string | null => {
  if (!response) return null;
  try {
    // If it's a string, parse it first
    const parsed = typeof response === 'string' ? safeParseJSON(response, {}) : response;
    
    // Ensure we have a standard format
    const standardized = {
      content: parsed.content || parsed
    };
    
    return JSON.stringify(standardized);
  } catch (e) {
    console.error('Failed to standardize tool response:', e);
    return JSON.stringify({ content: null });
  }
};

export interface IChatStore {
  chats: IChat[];
  chat: {
    id: string;
  } & Partial<IChat>;
  messages: IChatMessage[];
  keywords: { [key: string]: string };
  states: {
    [key: string]: {
      loading: boolean;
      runningTool: string;
    };
  };
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null }
  ) => void;
  getKeyword: (chatId: string) => string;
  setKeyword: (chatId: string, keyword: string) => void;
  // chat
  initChat: (chat: Partial<IChat>) => IChat;
  editChat: (chat: Partial<IChat>) => IChat;
  createChat: (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>
  ) => Promise<IChat>;
  updateChat: (chat: { id: string } & Partial<IChat>) => Promise<boolean>;
  deleteChat: () => Promise<boolean>;
  fetchChat: (limit?: number) => Promise<IChat[]>;
  getChat: (id: string) => Promise<IChat>;
  // message
  createMessage: (message: Partial<IChatMessage>) => Promise<IChatMessage>;
  appendReply: (chatId: string, reply: string) => string;
  updateMessage: (
    message: { id: string } & Partial<IChatMessage>
  ) => Promise<boolean>;
  bookmarkMessage: (id: string, bookmarkId: string | null) => void;
  deleteMessage: (id: string) => Promise<boolean>;
  getCurState: () => { loading: boolean; runningTool: string };
  fetchMessages: ({
    chatId,
    limit,
    offset,
    keyword,
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => Promise<IChatMessage[]>;
}

const useChatStore = create<IChatStore>((set, get) => ({
  keywords: {},
  chats: [],
  chat: { id: tempChatId, model: '' },
  messages: [],
  states: {},
  stages: {},
  updateStates: (
    chatId: string,
    states: { loading?: boolean; runningTool?: string | null }
  ) => {
    set(
      produce((state: IChatStore) => {
        state.states[chatId] = Object.assign(
          state.states[chatId] || {},
          states
        );
      })
    );
  },
  getCurState: () => {
    const { chat, states } = get();
    return states[chat.id] || {};
  },
  getKeyword: (chatId: string) => {
    return get().keywords[chatId] || '';
  },
  setKeyword: (chatId: string, keyword: string) => {
    set(
      produce((state: IChatStore) => {
        state.keywords[chatId] = keyword;
      })
    );
  },
  initChat: (chat: Partial<IChat>) => {
    const { api } = useSettingsStore.getState();
    const { editStage } = useStageStore.getState();
    const $chat = {
      model: api.model,
      temperature: getProvider(api.provider).chat.temperature.default,
      maxTokens: null,
      maxCtxMessages: NUM_CTX_MESSAGES,
      ...chat,
      id: tempChatId,
    } as IChat;
    console.log('Init a chat', $chat);
    set({ chat: $chat, messages: [] });
    return $chat;
  },
  editChat: (chat: Partial<IChat>) => {
    const { api } = useSettingsStore.getState();
    const $chat = get().chat as IChat;
    if (isString(chat.summary)) {
      $chat.summary = chat.summary as string;
    }
    if (isNotBlank(chat.model)) {
      $chat.model = chat.model as string;
    }
    if (!isNil(chat.systemMessage)) {
      $chat.systemMessage = chat.systemMessage as string;
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      $chat.maxCtxMessages = chat.maxCtxMessages;
    }
    if (isValidTemperature(chat.temperature, api.provider)) {
      $chat.temperature = chat.temperature;
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      $chat.maxTokens = chat.maxTokens;
    }
    $chat.stream = isNil(chat.stream) ? true : chat.stream;
    set({ chat: { ...$chat } });
    return $chat;
  },
  createChat: async (
    chat: Partial<IChat>,
    beforeSetCallback?: (chat: IChat) => Promise<void>
  ) => {
    const $chat = {
      ...get().chat,
      ...chat,
      id: typeid('chat').toString(),
      createdAt: date2unix(new Date()),
    } as IChat;
    const { getPrompt, editStage } = useStageStore.getState();
    const stagePrompt = getPrompt(tempChatId);
    console.log('Create a chat ', $chat);
    const ok = await window.electron.db.run(
      `INSERT INTO chats (id, summary, model, systemMessage, temperature, maxCtxMessages, maxTokens, stream, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        $chat.id,
        $chat.summary,
        $chat.model || null,
        $chat.systemMessage || null,
        $chat.temperature || null,
        $chat.maxCtxMessages || null,
        $chat.maxTokens || null,
        isNil($chat.stream) ? 1 : $chat.stream ? 1 : 0,
        $chat.createdAt,
      ]
    );
    if (!ok) {
      throw new Error('Write the chat into database failed');
    }
    if (beforeSetCallback) {
      await beforeSetCallback($chat);
    }
    set(
      produce((state: IChatStore) => {
        state.chat = $chat;
        state.chats = [$chat, ...state.chats];
        state.messages = [];
      })
    );
    /**
     * prompt 是通过 chatID 对应的，但 chat 一旦创建，id 就从 temp id 变成了 permanent id
     * 因此需要将 stage 的 prompt 转存到 permanent id 中
     */
    editStage($chat.id, { prompt: stagePrompt });
    return $chat;
  },
  updateChat: async (chat: { id: string } & Partial<IChat>) => {
    const $chat = { id: chat.id } as IChat;
    const stats: string[] = [];
    const params: (string | number)[] = [];
    if (isNotBlank(chat.summary)) {
      stats.push('summary = ?');
      $chat.summary = chat.summary as string;
      params.push($chat.summary);
    }
    if (isNotBlank(chat.model)) {
      stats.push('model = ?');
      $chat.model = chat.model as string;
      params.push($chat.model);
    }
    if (!isNil(chat.systemMessage)) {
      stats.push('systemMessage = ?');
      $chat.systemMessage = chat.systemMessage as string;
      params.push($chat.systemMessage);
    }
    if (isNumber(chat.maxCtxMessages) && chat.maxCtxMessages >= 0) {
      stats.push('maxCtxMessages = ?');
      $chat.maxCtxMessages = chat.maxCtxMessages;
      params.push($chat.maxCtxMessages);
    }
    if (isNumber(chat.temperature) && chat.temperature >= 0) {
      stats.push('temperature = ?');
      $chat.temperature = chat.temperature;
      params.push($chat.temperature);
    }
    if (isNumber(chat.maxTokens) && chat.maxTokens > 0) {
      stats.push('maxTokens = ?');
      $chat.maxTokens = chat.maxTokens;
      params.push($chat.maxTokens);
    }
    if (!isNil(chat.context)) {
      stats.push('context = ?');
      chat.context = chat.context as string;
      params.push(chat.context);
    }
    if (!isNil(chat.stream)) {
      stats.push('stream = ?');
      $chat.stream = chat.stream;
      params.push(chat.stream ? 1 : 0);
    }
    if ($chat.id && stats.length) {
      params.push($chat.id);
      await window.electron.db.run(
        `UPDATE chats SET ${stats.join(', ')} WHERE id = ?`,
        params
      );
      const updatedChat = { ...get().chat, ...$chat } as IChat;
      const updatedChats = get().chats.map((c: IChat) => {
        if (c.id === updatedChat.id) {
          return updatedChat;
        }
        return c;
      });
      set({ chat: updatedChat, chats: updatedChats });
      console.log('Update chat ', updatedChat);
      return true;
    }
    return false;
  },
  getChat: async (id: string) => {
    const chat = (await window.electron.db.get(
      'SELECT id, summary, model, systemMessage, maxTokens, temperature, context, maxCtxMessages, stream, createdAt FROM chats where id = ?',
      id
    )) as IChat;
    console.log('Get chat:', chat);
    set({ chat });
    return chat;
  },
  fetchChat: async (limit: number = 100, offset = 0) => {
    const chats = (await window.electron.db.all(
      'SELECT id, summary, createdAt FROM chats ORDER BY createdAt DESC limit ? offset ?',
      [limit, offset]
    )) as IChat[];
    set({ chats });
    return chats;
  },
  deleteChat: async () => {
    const { chat, initChat } = get();
    try {
      if (chat.id !== tempChatId) {
        await window.electron.db.run(`DELETE FROM chats WHERE id = ?`, [
          chat.id,
        ]);
        await window.electron.db.run(`DELETE FROM messages WHERE chatId = ?`, [
          chat.id,
        ]);
        set(
          produce((state: IChatStore) => {
            state.messages = [];
            const index = state.chats.findIndex((i) => i.id === chat.id);
            if (index > -1) {
              state.chats.splice(index, 1);
            }
          })
        );
        useStageStore.getState().deleteStage(chat.id);
      }
      initChat({});
      return true;
    } catch (err: any) {
      captureException(err);
      return false;
    }
  },
  createMessage: async (message: Partial<IChatMessage>) => {
    console.log('[createMessage] Input message:', message);

    // Validate JSON fields before storing
    const validateJson = (value: any): string | null => {
      if (!value) return null;
      try {
        return typeof value === 'string' ? value : JSON.stringify(value);
      } catch (e) {
        console.error('[createMessage] Failed to stringify JSON:', e);
        return null;
      }
    };

    // Special handling for toolResponse
    const validateToolResponse = (response: any): string | null => {
      return standardizeToolResponse(response);
    };

    // Create a type without the tool fields first
    const baseMsg = {
      id: typeid('msg').toString(),
      chatId: message.chatId,
      systemMessage: message.systemMessage || null,
      prompt: message.prompt || '',
      reply: message.isTool && message.toolResponse 
        ? JSON.stringify(message.toolResponse.content, null, 2)  // Format tool response as reply
        : message.reply || '',
      model: message.model || '',
      temperature: message.temperature || 0,
      maxTokens: message.maxTokens || null,
      inputTokens: message.inputTokens || 0,
      outputTokens: message.outputTokens || 0,
      memo: message.memo || null,
      isActive: message.isActive || 1,
      citedFiles: ensureValidJson(message.citedFiles, []),
      citedChunks: ensureValidJson(message.citedChunks, []),
      isTool: message.isTool || false,
      createdAt: date2unix(new Date()),
    };

    console.log('[createMessage] Base message:', baseMsg);

    try {
      // First ensure the messages table exists with correct schema
      console.log('[createMessage] Creating/updating messages table...');
      try {
        const createResult = await window.electron.db.run(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chatId TEXT NOT NULL,
            systemMessage TEXT,
            prompt TEXT,
            reply TEXT,
            model TEXT,
            temperature REAL,
            maxTokens INTEGER,
            inputTokens INTEGER,
            outputTokens INTEGER,
            memo TEXT,
            isActive INTEGER,
            citedFiles TEXT,
            citedChunks TEXT,
            isTool INTEGER,
            toolCall TEXT,
            toolResponse TEXT,
            createdAt INTEGER,
            CHECK (
              json_valid(citedFiles) OR citedFiles IS NULL,
              json_valid(citedChunks) OR citedChunks IS NULL,
              json_valid(toolCall) OR toolCall IS NULL,
              json_valid(toolResponse) OR toolResponse IS NULL
            )
          )
        `, []); // Add empty params array
        console.log('[createMessage] Table creation result:', createResult);
      } catch (tableError) {
        console.error('[createMessage] Failed to create table:', tableError);
      }

      // Verify table structure
      try {
        const tableInfo = await window.electron.db.all("PRAGMA table_info(messages)");
        console.log('[createMessage] Table structure:', tableInfo);
      } catch (infoError) {
        console.error('[createMessage] Failed to get table info:', infoError);
      }

      // Try minimal insert first
      console.log('[createMessage] Attempting minimal insert...');
      try {
        const minimalResult = await window.electron.db.run(
          `INSERT INTO messages (id, chatId, prompt) VALUES (?, ?, ?)`,
          [baseMsg.id, baseMsg.chatId, baseMsg.prompt]
        );
        console.log('[createMessage] Minimal insert result:', minimalResult);
      } catch (insertError) {
        console.error('[createMessage] Minimal insert failed:', insertError);
        throw insertError;
      }

      // Update fields one by one with better error handling
      const fields = [
        { name: 'systemMessage', value: baseMsg.systemMessage, isJson: false },
        { name: 'reply', value: baseMsg.reply, isJson: false },
        { name: 'model', value: baseMsg.model, isJson: false },
        { name: 'temperature', value: baseMsg.temperature, isJson: false },
        { name: 'maxTokens', value: baseMsg.maxTokens, isJson: false },
        { name: 'inputTokens', value: baseMsg.inputTokens, isJson: false },
        { name: 'outputTokens', value: baseMsg.outputTokens, isJson: false },
        { name: 'memo', value: baseMsg.memo, isJson: false },
        { name: 'isActive', value: baseMsg.isActive, isJson: false },
        { name: 'citedFiles', value: baseMsg.citedFiles, isJson: true },
        { name: 'citedChunks', value: baseMsg.citedChunks, isJson: true },
        { name: 'isTool', value: message.isTool ? 1 : 0, isJson: false },
        { name: 'toolCall', value: validateJson(message.toolCall), isJson: true },
        { name: 'toolResponse', value: validateToolResponse(message.toolResponse), isJson: true },
        { name: 'createdAt', value: baseMsg.createdAt, isJson: false }
      ];

      for (const field of fields) {
        try {
          console.log(`[createMessage] Updating ${field.name}:`, field.value);
          const sql = field.isJson
            ? `UPDATE messages SET ${field.name} = json(?) WHERE id = ?`
            : `UPDATE messages SET ${field.name} = ? WHERE id = ?`;
          const updateResult = await window.electron.db.run(sql, [field.value, baseMsg.id]);
          console.log(`[createMessage] Update result for ${field.name}:`, updateResult);
        } catch (updateError) {
          console.error(`[createMessage] Failed to update ${field.name}:`, updateError);
        }
      }

      // Verify final state
      try {
        const finalState = await window.electron.db.get(
          'SELECT * FROM messages WHERE id = ?',
          [baseMsg.id]
        );
        console.log('[createMessage] Final message state:', finalState);
      } catch (verifyError) {
        console.error('[createMessage] Failed to verify final state:', verifyError);
      }

      // Create the properly typed message for the state
      const typedMsg: IChatMessage = {
        ...baseMsg,
        toolCall: message.toolCall,
        toolResponse: message.toolResponse,
      } as IChatMessage;

      console.log('[createMessage] Setting state with message:', typedMsg);

      set((state) => ({
        messages: [...state.messages, typedMsg],
      }));

      // Clear input after message creation
      useStageStore
        .getState()
        .editStage(typedMsg.chatId, { chatId: typedMsg.chatId, input: '' });

      return typedMsg;
    } catch (error) {
      console.error('[createMessage] Fatal error:', error);
      throw error;
    }
  },
  appendReply: (msgId: string, reply: string) => {
    let $reply = '';
    set(
      produce((state: IChatStore) => {
        const message = state.messages.find((msg) => msg.id === msgId);
        if (message) {
          $reply = message.reply ? `${message.reply}${reply}` : reply;
          message.reply = $reply;
        }
      })
    );
    return $reply;
  },
  updateMessage: async (message: { id: string } & Partial<IChatMessage>) => {
    const msg = { id: message.id } as IChatMessage;
    const stats: string[] = [];
    const params: (string | number | null)[] = [];

    // Handle reply/toolResponse coordination
    if (!isNil(message.toolResponse)) {
      stats.push('toolResponse = json(?)', 'reply = ?');
      msg.toolResponse = message.toolResponse;
      params.push(
        standardizeToolResponse(message.toolResponse),
        JSON.stringify(message.toolResponse.content, null, 2)  // Format tool response as reply
      );
    } else if (isNotBlank(message.reply)) {
      stats.push('reply = ?');
      msg.reply = message.reply as string;
      params.push(msg.reply);
    }

    if (isNotBlank(message.prompt)) {
      stats.push('prompt = ?');
      msg.prompt = message.prompt as string;
      params.push(msg.prompt);
    }
    if (isNotBlank(message.reply)) {
      stats.push('reply = ?');
      msg.reply = message.reply as string;
      params.push(msg.reply);
    }
    if (isNotBlank(message.model)) {
      stats.push('model = ?');
      msg.model = message.model as string;
      params.push(msg.model);
    }
    if (isNumber(message.temperature)) {
      stats.push('temperature = ?');
      msg.temperature = message.temperature as number;
      params.push(msg.temperature);
    }
    if (isNumber(message.inputTokens)) {
      stats.push('inputTokens = ?');
      msg.inputTokens = message.inputTokens as number;
      params.push(msg.inputTokens);
    }
    if (isNumber(message.outputTokens)) {
      stats.push('outputTokens = ?');
      msg.outputTokens = message.outputTokens as number;
      params.push(msg.outputTokens);
    }
    if (!isNil(message.memo)) {
      stats.push('memo = ?');
      msg.memo = message.memo as string;
      params.push(msg.memo);
    }
    if (!isNil(message.isActive)) {
      stats.push('isActive = ?');
      msg.isActive = message.isActive as boolean;
      params.push(msg.isActive ? 1 : 0);
    }
    if (!isBlank(message.citedFiles)) {
      stats.push('citedFiles = ?');
      msg.citedFiles = message.citedFiles as string;
      params.push(msg.citedFiles);
    }
    if (!isBlank(message.citedChunks)) {
      stats.push('citedChunks = ?');
      msg.citedChunks = message.citedChunks as string;
      params.push(msg.citedChunks);
    }
    // Add tool-specific field handling
    if (!isNil(message.toolCall)) {
      stats.push('toolCall = json(?)');
      msg.toolCall = message.toolCall;
      params.push(ensureValidJson(message.toolCall));
    }
    
    if (!isNil(message.toolResponse)) {
      stats.push('toolResponse = json(?)');
      msg.toolResponse = message.toolResponse;
      params.push(standardizeToolResponse(message.toolResponse));
    }
    
    if (!isNil(message.isTool)) {
      stats.push('isTool = ?');
      msg.isTool = message.isTool;
      params.push(message.isTool ? 1 : 0);
    }

    if (message.id && stats.length) {
      params.push(msg.id);
      await window.electron.db.run(
        `UPDATE messages SET ${stats.join(', ')} WHERE id = ?`,
        params
      );
      set(
        produce((state: IChatStore) => {
          const index = state.messages.findIndex((m) => m.id === msg.id);
          if (index !== -1) {
            state.messages[index] = { ...state.messages[index], ...msg };
          }
        })
      );
      console.log('[updateMessage] Updated message with tool data:', JSON.stringify(msg));
      return true;
    }
    return false;
  },
  bookmarkMessage: (id: string, bookmarkId: string | null) => {
    const $messages = get().messages.map((msg) => {
      if (msg.id === id) {
        msg.bookmarkId = bookmarkId;
      }
      return msg;
    });
    set({ messages: [...$messages] });
  },
  deleteMessage: async (id: string) => {
    const ok = await window.electron.db.run(
      `DELETE FROM messages WHERE id = ?`,
      [id]
    );
    if (!ok) {
      throw new Error('Delete message failed');
    }
    const messages = [...get().messages];
    if (messages && messages.length) {
      const index = messages.findIndex((msg) => msg.id === id);
      if (index > -1) {
        console.log(`remove msg(${id}) from index: ${index})`);
        messages.splice(index, 1);
        set({ messages: [...messages] });
      }
    }
    return true;
  },
  fetchMessages: async ({
    chatId,
    limit = 100,
    offset = 0,
    keyword = '',
  }: {
    chatId: string;
    limit?: number;
    offset?: number;
    keyword?: string;
  }) => {
    console.log('[fetchMessages] Fetching messages for chat:', chatId);

    if (chatId === tempChatId) {
      console.log('[fetchMessages] Temp chat ID detected, returning empty array');
      set({ messages: [] });
      return [];
    }

    try {
      // First verify table exists and has correct structure
      let tableInfo: Array<{ name: string; type: string }>;
      try {
        tableInfo = await window.electron.db.all("PRAGMA table_info(messages)");
        console.log('[fetchMessages] Table structure:', tableInfo);
      } catch (pragmaError) {
        console.error('[fetchMessages] Failed to get table info:', pragmaError);
        tableInfo = [];
      }

      // Start with basic query
      let sql = `SELECT messages.*, bookmarks.id bookmarkId FROM messages`;

      // Only add JSON functions if table exists and has the columns
      if (tableInfo && tableInfo.length > 0) {
        const hasJsonColumns = tableInfo.some((col: { name: string }) => 
          ['toolCall', 'toolResponse', 'citedFiles', 'citedChunks'].includes(col.name)
        );
        
        if (hasJsonColumns) {
          sql = `SELECT 
            messages.*,
            bookmarks.id bookmarkId,
            CASE 
              WHEN json_valid(messages.toolCall) = 1 THEN messages.toolCall 
              ELSE NULL 
            END as toolCall,
            CASE 
              WHEN json_valid(messages.toolResponse) = 1 THEN messages.toolResponse
              ELSE NULL 
            END as toolResponse,
            CASE 
              WHEN json_valid(messages.citedFiles) = 1 THEN messages.citedFiles 
              ELSE '[]' 
            END as citedFiles,
            CASE 
              WHEN json_valid(messages.citedChunks) = 1 THEN messages.citedChunks 
              ELSE '[]' 
            END as citedChunks
          FROM messages`;
        }
      }

      // Add joins and conditions
      sql += ` LEFT JOIN bookmarks ON bookmarks.msgId = messages.id
        WHERE messages.chatId = ?`;

      let params = [chatId, limit, offset];

      if (keyword && keyword.trim() !== '') {
        sql += ` AND (messages.prompt LIKE ? COLLATE NOCASE OR messages.reply LIKE ? COLLATE NOCASE)`;
        params = [
          chatId,
          `%${keyword.trim()}%`,
          `%${keyword.trim()}%`,
          limit,
          offset,
        ];
      }
      sql += ` ORDER BY messages.createdAt ASC
      LIMIT ? OFFSET ?`;

      console.log('[fetchMessages] SQL:', sql);
      console.log('[fetchMessages] Params:', params);

      interface DBMessage {
        id: string;
        chatId: string;
        systemMessage: string | null;
        prompt: string;
        reply: string;
        model: string;
        temperature: number;
        maxTokens: number | null;
        inputTokens: number;
        outputTokens: number;
        memo: string | null;
        isActive: number;
        citedFiles: string | null;
        citedChunks: string | null;
        isTool: number;
        toolCall: string | null;
        toolResponse: string | null;
        createdAt: number;
        bookmarkId?: string;
      }

      const dbMessages = await window.electron.db.all(sql, params) as DBMessage[];
      if (!dbMessages) {
        console.log('[fetchMessages] No messages found, returning empty array');
        set({ messages: [] });
        return [];
      }

      console.log('[fetchMessages] Raw DB messages:', dbMessages);

      // Parse the JSON strings back into objects with proper typing
      const messages: IChatMessage[] = dbMessages.map((msg: DBMessage) => {
        // Safe defaults
        const defaultToolFields = {
          toolCall: undefined,
          toolResponse: undefined,
          citedFiles: [],
          citedChunks: [],
          isTool: Boolean(msg.isTool)
        };

        try {
          return {
            ...msg,
            ...defaultToolFields,
            toolCall: msg.toolCall ? safeParseJSON(msg.toolCall) : undefined,
            toolResponse: msg.toolResponse ? safeParseJSON(msg.toolResponse) : undefined,
            citedFiles: safeParseJSON(ensureValidJson(msg.citedFiles, []), []),
            citedChunks: safeParseJSON(ensureValidJson(msg.citedChunks, []), [])
          } as IChatMessage;
        } catch (error) {
          console.error(`Error parsing message ${msg.id}:`, error);
          return {
            ...msg,
            ...defaultToolFields,
            citedFiles: JSON.stringify([]),
            citedChunks: JSON.stringify([])
          } as IChatMessage;
        }
      });

      // Filter out messages with invalid JSON
      const validMessages = messages.filter(msg => {
        const hasValidToolData = !msg.isTool || 
          (typeof msg.toolCall !== 'undefined' || typeof msg.toolResponse !== 'undefined');
        return hasValidToolData;
      });

      set({ messages: validMessages });
      return validMessages;
    } catch (error) {
      console.error('[fetchMessages] Error:', error);
      // Return empty array on error to prevent UI issues
      set({ messages: [] });
      return [];
    }
  },
}));

export default useChatStore;
