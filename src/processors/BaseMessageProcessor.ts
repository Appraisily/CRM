import { Message } from '@google-cloud/pubsub';

export abstract class BaseMessageProcessor {
  protected decodeMessage(message: Message): any {
    try {
      return typeof message.data === 'string' 
        ? JSON.parse(message.data)
        : JSON.parse(message.data.toString());
    } catch (error) {
      throw new Error(`Failed to decode message: ${error}`);
    }
  }

  abstract process(message: Message): Promise<void>;
} 