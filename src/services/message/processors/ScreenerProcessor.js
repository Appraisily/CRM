const emailService = require('../../email');
const Logger = require('../../../utils/logger');

class ScreenerProcessor {
  constructor() {
    this.logger = new Logger('Screener Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing screener notification', {
        sessionId: data.sessionId,
        timestamp: data.timestamp
      });

      const result = await emailService.handleScreenerNotification({
        customer: data.customer,
        sessionId: data.sessionId,
        metadata: data.metadata,
        timestamp: data.timestamp,
        origin: data.origin
      });

      this.logger.success('Screener notification processed successfully');
      return result;

    } catch (error) {
      this.logger.error('Failed to process screener notification', error);
      throw error;
    }
  }
}

module.exports = ScreenerProcessor;