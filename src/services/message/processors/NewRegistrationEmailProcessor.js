const Logger = require('../../../utils/logger');
const sendGridService = require('../../email/SendGridService');

class NewRegistrationEmailProcessor {
  constructor() {
    this.logger = new Logger('New Registration Email Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing new registration email', {
        email: data.customer.email,
        name: data.customer.name || 'Valued Customer'
      });

      const msg = {
        to: data.customer.email,
        from: sendGridService.fromEmail,
        templateId: process.env.SENDGRID_NEWREGISTRATION,
        dynamicTemplateData: {
          name: data.customer.name || 'Valued Customer',
          email: data.customer.email,
          year: new Date().getFullYear()
        }
      };

      await sendGridService.send(msg);

      this.logger.success('New registration email sent successfully');
      
      return {
        success: true,
        email: data.customer.email
      };

    } catch (error) {
      this.logger.error('Failed to process new registration email', error);
      // Don't throw error, return failure but allow message processing to continue
      return {
        success: false,
        error: `Email sending failed: ${error.message}`,
        email: data.customer.email
      };
    }
  }
}

module.exports = NewRegistrationEmailProcessor; 