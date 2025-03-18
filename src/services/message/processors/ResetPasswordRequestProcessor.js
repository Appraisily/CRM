const { ValidationError } = require('../../../utils/errors');
const Logger = require('../../../utils/logger');
const emailService = require('../../email');

class ResetPasswordRequestProcessor {
  constructor() {
    this.logger = new Logger('Reset Password Request Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing password reset request', {
        recipient: data.customer.email,
        timestamp: data.metadata.timestamp
      });

      // Send reset password email using SendGrid template
      await emailService.sendGridService.sendPasswordResetEmail(
        data.customer.email,
        data.token,
        process.env.SENDGRID_RESETPASSWORD
      );

      this.logger.success('Password reset email sent successfully');
      return {
        success: true,
        emailSent: true,
        timestamp: data.metadata.timestamp
      };

    } catch (error) {
      this.logger.error('Failed to process password reset request', error);
      return {
        success: false,
        emailSent: false,
        error: error.message
      };
    }
  }
}

module.exports = ResetPasswordRequestProcessor; 