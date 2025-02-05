const emailService = require('../email');
const pubSubService = require('../pubsub');

const MAX_DLQ_RETRIES = 3;

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
  async handleMessage(message) {
    try {
      console.log('\n=== Processing PubSub Message ===');
      console.log('Raw message data:', message.data);

      // Check if this is a DLQ message
      let data;
      const messageStr = message.data.toString();
      const isDLQMessage = messageStr.includes('originalMessage') && messageStr.includes('error');

      if (isDLQMessage) {
        try {
          const dlqData = JSON.parse(messageStr);
          // Check retry count
          const retryCount = dlqData.retryCount || 0;
          if (retryCount >= MAX_DLQ_RETRIES) {
            console.log(`Message exceeded maximum retry count (${MAX_DLQ_RETRIES}), dropping message`);
            if (message.ack) message.ack();
            return false;
          }
          // Parse the original message
          data = JSON.parse(dlqData.originalMessage);
        } catch (parseError) {
          console.error('Failed to parse DLQ message:', parseError);
          if (message.ack) message.ack(); // Drop malformed DLQ messages
          return false;
        }
      } else {
        try {
          data = typeof message.data === 'string' ? 
            JSON.parse(message.data) :
            JSON.parse(message.data.toString());
        } catch (parseError) {
          console.error('Failed to parse message:', parseError);
          // Only publish to DLQ if this is not already a DLQ message
          await pubSubService.publishToDLQ(message, parseError);
          if (message.nack) message.nack();
          return false;
        }
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
        throw new Error(`Invalid message format: ${validation.errors.join(', ')}`);
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
      console.error('Error processing message:', error);
      
      // Only publish to DLQ if this is not already a DLQ message
      const messageStr = message.data.toString();
      const isDLQMessage = messageStr.includes('originalMessage') && messageStr.includes('error');
      
      if (!isDLQMessage) {
        await pubSubService.publishToDLQ(message, error);
      }
      
      // Only call ack/nack if they exist (PubSub pull subscription)
      if (message.nack && typeof message.nack === 'function') {
        message.nack();
      }
      throw error;
    }
  }

  async handlePushMessage(req, res) {
    try {
      console.log('\n=== Processing PubSub Push Message ===');

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
        console.error('No data field in message');
        await pubSubService.publishToDLQ(message, new Error('No data field in message'));
        return;
      }

      // Decode and parse message data
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString();
        console.log('Decoded message data:', decodedData);

        const data = JSON.parse(decodedData);
        console.log('Received push message:', {
          type: data.crmProcess,
          sessionId: data.sessionId,
          timestamp: data.timestamp
        });

        // Validate message format
        const validation = validateScreenerNotification(data);
        if (!validation.isValid) {
          throw new Error(`Invalid message format: ${validation.errors.join(', ')}`);
        }

        // Process screener notification
        const result = await emailService.handleScreenerNotification(data);
        
        if (!result.success) {
          throw new Error(result.error || 'Processing failed');
        }
        
        console.log('=== Push Message Processing Complete ===\n');
        
      } catch (processingError) {
        console.error('Error processing message:', processingError);
        await pubSubService.publishToDLQ(message, processingError);
        console.log('=== Push Message Processing Complete with Errors ===\n');
      }

    } catch (error) {
      console.error('Error handling push message:', error);
      console.error('Stack trace:', error.stack);

      try {
        if (req.body?.message) {
          await pubSubService.publishToDLQ(req.body.message, error);
        }
      } catch (dlqError) {
        console.error('Failed to publish to DLQ:', dlqError);
      }
    }
  }
}

module.exports = new MessageHandler();