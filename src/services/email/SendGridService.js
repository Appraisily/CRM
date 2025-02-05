const sgMail = require('@sendgrid/mail');
const { getFreeReportTemplate } = require('../../templates/emails');

class SendGridService {
  constructor() {
    this.initialized = false;
    this.fromEmail = null;
    this.apiKey = 'SG.mock_key_for_testing_purposes_only';
    this.freeReportTemplateId = null;
    this.personalOfferTemplateId = null;
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId) {
    if (!fromEmail) {
      throw new Error('From email is required');
    }
    
    // Force using mock key for now
    console.log('Using mock SendGrid key for testing');
    sgMail.setApiKey(this.apiKey);
    this.fromEmail = fromEmail;
    this.freeReportTemplateId = freeReportTemplateId;
    this.personalOfferTemplateId = personalOfferTemplateId;
    this.initialized = true;
  }

  async sendPersonalOffer(toEmail, subject, content, scheduledTime = null) {
    if (!this.initialized) {
      throw new Error('SendGrid service not initialized');
    }

    if (!subject) {
      throw new Error('Email subject is required');
    }

    // Always return mock success
    console.log('Mock SendGrid: Would send personal offer to', toEmail);
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
      throw new Error('SendGrid service not initialized');
    }

    try {
      const template = getFreeReportTemplate();
      const escapedReportData = this.escapeHtmlForSendGrid(reportData);
      const htmlContent = template.replace('{{free_report}}', escapedReportData);
      
      // Always return mock success for now
      console.log('Mock SendGrid: Would send free report to', toEmail);
      return true;
    } catch (error) {
      console.error('SendGrid error:', error);
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