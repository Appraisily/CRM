const Logger = require('../../../utils/logger');
const sendGridService = require('../../email/SendGridService');

class ResetPasswordRequestProcessor {
  constructor() {
    this.logger = new Logger('Reset Password Request Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing reset password request', {
        email: data.customer.email
      });

      const msg = {
        to: data.customer.email,
        from: sendGridService.fromEmail,
        templateId: process.env.SENDGRID_RESETPASSWORD,
        dynamicTemplateData: {
          token: data.token,
          email: data.customer.email,
          year: new Date().getFullYear()
        }
      };

      await sendGridService.send(msg);

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