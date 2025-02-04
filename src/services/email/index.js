const michelleService = require('./MichelleService');
const sendGridService = require('./SendGridService');
const analysisClient = require('./AnalysisClient');
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

    return this.screenerProcessor.process(data);
  }
}

module.exports = new EmailService();