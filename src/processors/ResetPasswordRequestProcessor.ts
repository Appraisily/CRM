import { Message } from '@google-cloud/pubsub';
import { SendGridService } from '../services/SendGridService';
import { BaseMessageProcessor } from './BaseMessageProcessor';

interface ResetPasswordRequestMessage {
  crmProcess: 'resetPasswordRequest';
  customer: {
    email: string;
  };
  token: string;
  metadata: {
    timestamp: number;
  };
}

export class ResetPasswordRequestProcessor extends BaseMessageProcessor {
  private sendGridService: SendGridService;

  constructor() {
    super();
    this.sendGridService = new SendGridService();
  }

  async validateMessage(message: Message): Promise<ResetPasswordRequestMessage> {
    const data = this.decodeMessage(message);

    if (!data.crmProcess || data.crmProcess !== 'resetPasswordRequest') {
      throw new Error('Invalid message type');
    }

    if (!data.customer?.email) {
      throw new Error('Missing customer email');
    }

    if (!data.token) {
      throw new Error('Missing reset token');
    }

    return data as ResetPasswordRequestMessage;
  }

  async process(message: Message): Promise<void> {
    const data = await this.validateMessage(message);

    try {
      await this.sendGridService.sendDynamicTemplateEmail({
        to: data.customer.email,
        templateId: process.env.SENDGRID_RESETPASSWORD as string,
        dynamicTemplateData: {
          token: data.token,
          year: new Date().getFullYear()
        }
      });

      console.log(`Password reset email sent to ${data.customer.email}`);
      await message.ack();
    } catch (error) {
      console.error('Error processing reset password request:', error);
      await message.nack();
      throw error;
    }
  }
} 