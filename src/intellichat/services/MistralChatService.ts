import OpenAIChatService from './OpenAIChatService';
import Mistral from '../../providers/Mistral';
import { IChatContext } from 'intellichat/types';
import INextChatService from './INextCharService';

export default class MistralChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(chatContext: IChatContext) {
    super(chatContext);
    this.provider = Mistral;
  }

}
