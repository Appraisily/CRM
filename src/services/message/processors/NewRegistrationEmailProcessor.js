const { ValidationError } = require('../../../utils/errors');
const Logger = require('../../../utils/logger');
const emailService = require('../../email');

class NewRegistrationEmailProcessor {
  constructor() {
    this.logger = new Logger('New Registration Email Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing new registration email', {
        recipient: data.customer.email,
        timestamp: data.metadata.timestamp
      });

      // Send welcome email using SendGrid template
      await emailService.sendGridService.sendWelcomeEmail(
        data.customer.email,
        process.env.SENDGRID_NEWREGISTRATION
      );

      this.logger.success('Welcome email sent successfully');
      return {
        success: true,
        emailSent: true,
        timestamp: data.metadata.timestamp
      };

    } catch (error) {
      this.logger.error('Failed to process new registration email', error);
      return {
        success: false,
        emailSent: false,
        error: error.message
      };
    }
  }
}

module.exports = NewRegistrationEmailProcessor; 