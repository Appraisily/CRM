import { BaseMessageProcessor } from '../../../processors/BaseMessageProcessor';
import { ResetPasswordRequestProcessor } from '../../../processors/ResetPasswordRequestProcessor';
import { Message } from '@google-cloud/pubsub';

// Mock processor for testing purposes
class MockProcessor extends BaseMessageProcessor {
  private processType: string;

  constructor(processType: string) {
    super();
    this.processType = processType;
  }

  async process(message: Message): Promise<any> {
    const data = this.decodeMessage(message);
    console.log(`[MockProcessor] Processing ${this.processType} message:`, data);
    
    // Simply return success for testing
    return {
      success: true,
      email: data.customer?.email || 'test@example.com',
      processType: this.processType,
      timestamp: new Date().toISOString()
    };
  }
}

export class ProcessorFactory {
  getProcessor(processType: string): BaseMessageProcessor {
    switch (processType) {
      case 'resetPasswordRequest':
        return new ResetPasswordRequestProcessor();
      case 'newRegistrationEmail':
      case 'screenerNotification':
      case 'chatSummary':
      case 'gmailInteraction':
      case 'appraisalRequest':
      case 'stripePayment':
      case 'bulkAppraisalFinalized':
        // Use mock processor for testing these types
        return new MockProcessor(processType);
      default:
        throw new Error(`Unknown process type: ${processType}`);
    }
  }
} 