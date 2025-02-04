const sheetsService = require('../sheets');
const reportComposer = require('../reportComposer');

class ScreenerProcessor {
  constructor(emailService) {
    this.emailService = emailService;
  }

  async process(data) {
    let processStatus = {
      emailLogged: false,
      reportSent: false,
      offerScheduled: false
    };

    try {
      if (!data?.customer?.email || !data.sessionId || !data.metadata) {
        throw new Error('Missing required fields in screener notification data');
      }

      console.log('\n=== Starting Screener Notification Process ===');
      const { customer, sessionId, metadata, timestamp } = data;
      const notificationTime = timestamp || Date.now();

      // Log email submission
      await this._logEmailSubmission(sessionId, customer.email, notificationTime);
      processStatus.emailLogged = true;

      // Send free report
      await this._sendFreeReport(sessionId, customer.email, metadata, notificationTime);
      processStatus.reportSent = true;

      // Schedule personal offer
      await this._schedulePersonalOffer(sessionId, customer.email, metadata, notificationTime);
      processStatus.offerScheduled = true;

      console.log('=== Screener Notification Process Complete ===\n');
      return {
        success: true,
        processStatus,
        scheduledTime: notificationTime + (60 * 60 * 1000)
      };

    } catch (error) {
      console.error('\n=== Error in Screener Process ===');
      console.error('Process Status:', processStatus);
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);

      await this._handleErrors(sessionId, notificationTime, processStatus, error);

      return {
        success: false,
        processStatus,
        error: error.message
      };
    }
  }

  async _logEmailSubmission(sessionId, email, timestamp) {
    await sheetsService.updateEmailSubmission(
      sessionId,
      email,
      timestamp,
      'Screener'
    );
    console.log('✓ Email submission logged to sheets');
  }

  async _sendFreeReport(sessionId, email, metadata, timestamp) {
    const reportData = {
      metadata: {
        originalName: metadata.originalName,
        timestamp,
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

    await this.emailService.sendFreeReport(email, reportHtml);
    await sheetsService.updateFreeReportStatus(sessionId, true, timestamp);
    console.log('✓ Free report sent and logged');
  }

  async _schedulePersonalOffer(sessionId, email, metadata, timestamp) {
    console.log('\n=== Starting Personal Offer Scheduling ===');
    const scheduledTime = timestamp + (60 * 60 * 1000); // 1 hour later

    const personalOffer = await this.emailService.sendPersonalOffer(
      email,
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

    if (!personalOffer?.success) {
      throw new Error('Failed to schedule personal offer');
    }

    await sheetsService.updateOfferStatus(
      sessionId,
      true,
      personalOffer.content,
      scheduledTime
    );
    console.log(`✓ Personal offer scheduled for ${new Date(scheduledTime).toISOString()}`);
  }

  async _handleErrors(sessionId, timestamp, processStatus, error) {
    try {
      if (!processStatus.reportSent) {
        await sheetsService.updateFreeReportStatus(
          sessionId,
          false,
          timestamp,
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
  }
}

module.exports = ScreenerProcessor;