const michelleService = require('./MichelleService');
const sendGridService = require('./SendGridService');

class EmailService {
  constructor() {
    this.initialized = false;
  }

  initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId, personalEmail, directApiKey) {
    // Initialize SendGrid service
    sendGridService.initialize(apiKey, fromEmail, freeReportTemplateId, personalOfferTemplateId);

    // Initialize Michelle service
    michelleService.initialize(directApiKey, fromEmail);

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
        const detailedAnalysis = await analysisService.waitForDetailedAnalysis(analysisData.sessionId);
        
        if (!detailedAnalysis) {
          throw new Error('Detailed analysis not available after waiting');
        }
        
        analysisData.detailedAnalysis = detailedAnalysis;
        console.log('✓ Detailed analysis loaded successfully');
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

  async handleAnalysisComplete(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    // Implementation will be added
  }

  async handleGenerateOffer(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    // Implementation will be added
  }

  async handleSendReport(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }
    // Implementation will be added
  }

  async handleScreenerNotification(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    console.log('\n=== Starting Screener Notification Process ===');
    const { customer, sessionId, metadata, timestamp } = data;
    
    try {
      // Log email submission to sheets
      await sheetsService.updateEmailSubmission(sessionId, customer.email);
      console.log('✓ Email logged to sheets');

      // Generate and send free report
      const reportHtml = reportComposer.composeAnalysisReport(metadata, {
        visualSearch: null,
        originAnalysis: null,
        detailedAnalysis: null
      });
      
      await this.sendFreeReport(customer.email, reportHtml);
      console.log('✓ Free report sent');

      // Update free report status in sheets
      await sheetsService.updateFreeReportStatus(sessionId, true);
      console.log('✓ Free report status updated');

      // Schedule personal offer for 1 hour later
      const scheduledTime = timestamp + (60 * 60 * 1000); // 1 hour from notification time
      
      const personalOffer = await this.sendPersonalOffer(
        customer.email,
        'Special Professional Appraisal Offer',
        {
          sessionId,
          metadata,
          detailedAnalysis: null,
          visualSearch: null,
          originAnalysis: null
        },
        scheduledTime
      );

      if (personalOffer?.success) {
        await sheetsService.updateOfferStatus(
          sessionId,
          true,
          personalOffer.content || 'No content available',
          scheduledTime
        );
        console.log('✓ Personal offer scheduled');
      }

      console.log('=== Screener Notification Process Complete ===\n');
    } catch (error) {
      console.error('✗ Error in screener notification process:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }
}

module.exports = new EmailService();