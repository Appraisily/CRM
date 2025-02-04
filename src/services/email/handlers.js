const emailService = require('./index');
const sheetsService = require('../sheets');

class EmailHandlers {
  async handleAnalysisComplete(data) {
    console.log('\n=== Processing Analysis Complete ===');
    try {
      const { sessionId, analysisResults } = data;
      if (!sessionId || !analysisResults) {
        throw new Error('Missing required fields in analysis complete data');
      }

      await sheetsService.updateVisualSearchResults(
        sessionId,
        analysisResults,
        analysisResults.openai?.category || 'Unknown'
      );

      console.log('✓ Analysis results logged to sheets');
      console.log('=== Analysis Complete Processing Done ===\n');
    } catch (error) {
      console.error('✗ Error processing analysis complete:', error);
      throw error;
    }
  }

  async handleGenerateOffer(data) {
    console.log('\n=== Processing Generate Offer ===');
    try {
      const { sessionId, email, analysisData } = data;
      if (!sessionId || !email || !analysisData) {
        throw new Error('Missing required fields in generate offer data');
      }

      const scheduledTime = Date.now() + (60 * 60 * 1000); // 1 hour from now
      const result = await emailService.sendPersonalOffer(
        email,
        'Special Professional Appraisal Offer',
        analysisData,
        scheduledTime
      );

      if (result.success) {
        await sheetsService.updateOfferStatus(
          sessionId,
          true,
          result.content,
          scheduledTime
        );
        console.log('✓ Offer scheduled successfully');
      } else {
        throw new Error('Failed to schedule offer');
      }

      console.log('=== Generate Offer Processing Done ===\n');
    } catch (error) {
      console.error('✗ Error processing generate offer:', error);
      throw error;
    }
  }

  async handleSendReport(data) {
    console.log('\n=== Processing Send Report ===');
    try {
      const { sessionId, email, reportData } = data;
      if (!sessionId || !email || !reportData) {
        throw new Error('Missing required fields in send report data');
      }

      await emailService.sendFreeReport(email, reportData);
      await sheetsService.updateFreeReportStatus(
        sessionId,
        true,
        Date.now()
      );

      console.log('✓ Report sent successfully');
      console.log('=== Send Report Processing Done ===\n');
    } catch (error) {
      console.error('✗ Error processing send report:', error);
      await sheetsService.updateFreeReportStatus(
        data.sessionId,
        false,
        Date.now(),
        error.message
      );
      throw error;
    }
  }
}

module.exports = new EmailHandlers();