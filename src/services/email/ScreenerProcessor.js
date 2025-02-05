const sheetsService = require('../sheets');
const cloudServices = require('../storage');

class ScreenerProcessor {
  constructor(emailService) {
    if (!emailService) {
      throw new Error('Email service is required for ScreenerProcessor');
    }
    this.emailService = emailService;
  }

  async processScreenerNotification(data) {
    console.log('\n=== Processing Screener Notification ===');
    try {
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

      // Get the report HTML from GCS
      const bucket = cloudServices.getBucket();
      const reportFile = bucket.file(`images_free_reports/sessions/${sessionId}/report.html`);
      
      console.log(`Fetching report from GCS: images_free_reports/sessions/${sessionId}/report.html`);
      
      const [exists] = await reportFile.exists();
      if (!exists) {
        throw new Error('Report file not found in GCS');
      }
      
      const [reportContent] = await reportFile.download();
      const reportHtml = reportContent.toString();
      console.log('Retrieved HTML report from GCS, length:', reportHtml.length);

      await this.emailService.sendFreeReport(customer.email, reportHtml);
      await sheetsService.updateFreeReportStatus(sessionId, true, notificationTime);
      console.log('✓ Free report sent and logged');

      // Send personal offer
      console.log('Generating personal offer...');
      const currentTime = new Date().toISOString();
      const personalOffer = await this.emailService.sendPersonalOffer(
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
        console.log(`✓ Personal offer scheduled for ${currentTime}`);
      }

      console.log('=== Screener Notification Processing Complete ===\n');
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

module.exports = ScreenerProcessor;