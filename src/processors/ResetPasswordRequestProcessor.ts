import { Message } from '@google-cloud/pubsub';
import { SendGridService } from '../services/SendGridService';
import { BaseMessageProcessor } from './BaseMessageProcessor';

interface ResetPasswordRequestMessage {
  crmProcess: 'resetPasswordRequest';
  customer: {
    email: string;
    isTestMessage?: boolean;
  };
  token: string;
  metadata: {
    timestamp: number;
    isTest?: boolean;
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

  async process(message: Message): Promise<any> {
    const data = await this.validateMessage(message);
    
    // Initialize SendGrid if this isn't a test and we haven't initialized yet
    try {
      // For test messages, we'll skip actual sending and just return success
      const isTestMessage = data.customer.email.includes('ratonxi@gmail.com') || 
                          data.customer.isTestMessage;
      
      if (isTestMessage) {
        console.log(`[TEST] Password reset email would be sent to ${data.customer.email}`);
        
        // If message has ack method (real Message object), acknowledge it
        if (typeof message.ack === 'function') {
          await message.ack();
        }
        
        return {
          success: true,
          email: data.customer.email,
          token: data.token,
          type: 'resetPasswordRequest',
          test: true
        };
      }
      
      // This is a real message, process it normally
      await this.sendGridService.sendDynamicTemplateEmail({
        to: data.customer.email,
        templateId: process.env.SENDGRID_RESETPASSWORD as string,
        dynamicTemplateData: {
          token: data.token,
          year: new Date().getFullYear()
        }
      });

      console.log(`Password reset email sent to ${data.customer.email}`);
      
      // If message has ack method (real Message object), acknowledge it
      if (typeof message.ack === 'function') {
        await message.ack();
      }
      
      return {
        success: true,
        email: data.customer.email
      };
    } catch (error) {
      console.error('Error processing reset password request:', error);
      
      // If message has nack method (real Message object), negatively acknowledge it
      if (typeof message.nack === 'function') {
        await message.nack();
      }
      
      throw error;
    }
  }
} 