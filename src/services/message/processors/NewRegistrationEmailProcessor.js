const Logger = require('../../../utils/logger');
const { SendGridService } = require('../../email');

class NewRegistrationEmailProcessor {
  constructor() {
    this.logger = new Logger('New Registration Email Processor');
    this.sendGridService = new SendGridService();
  }

  async process(data) {
    try {
      this.logger.info('Processing new registration email', {
        email: data.customer.email,
        name: data.customer.name || 'Valued Customer'
      });

      await this.sendGridService.sendDynamicTemplateEmail({
        to: data.customer.email,
        templateId: process.env.SENDGRID_NEWREGISTRATION,
        dynamicTemplateData: {
          name: data.customer.name || 'Valued Customer',
          email: data.customer.email,
          year: new Date().getFullYear()
        }
      });

      this.logger.success('New registration email sent successfully');
      
      return {
        success: true,
        email: data.customer.email
      };

    } catch (error) {
      this.logger.error('Failed to process new registration email', error);
      throw error;
    }
  }
}

module.exports = NewRegistrationEmailProcessor; 