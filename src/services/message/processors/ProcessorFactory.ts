import { BaseMessageProcessor } from '../../../processors/BaseMessageProcessor';
import { ResetPasswordRequestProcessor } from '../../../processors/ResetPasswordRequestProcessor';

export class ProcessorFactory {
  getProcessor(processType: string): BaseMessageProcessor {
    switch (processType) {
      case 'resetPasswordRequest':
        return new ResetPasswordRequestProcessor();
      // Add other processors here
      default:
        throw new Error(`Unknown process type: ${processType}`);
    }
  }
} 