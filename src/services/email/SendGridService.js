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
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        templateId: this.bulkAppraisalRecoveryTemplateId,
        dynamicTemplateData: {
          subject: 'Your Bulk Appraisal Submission Details',
          session_id: sessionId,
          year: new Date().getFullYear()
        }
      };

      await sgMail.send(msg);
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
}

module.exports = new SendGridService();