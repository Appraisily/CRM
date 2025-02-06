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
    this.logger = new Logger('SendGrid Service');
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId) {
    if (!apiKey || !fromEmail) {
      throw new InitializationError('API key and from email are required');
    }
    
    this.logger.info('Initializing SendGrid with provided API key');
    this.apiKey = apiKey;
    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.freeReportTemplateId = freeReportTemplateId;
    this.personalOfferTemplateId = personalOfferTemplateId;
    this.initialized = true;
  }

  async sendPersonalOffer(toEmail, subject, content, scheduledTime = null) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    if (!subject) {
      throw new ValidationError('Email subject is required');
    }

    try {
      const msg = {
        to: toEmail,
        from: this.fromEmail,
        subject: subject,
        html: content,
        templateId: this.personalOfferTemplateId,
        sendAt: scheduledTime ? Math.floor(scheduledTime / 1000) : undefined
      };

      await sgMail.send(msg);
      
      return {
        success: true,
        timestamp: Date.now(),
        subject,
        content,
        contentLength: content.length,
        recipient: toEmail,
        scheduledTime
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
          free_report: reportData
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