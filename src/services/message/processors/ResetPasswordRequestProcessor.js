const Logger = require('../../../utils/logger');
const { SendGridService } = require('../../email');

class ResetPasswordRequestProcessor {
  constructor() {
    this.logger = new Logger('Reset Password Request Processor');
    this.sendGridService = new SendGridService();
  }

  async process(data) {
    try {
      this.logger.info('Processing reset password request', {
        email: data.customer.email
      });

      await this.sendGridService.sendDynamicTemplateEmail({
        to: data.customer.email,
        templateId: process.env.SENDGRID_RESETPASSWORD,
        dynamicTemplateData: {
          token: data.token,
          email: data.customer.email,
          year: new Date().getFullYear()
        }
      });

      this.logger.success('Reset password email sent successfully');
      
      return {
        success: true,
        email: data.customer.email
      };

    } catch (error) {
      this.logger.error('Failed to process reset password request', error);
      throw error;
    }
  }
}

module.exports = ResetPasswordRequestProcessor; 