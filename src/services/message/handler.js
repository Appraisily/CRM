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
      }

      console.log('Parsed message data:', {
        crmProcess: data.crmProcess,
        sessionId: data.sessionId,
        hasCustomer: !!data.customer,
        hasMetadata: !!data.metadata,
        timestamp: data.timestamp
      });

      const validation = validateScreenerNotification(data);
      if (!validation.isValid) {
        throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
      }

      const result = await emailService.handleScreenerNotification({
        customer: data.customer,
        sessionId: data.sessionId,
        metadata: data.metadata,
        timestamp: data.timestamp,
        origin: data.origin
      });

      // Only call ack/nack if they exist (PubSub pull subscription)
      if (message.ack && typeof message.ack === 'function') {
        message.ack();
      }
      return result.success;

    } catch (error) {
      this.logger.error('Error processing message', error);
      await pubSubService.publishToDLQ(message, error);
      
      // Only call ack/nack if they exist (PubSub pull subscription)
      if (message.nack && typeof message.nack === 'function') {
        message.nack();
      }
      throw error;
    } finally {
      this.logger.end();
    }
  }

  async handlePushMessage(req, res) {
    try {
      this.logger.info('Processing PubSub Push Message');

      // Early validation of request body
      if (!req.body || !req.body.message) {
        console.error('No message found in request body');
        console.log('Request body:', req.body);
        return res.status(400).send('No message found');
      }

      // Early acknowledgment to prevent retries
      res.status(204).send();

      const message = req.body.message;

      if (!message.data) {
        this.logger.error('No data field in message');
        await pubSubService.publishToDLQ(message, new Error('No data field in message'));
        return;
      }

      // Decode and parse message data
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString();
        this.logger.info('Decoded message data:', { data: decodedData });

        const data = JSON.parse(decodedData);
        console.log('Received push message:', {
          type: data.crmProcess,
          sessionId: data.sessionId,
          timestamp: data.timestamp
        });

        // Validate message format
        const validation = validateScreenerNotification(data);
        if (!validation.isValid) {
          throw new ValidationError(`Invalid message format: ${validation.errors.join(', ')}`);
        }

        // Process screener notification
        const result = await emailService.handleScreenerNotification(data);
        
        if (!result.success) {
          throw new Error(result.error || 'Processing failed');
        }
        
        this.logger.end();
        
      } catch (processingError) {
        this.logger.error('Error processing message', processingError);
        await pubSubService.publishToDLQ(message, processingError);
        this.logger.end();
      }

    } catch (error) {
      this.logger.error('Error handling push message', error);

      try {
        this.logger.info('Attempting to publish to DLQ');
        if (req.body?.message) {
          await pubSubService.publishToDLQ(req.body.message, error);
        }
      } catch (dlqError) {
        console.error('Failed to publish to DLQ:', dlqError);
      }
    }

    this.logger.end();
  }
}

module.exports = new MessageHandler();