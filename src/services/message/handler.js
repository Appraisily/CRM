const emailService = require('../email');
const pubSubService = require('../pubsub');
const databaseService = require('../database');
const chatSummaryProcessor = require('./ChatSummaryProcessor');
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

const validateChatSummary = (data) => {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    chat: 'object',
    metadata: 'object'
  };

  const chatFields = {
    sessionId: 'string',
    startedAt: 'string',
    endedAt: 'string',
    messageCount: 'number',
    satisfactionScore: 'number',
    summary: 'string',
    topics: 'object',
    sentiment: 'string'
  };

  const errors = [];

  // Check top-level fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
    }
  }

  // Check chat object fields
  if (data.chat && typeof data.chat === 'object') {
    for (const [field, type] of Object.entries(chatFields)) {
      if (!data.chat[field]) {
        errors.push(`Missing required field: chat.${field}`);
      } else if (type === 'object' ? !Array.isArray(data.chat[field]) : typeof data.chat[field] !== type) {
        errors.push(`Invalid type for chat.${field}: expected ${type}`);
      }
    }
  }

  // Validate customer email
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
      let validation;
      
      if (data.crmProcess === 'screenerNotification') {
        validation = validateScreenerNotification(data);
      } else if (data.crmProcess === 'chatSummary') {
        validation = validateChatSummary(data);
      } else {
        throw new ValidationError(`Unknown crmProcess: ${data.crmProcess}`);
      }

      if (!validation.isValid) {
        throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
      }

      let result;

      if (data.crmProcess === 'screenerNotification') {
        result = await emailService.handleScreenerNotification({
          customer: data.customer,
          sessionId: data.sessionId,
          metadata: data.metadata,
          timestamp: data.timestamp,
          origin: data.origin
        });
      } else if (data.crmProcess === 'chatSummary') {
        result = await chatSummaryProcessor.processChatSummary(data);
      }

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