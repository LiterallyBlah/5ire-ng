import Debug from 'debug';
import IChatReader, { ITool } from 'intellichat/readers/IChatReader';
import {
  IAnthropicTool,
  IChatContext,
  IChatRequestMessage,
  IChatRequestMessageContent,
  IChatRequestPayload,
  IGeminiChatRequestMessagePart,
  IGoogleTool,
  IMCPTool,
  IOpenAITool,
} from 'intellichat/types';
import { IServiceProvider } from 'providers/types';
import useSettingsStore from 'stores/useSettingsStore';
import { raiseError, stripHtmlTags } from 'utils/util';

const debug = Debug('5ire:intellichat:NextChatService');

export default abstract class NextCharService {
  abortController: AbortController;
  context: IChatContext;
  provider: IServiceProvider;
  modelMapping: Record<string, string>;
  apiSettings: {
    base: string;
    key: string;
    model: string;
    secret?: string; // baidu
    deploymentId?: string; // azure
  };
  protected abstract getReaderType(): new (
    reader: ReadableStreamDefaultReader<Uint8Array>
  ) => IChatReader;
  protected onCompleteCallback: (result: any) => Promise<void>;
  protected onReadingCallback: (chunk: string) => void;
  protected onToolCallsCallback: (toolName: string) => void;
  protected onErrorCallback: (error: any, aborted: boolean) => void;
  protected usedToolNames: string[] = [];
  protected inputTokens: number = 0;
  protected outputTokens: number = 0;

  constructor({
    context,
    provider,
  }: {
    context: IChatContext;
    provider: IServiceProvider;
  }) {
    this.apiSettings = useSettingsStore.getState().api;
    this.modelMapping = useSettingsStore.getState().modelMapping;
    this.provider = provider;
    this.context = context;
    this.abortController = new AbortController();

    this.onCompleteCallback = () => {
      throw new Error('onCompleteCallback is not set');
    };
    this.onToolCallsCallback = () => {
      throw new Error('onToolCallingCallback is not set');
    };
    this.onReadingCallback = () => {
      throw new Error('onReadingCallback is not set');
    };
    this.onErrorCallback = () => {
      throw new Error('onErrorCallback is not set');
    };
  }

  protected createReader(
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): IChatReader {
    const ReaderType = this.getReaderType();
    return new ReaderType(reader);
  }
  protected abstract makeToolMessages(
    tool: ITool,
    toolResult: any
  ): IChatRequestMessage[];
  protected abstract makeTool(
    tool: IMCPTool
  ): IOpenAITool | IAnthropicTool | IGoogleTool;
  protected abstract makePayload(
    messages: IChatRequestMessage[]
  ): Promise<IChatRequestPayload>;
  protected abstract makeRequest(
    messages: IChatRequestMessage[]
  ): Promise<Response>;

  protected getModelName() {
    const model = this.context.getModel();
    return this.modelMapping[model.name] || model.name;
  }

  public onComplete(callback: (result: any) => Promise<void>) {
    this.onCompleteCallback = callback;
  }
  public onReading(callback: (chunk: string) => void) {
    this.onReadingCallback = callback;
  }

  public onToolCalls(callback: (toolName: string) => void) {
    this.onToolCallsCallback = callback;
  }

  public onError(callback: (error: any, aborted: boolean) => void) {
    this.onErrorCallback = callback;
  }

  protected onReadingError(chunk: string) {
    try {
      const { error } = JSON.parse(chunk);
      console.error(error);
    } catch (err) {
      throw new Error(`Something went wrong`);
    }
  }

  protected async convertPromptContent(
    content: string
  ): Promise<
    | string
    | IChatRequestMessageContent[]
    | IChatRequestMessageContent[]
    | IGeminiChatRequestMessagePart[]
  > {
    return stripHtmlTags(content);
  }

  public abort() {
    this.abortController?.abort();
  }

  public isReady(): boolean {
    const { apiSchema } = this.provider.chat;
    if (apiSchema.includes('model') && !this.apiSettings.model) {
      return false;
    }
    if (apiSchema.includes('base') && !this.apiSettings.base) {
      return false;
    }
    if (apiSchema.includes('key') && !this.apiSettings.key) {
      return false;
    }
    return true;
  }

  public async chat(messages: IChatRequestMessage[]) {
    this.abortController = new AbortController();
    let reply = '';
    let signal = null;
    try {
      signal = this.abortController.signal;
      const response = await this.makeRequest(messages);
      debug('Start Reading:', response.status, response.statusText);
      if (response.status !== 200) {
        const contentType = response.headers.get('content-type');
        let msg, json;
        if (contentType?.includes('application/json')) {
          json = await response.json();
        } else {
          msg = await response.text();
        }
        raiseError(response.status, json, msg);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        this.onErrorCallback(new Error('No reader'), false);
        return;
      }
      const chatReader = this.createReader(reader);
      const readResult = await chatReader.read({
        onError: (err: any) => this.onErrorCallback(err, false),
        onProgress: (chunk: string) => {
          reply += chunk;
          this.onReadingCallback(chunk);
        },
        onToolCalls: this.onToolCallsCallback,
      });
      if (readResult?.inputTokens) {
        this.inputTokens += readResult.inputTokens;
      }
      if (readResult?.outputTokens) {
        this.outputTokens += readResult.outputTokens;
      }
      if (readResult.tool) {
        // console.log('Tool from reader:', JSON.stringify(readResult.tool, null, 2));
        
        const [client, name] = readResult.tool.name.split('--');
        // Create a deep copy of the tool to prevent mutations
        const toolForMessages = structuredClone(readResult.tool);
        
        // console.log('Calling MCP with args:', JSON.stringify(readResult.tool.args, null, 2));
        const toolCallsResult = await window.electron.mcp.callTool({
          client,
          name,
          args: readResult.tool.args,
        });
        
        // console.log('Tool for makeToolMessages:', JSON.stringify(toolForMessages, null, 2));
        const _messages = [
          ...messages,
          ...this.makeToolMessages(toolForMessages, toolCallsResult),
        ] as IChatRequestMessage[];
        await this.chat(_messages);
      } else {
        await this.onCompleteCallback({
          content: reply,
          inputTokens: this.inputTokens,
          outputTokens: this.outputTokens,
        });
        this.inputTokens = 0;
        this.outputTokens = 0;
      }
    } catch (error: any) {
      this.onErrorCallback(error, !!signal?.aborted);
      await this.onCompleteCallback({
        content: reply,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        error: {
          code: error.code || 500,
          message: error.message || error.toString(),
        },
      });
      this.inputTokens = 0;
      this.outputTokens = 0;
    }
  }
}
