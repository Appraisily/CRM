const michelleService = require('./MichelleService');
const sendGridService = require('./SendGridService');
const analysisClient = require('./AnalysisClient');
const sheetsService = require('../sheets');
const ScreenerProcessor = require('./ScreenerProcessor');

class EmailService {
  constructor() {
    this.initialized = false;
    this.screenerProcessor = null;
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, personalEmail, directApiKey) {
    // Initialize SendGrid service
    sendGridService.initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId);

    // Initialize Michelle service
    michelleService.initialize(directApiKey, fromEmail);

    // Initialize screener processor
    this.screenerProcessor = new ScreenerProcessor(this);

    this.initialized = true;
  }

  async sendPersonalOffer(toEmail, subject, analysisData, scheduledTime = null) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    console.log('\n=== Starting Personal Offer Email Process ===');
    console.log(`Recipient: ${toEmail}`);
    console.log('Analysis data available:', {
      hasDetailedAnalysis: !!analysisData?.detailedAnalysis,
      hasVisualSearch: !!analysisData?.visualSearch,
      hasOriginAnalysis: !!analysisData?.originAnalysis
    });

    try {
      // Wait for detailed analysis if needed
      if (!analysisData?.detailedAnalysis) {
        console.log('Detailed analysis not available, waiting for results...');
        const results = await analysisClient.getAnalysisResults(analysisData.sessionId);
        analysisData = { ...analysisData, ...results };
        console.log('✓ Analysis results loaded');
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
      
      console.log(scheduledTime ? 
        `✓ Personal offer email scheduled for ${new Date(scheduledTime).toISOString()}` :
        '✓ Personal offer email sent immediately'
      );
      
      return result;
    } catch (error) {
      console.error('✗ Error sending personal offer email:', error);
      throw error;
    } finally {
      console.log('=== End Personal Offer Email Process ===\n');
    }
  }

  async sendFreeReport(toEmail, reportData) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    
    return sendGridService.sendFreeReport(toEmail, reportData);
  }

  async handleScreenerNotification(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    
    try {
      console.log('\n=== Starting Screener Notification Process ===');
      const { customer, sessionId, metadata, timestamp } = data;
      const notificationTime = timestamp || Date.now();

      // Log email submission
      await sheetsService.updateEmailSubmission(
        sessionId,
        customer.email,
        notificationTime,
        'Screener'
      );
      console.log('✓ Email submission logged to sheets');

      // Send free report first
      console.log('\n=== Sending Free Report ===');
      // Parse metadata from JSON if it's a string
      const parsedMetadata = typeof metadata === 'string' ? 
        JSON.parse(metadata) : 
        metadata;

      console.log('Parsed metadata:', {
        originalName: parsedMetadata.originalName,
        imageUrl: parsedMetadata.imageUrl,
        mimeType: parsedMetadata.mimeType,
        size: parsedMetadata.size
      });

      const reportData = {
        metadata: {
          originalName: parsedMetadata.originalName,
          timestamp: notificationTime,
          imageUrl: parsedMetadata.imageUrl,
          mimeType: parsedMetadata.mimeType,
          size: parsedMetadata.size
        },
        analysis: {
          status: 'pending',
          message: 'Your artwork is being analyzed by our AI system.'
        }
      };

      console.log('Generating report with data:', reportData);
      const reportHtml = reportComposer.composeAnalysisReport(
        reportData.metadata,
        {
          visualSearch: null,
          originAnalysis: null,
          detailedAnalysis: null
        }
      );
      console.log('Generated HTML report length:', reportHtml.length);

      await this.sendFreeReport(customer.email, reportHtml);
      await sheetsService.updateFreeReportStatus(sessionId, true, notificationTime);
      console.log('✓ Free report sent and logged');

      // Send personal offer with current time
      console.log('\n=== Scheduling Personal Offer ===');
      const currentTime = new Date().toISOString();
      const personalOffer = await this.sendPersonalOffer(
        customer.email,
        null, // Let Michelle's API provide the subject
        {
          sessionId,
          metadata: parsedMetadata,
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
        console.log(`✓ Personal offer scheduled for ${currentTime}`);
      }

      console.log('=== Screener Notification Process Complete ===\n');
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
      console.error('\n=== Error in Screener Process ===');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
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