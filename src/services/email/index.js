const michelleService = require('./MichelleService');
const sendGridService = require('./SendGridService');
const sheetsService = require('../sheets');
const reportComposer = require('../reportComposer');
const handlers = require('./handlers');

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
    return handlers.handleAnalysisComplete(data);
  }

  async handleGenerateOffer(data) {
    return handlers.handleGenerateOffer(data);
  }

  async handleSendReport(data) {
    return handlers.handleSendReport(data);
  }

  async handleScreenerNotification(data) {
    if (!this.initialized) {
      throw new Error('Email service not initialized');
    }

    let processStatus = {
      emailLogged: false,
      reportSent: false,
      offerScheduled: false
    };

    try {
      // Validate required data
      if (!data?.customer?.email || !data.sessionId || !data.metadata) {
        throw new Error('Missing required fields in screener notification data');
      }

      console.log('\n=== Starting Screener Notification Process ===');
      const { customer, sessionId, metadata, timestamp } = data;
      const notificationTime = timestamp || Date.now();

      try {
        // Step 3: Sheet Logging
        await sheetsService.updateEmailSubmission(
          sessionId,
          customer.email,
          notificationTime,
          'Screener'
        );
        processStatus.emailLogged = true;
        console.log('✓ Email submission logged to sheets');

        // Step 4: Free Report Generation and Delivery
        const reportData = {
          metadata: {
            originalName: metadata.originalName,
            timestamp: notificationTime,
            imageUrl: metadata.imageUrl,
            mimeType: metadata.mimeType,
            size: metadata.size
          },
          analysis: {
            status: 'pending',
            message: 'Your artwork is being analyzed by our AI system.'
          }
        };

        const reportHtml = reportComposer.composeAnalysisReport(
          reportData.metadata,
          {
            visualSearch: null,
            originAnalysis: null,
            detailedAnalysis: null
          }
        );

        await this.sendFreeReport(customer.email, reportHtml);
        await sheetsService.updateFreeReportStatus(
          sessionId,
          true,
          notificationTime
        );
        processStatus.reportSent = true;
        console.log('✓ Free report sent and logged');

        // Step 5: Personal Offer Scheduling
        console.log('\n=== Starting Personal Offer Scheduling ===');
        const scheduledTime = notificationTime + (60 * 60 * 1000); // 1 hour later

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

        // Step 6: Status Updates
        if (personalOffer?.success) {
          await sheetsService.updateOfferStatus(
            sessionId,
            true,
            personalOffer.content,
            scheduledTime
          );
          processStatus.offerScheduled = true;
          console.log(`✓ Personal offer scheduled for ${new Date(scheduledTime).toISOString()}`);
        } else {
          throw new Error('Failed to schedule personal offer');
        }

        console.log('=== Screener Notification Process Complete ===\n');
        return {
          success: true,
          processStatus,
          scheduledTime
        };

      } catch (error) {
        // Step 7: Error Handling
        console.error('\n=== Error in Screener Process ===');
        console.error('Process Status:', processStatus);
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);

        // Log error status to sheets
        try {
          if (!processStatus.reportSent) {
            await sheetsService.updateFreeReportStatus(
              sessionId,
              false,
              notificationTime,
              error.message
            );
          }

          if (!processStatus.offerScheduled) {
            await sheetsService.updateOfferStatus(
              sessionId,
              false,
              error.message
            );
          }
        } catch (logError) {
          console.error('Failed to log error status:', logError);
        }

        return {
          success: false,
          processStatus,
          error: error.message
        };
      }
    } catch (error) {
      console.error('✗ Error in screener notification process:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();