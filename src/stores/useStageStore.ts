import { tempChatId } from '../consts';
import Debug from 'debug';
import { produce } from 'immer';
import { IPrompt, IStage } from 'intellichat/types';
import { isNull, isPlainObject, isUndefined } from 'lodash';
import { create } from 'zustand';

const debug = Debug('5ire:stores:useStageStore');

const defaultStage = {
  prompts: {},
  inputs: { },
};
let stage = window.electron.store.get('stage', defaultStage);
if (!isPlainObject(stage)) {
  stage = defaultStage;
}

debug('stage', typeof stage);

export interface IStageStore {
  prompts: { [key: string]: IPrompt | null };
  inputs: { [key: string]: string };
  getPrompt: (chatId: string) => IPrompt | null;
  getInput: (chatId: string) => string;
  editStage: (chatId: string, stage: Partial<IStage>) => void;
  deleteStage: (chatId: string) => void;
}

const useStageStore = create<IStageStore>((set, get) => ({
  prompts: stage.prompts,
  inputs: stage.inputs,
  getPrompt: (chatId: string) => {
    return get().prompts[chatId];
  },
  getInput: (chatId: string) => {
    return get().inputs[chatId];
  },
  editStage: (chatId: string, stage: Partial<IStage>) => {
    set(
      produce((state: IStageStore): void => {
        if (!isUndefined(stage.prompt)) {
          if (isNull(stage.prompt)) {
            state.prompts[chatId] = null;
          } else {
            state.prompts[chatId] = stage.prompt;
          }
        }
        if (!isUndefined(stage.input)) {
          state.inputs[chatId] = stage.input || '';
        }
      })
    );
    const { prompts, inputs } = get();
    window.electron.store.set('stage', { prompts, inputs });
  },
  deleteStage: (chatId: string) => {
    set(
      produce((state: IStageStore): void => {
        delete state.prompts[chatId];
        delete state.inputs[chatId];
      })
    );
    window.electron.store.set('stage', {
      prompts: {},
      inputs: {},
    });
  },
}));

export default useStageStore;
