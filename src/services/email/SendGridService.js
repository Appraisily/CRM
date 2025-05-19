const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../../templates/emails');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class SendGridService {
  constructor() {
    this.initialized = false;
    this.fromEmail = null;
    this.apiKey = null;
    this.freeReportTemplateId = null;
    this.personalOfferTemplateId = null;
    this.bulkAppraisalRecoveryTemplateId = null;
    this.logger = new Logger('SendGrid Service');
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, bulkAppraisalRecoveryTemplateId) {
    if (!apiKey || !fromEmail) {
      throw new InitializationError('API key and from email are required');
    }
    
    this.logger.info('Initializing SendGrid service', {
      hasApiKey: !!apiKey,
      fromEmail,
      templates: {
        freeReport: !!freeReportTemplateId,
        personalOffer: !!personalOfferTemplateId,
        bulkAppraisalRecovery: !!process.env.SENDGRID_BULK_APPRAISAL_RESUBMISSION
      }
    });

    this.apiKey = apiKey;
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.freeReportTemplateId = freeReportTemplateId;
    this.personalOfferTemplateId = personalOfferTemplateId;
    this.bulkAppraisalRecoveryTemplateId = process.env.SENDGRID_BULK_APPRAISAL_RESUBMISSION;

    if (!this.bulkAppraisalRecoveryTemplateId) {
      this.logger.error('Missing bulk appraisal recovery template ID');
    }

    this.initialized = true;
    this.logger.success('SendGrid service initialized');
  }

  async sendBulkAppraisalRecovery(toEmail, sessionId) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!this.bulkAppraisalRecoveryTemplateId) {
      throw new Error('SENDGRID_BULK_APPRAISAL_RESUBMISSION environment variable not set');
    }

    this.logger.info('Sending bulk appraisal recovery email', {
      to: toEmail,
      sessionId,
      templateId: this.bulkAppraisalRecoveryTemplateId
    });

    try {
      // Create the recovery link with the session ID
      const recoveryLink = `https://appraisily.com/bulk-appraisal/upload?session_id=${sessionId}`;
      
      this.logger.info('Generating recovery link for email', { 
        recoveryLink,
        sessionId
      });

      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: this.bulkAppraisalRecoveryTemplateId,
        dynamicTemplateData: {
          subject: 'Your Bulk Appraisal Submission Details',
          session_id: sessionId,
          customer_name: toEmail.split('@')[0], // Basic personalization using email username
          recovery_link: recoveryLink, // Add the recovery link for the template
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
      this.logger.success('Bulk appraisal recovery email sent successfully', {
        to: toEmail,
        recoveryLink
      });
      return true;
    } catch (error) {
      this.logger.error('SendGrid error sending bulk appraisal recovery email', {
        error: error.message,
        response: error.response?.body,
        code: error.code,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendPersonalOffer(toEmail, subject, content, scheduledTime = null) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!subject) {
      throw new ValidationError('Email subject is required');
    }

    try {
      // Calculate sendAt time (current time + 1 hour if no specific time provided)
      let sendAtTimestamp;
      if (scheduledTime) {
        // Handle different time formats
        const timeValue = typeof scheduledTime === 'string' ? 
          new Date(scheduledTime).getTime() : 
          (typeof scheduledTime === 'number' ? scheduledTime : null);

        if (!timeValue || isNaN(timeValue)) {
          throw new Error('Invalid scheduledTime format');
        }
        sendAtTimestamp = Math.floor(timeValue / 1000);
      } else {
        // Default to current time + 1 hour (in seconds)
        sendAtTimestamp = Math.floor((Date.now() + (60 * 60 * 1000)) / 1000);
      }

      // Validate the timestamp is in the future
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (sendAtTimestamp <= currentTimestamp) {
        this.logger.info('Scheduled time is in the past, using current time + 1 hour');
        sendAtTimestamp = currentTimestamp + (60 * 60);
      }

      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: this.personalOfferTemplateId,
        dynamicTemplateData: {
          subject: subject,
          email_content: content
        },
        sendAt: sendAtTimestamp
      };

      await sgMail.send(msg);
      
      return {
        success: true,
        timestamp: Date.now(),
        subject,
        content,
        contentLength: content.length,
        recipient: toEmail,
        scheduledTime: sendAtTimestamp * 1000 // Convert back to milliseconds for consistency
      };
    } catch (error) {
      this.logger.error('SendGrid error sending personal offer', error);
      throw error;
    }
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    try {
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: this.freeReportTemplateId,
        dynamicTemplateData: {
          subject: 'Your Free Art Analysis Report',
          free_report: reportData // Pass the raw HTML directly for {{{free_report}}}
        }
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      this.logger.error('SendGrid error', error);
      throw error;
    }
  }

  async sendWelcomeEmail(toEmail, templateId) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!templateId) {
      throw new Error('SENDGRID_NEWREGISTRATION template ID is required');
    }

    this.logger.info('Sending welcome email', {
      to: toEmail,
      templateId
    });

    try {
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: templateId,
        dynamicTemplateData: {
          subject: 'Welcome to Appraisily',
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      this.logger.error('SendGrid error sending welcome email', {
        error: error.message,
        response: error.response?.body,
        code: error.code,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendPasswordResetEmail(toEmail, token, templateId) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!templateId) {
      throw new Error('SENDGRID_RESETPASSWORD template ID is required');
    }

    if (!token) {
      throw new Error('Reset password token is required');
    }

    this.logger.info('Sending password reset email', {
      to: toEmail,
      templateId
    });

    try {
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: templateId,
        dynamicTemplateData: {
          subject: 'Reset Your Password',
          token: token,
          current_year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
      return true;
    } catch (error) {
      this.logger.error('SendGrid error sending password reset email', {
        error: error.message,
        response: error.response?.body,
        code: error.code,
        statusCode: error.statusCode
      });
      throw error;
    }
  }

  async sendDynamicTemplateEmail(toEmail, templateId, dynamicTemplateData, metadata = {}) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!templateId) {
      throw new Error('Template ID is required for sending a dynamic templated email.');
    }

    this.logger.info('Sending dynamic templated email', {
      to: toEmail,
      templateId,
      hasDynamicData: !!dynamicTemplateData,
      metadata
    });

    try {
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: templateId,
        dynamicTemplateData: dynamicTemplateData,
        // You might want to add customArgs or other SendGrid features here if needed
        // customArgs: metadata  // Example: if you want to pass metadata for tracking
      };

      if (metadata && Object.keys(metadata).length > 0) {
        msg.customArgs = metadata; // Pass metadata as custom arguments if provided
      }

      const [response] = await sgMail.send(msg);
      this.logger.success('Dynamic templated email sent successfully', {
        to: toEmail,
        templateId,
        messageId: response?.[0]?.headers?.['x-message-id'] // sgMail.send(msg) returns [response, body] for single email
      });
      return { 
        success: true, 
        messageId: response?.[0]?.headers?.['x-message-id'] 
      };
    } catch (error) {
      this.logger.error('SendGrid error sending dynamic templated email', {
        error: error.message,
        response: error.response?.body,
        code: error.code,
        statusCode: error.statusCode,
        templateId,
        metadata
      });
      throw new ProcessingError(`Failed to send dynamic templated email (Template ID: ${templateId}): ${error.message}`);
    }
  }
}

module.exports = new SendGridService();