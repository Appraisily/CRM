const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../../templates/emails');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class SendGridService {
  constructor() {
    this.initialized = false;
    this.fromEmail = null;
    this.apiKey = 'SG.mock_key_for_testing_purposes_only';
    this.freeReportTemplateId = null;
    this.personalOfferTemplateId = null;
    this.logger = new Logger('SendGrid Service');
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId) {
    if (!fromEmail) {
      throw new InitializationError('From email is required');
    }
    
    // Force using mock key for now
    this.logger.info('Using mock SendGrid key for testing');
    sgMail.setApiKey(this.apiKey);
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

    // Always return mock success
    this.logger.info('Mock SendGrid: Would send personal offer', { toEmail });
    return {
      success: true,
      timestamp: Date.now(),
      subject,
      content,
      contentLength: content.length,
      recipient: toEmail,
      scheduledTime,
      mock: true
    };
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new InitializationError('SendGrid service not initialized');
    }

    try {
      const template = getFreeReportTemplate();
      const escapedReportData = this.escapeHtmlForSendGrid(reportData);
      const htmlContent = template.replace('{{free_report}}', escapedReportData);
      
      // Always return mock success for now
      this.logger.info('Mock SendGrid: Would send free report', { toEmail });
      return true;
    } catch (error) {
      this.logger.error('SendGrid error', error);
      throw error;
    }
  }

  escapeHtmlForSendGrid(text) {
    return text
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = new SendGridService();