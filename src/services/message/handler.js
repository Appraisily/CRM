const emailService = require('../email');
const pubSubService = require('../pubsub');
const Logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

const validateScreenerNotification = (data) => {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    sessionId: 'string',
    metadata: 'object',
    timestamp: 'number'
  };

  const errors = [];

  // Check all required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
    }
  }

  // Additional customer object validation
  if (data.customer && typeof data.customer === 'object') {
    if (!data.customer.email) {
      errors.push('Missing required field: customer.email');
    } else if (typeof data.customer.email !== 'string') {
      errors.push('Invalid type for customer.email: expected string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

class MessageHandler {
  constructor() {
    this.logger = new Logger('Message Handler');
  }

  async handleMessage(message) {
    try {
      this.logger.info('Processing PubSub Message');
      let data;
      
      try {
        data = typeof message.data === 'string' ? 
          JSON.parse(message.data) :
          JSON.parse(message.data.toString());
      } catch (parseError) {
        this.logger.error('Failed to parse message', parseError);
        await pubSubService.publishToDLQ(message, parseError);
        if (message.nack) message.nack();
        return false;
      
      // Validate message structure
      if (!message || !message.data) {
        throw new ValidationError('Invalid message structure: missing data');
      }
      
      let data;
      try {
        data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      } catch (parseError) {
        throw new ValidationError(`Failed to parse message data: ${parseError.message}`);
      }

      this.logger.info('Parsed message data:', {
        crmProcess: data.crmProcess,
        sessionId: data.sessionId,
        hasCustomer: !!data.customer,
        hasMetadata: !!data.metadata,
        timestamp: data.timestamp
      });
      
      // Validate message content
      if (!data.crmProcess) {
        throw new ValidationError('Missing required field: crmProcess');
      }

      // Validate message format based on process type
      const validation = validateScreenerNotification(data);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
      }

      let result;
      try {
        result = await emailService.handleScreenerNotification({
          customer: data.customer,
          sessionId: data.sessionId,
          metadata: data.metadata,
          timestamp: data.timestamp,
          origin: data.origin
        });
      } catch (processError) {
        throw new ProcessingError(`Failed to process screener notification: ${processError.message}`);
      }

      if (!result.success) {
        throw new ProcessingError(result.error || 'Processing failed without specific error');
      }

      this.logger.success('Message processed successfully', {
        sessionId: data.sessionId,
        processStatus: result.processStatus
      });

      return result.success;

    } catch (error) {
      // Log different types of errors appropriately
      if (error instanceof ValidationError) {
        this.logger.error('Message validation failed', error);
      } else if (error instanceof ProcessingError) {
        this.logger.error('Message processing failed', error);
      } else {
        this.logger.error('Unexpected error during message handling', error);
      }

      // Attempt to publish to DLQ if available
      try {
        await pubSubService.publishToDLQ(message, error);
      } catch (dlqError) {
        this.logger.error('Failed to publish to DLQ', dlqError);
      }

      throw error;
    } finally {
      this.logger.end();
    }
  }
}

module.exports = new MessageHandler();