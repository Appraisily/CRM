const michelleService = require('./MichelleService');
const sendGridService = require('./SendGridService');
const analysisClient = require('./AnalysisClient');
const cloudServices = require('../storage');
const sheetsService = require('../sheets');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class EmailService {
  constructor() {
    this.initialized = false;
    this.logger = new Logger('Email Service');
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, personalEmail, directApiKey) {
    try {
      // Initialize SendGrid service
      sendGridService.initialize(
        apiKey,
        fromEmail,
        freeReportTemplateId,
        personalOfferTemplateId,
        process.env.SEND_GRID_TEMPLATE_BULK_RECOVERY
      );

      // Initialize Michelle service
      michelleService.initialize(directApiKey, fromEmail);

      this.initialized = true;
    } catch (error) {
      throw new InitializationError(`Failed to initialize email service: ${error.message}`);
    }
  }

  async sendBulkAppraisalRecovery(toEmail, sessionId) {
    if (!this.initialized) {
      throw new InitializationError('Email service not initialized');
    }
    
    return sendGridService.sendBulkAppraisalRecovery(toEmail, sessionId);
  }

  async sendPersonalOffer(toEmail, subject, analysisData, scheduledTime = null) {
    if (!this.initialized) {
      throw new InitializationError('Email service not initialized');
    }

    this.logger.info('Starting Personal Offer Email Process', {
      recipient: toEmail,
      initialState: {
        hasDetailedAnalysis: !!analysisData?.detailedAnalysis,
        hasVisualSearch: !!analysisData?.visualSearch,
        hasOriginAnalysis: !!analysisData?.originAnalysis
      }
    });

    try {
      // Wait for detailed analysis if needed
      if (!analysisData?.detailedAnalysis) {
        this.logger.info('Analysis data not available, fetching from GCS...');
        const results = await analysisClient.getAnalysisResults(analysisData.sessionId);
        analysisData = { ...analysisData, ...results };
        this.logger.success('Analysis data loaded successfully', {
          finalState: {
            hasDetailedAnalysis: !!analysisData?.detailedAnalysis,
            hasVisualSearch: !!analysisData?.visualSearch,
            hasOriginAnalysis: !!analysisData?.originAnalysis
          }
        });
      }

      // Generate email content
      const { subject: generatedSubject, content } = await michelleService.generateContent(analysisData);
      
      // Send email with scheduling
      const result = await sendGridService.sendPersonalOffer(
        toEmail, 
        subject || generatedSubject, 
        content,
        scheduledTime
      );
      
      this.logger.success(scheduledTime ? 
        `✓ Personal offer email scheduled for ${new Date(scheduledTime).toISOString()}` :
        '✓ Personal offer email sent immediately'
      );
      
      return result;
    } catch (error) {
      this.logger.error('Error sending personal offer email', error);
      throw new ProcessingError(`Failed to send personal offer: ${error.message}`);
    } finally {
      this.logger.end();
    }
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new InitializationError('Email service not initialized');
    }
    
    return sendGridService.sendFreeReport(toEmail, reportData);
  }

  async handleScreenerNotification(data) {
    if (!this.initialized) {
      throw new InitializationError('Email service not initialized');
    }
    
    try {
      this.logger.info('Starting Screener Notification Process');
      const { customer, sessionId, metadata, timestamp } = data;
      const notificationTime = timestamp || Date.now();

      // Log email submission
      await sheetsService.updateEmailSubmission(
        sessionId,
        customer.email,
        notificationTime,
        'Screener'
      );
      this.logger.success('Email submission logged to sheets');

      // Send free report first
      this.logger.info('Sending Free Report');
      
      // Get the report HTML from GCS
      const reportPath = `sessions/${sessionId}/report.html`;
      console.log(`Fetching report from GCS: ${reportPath}`);
      
      const bucket = cloudServices.getBucket();
      const reportFile = bucket.file(reportPath);
      
      const [exists] = await reportFile.exists();
      if (!exists) {
        throw new ProcessingError(`Report file not found in GCS: ${reportPath}`);
      }
      
      const [reportContent] = await reportFile.download();
      const reportHtml = reportContent.toString();
      console.log('Retrieved HTML report from GCS, length:', reportHtml.length);

      await this.sendFreeReport(customer.email, reportHtml);
      await sheetsService.updateFreeReportStatus(sessionId, true, notificationTime);
      this.logger.success('Free report sent and logged');

      // Send personal offer with current time
      this.logger.info('Scheduling Personal Offer');
      const currentTime = new Date().toISOString();
      const personalOffer = await this.sendPersonalOffer(
        customer.email,
        null, // Let Michelle's API provide the subject
        {  
          sessionId,
          metadata,
          detailedAnalysis: null,
          visualSearch: null,
          originAnalysis: null
        },
        currentTime
      );

      if (personalOffer?.success) {
        await sheetsService.updateOfferStatus(
          sessionId,
          true,
          personalOffer.content,
          currentTime
        );
        this.logger.success(`Personal offer scheduled for ${currentTime}`);
      }

      this.logger.end();
      return {
        success: true,
        processStatus: {
          emailLogged: true,
          reportSent: true,
          offerScheduled: personalOffer?.success || false
        },
        currentTime
      };

    } catch (error) {
      this.logger.error('Error in screener notification process', error);
      
      return {
        success: false,
        processStatus: {
          emailLogged: false,
          reportSent: false,
          offerScheduled: false
        },
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();