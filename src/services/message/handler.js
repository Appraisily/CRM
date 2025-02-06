const emailService = require('../email');
const pubSubService = require('../pubsub');
const Logger = require('../../utils/logger');
const { ValidationError, ProcessingError } = require('../../utils/errors');

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
      
      // Parse message data
      let data;
      try {
        data = typeof message.data === 'string' ? 
          JSON.parse(message.data) :
          JSON.parse(message.data.toString());
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
      const validation = validateScreenerNotification(data);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
      }

      // Process the message
      const result = await emailService.handleScreenerNotification({
        customer: data.customer,
        sessionId: data.sessionId,
        metadata: data.metadata,
        timestamp: data.timestamp,
        origin: data.origin
      });

      if (!result.success) {
        throw new ProcessingError(result.error || 'Processing failed without specific error');
      }

      return result.success;

    } catch (error) {
      this.logger.error('Error processing message', error);
      throw error;
    } finally {
      this.logger.end();
    }
  }
}

module.exports = new MessageHandler();