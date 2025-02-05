const emailService = require('../email');
const pubSubService = require('../pubsub');

class MessageHandler {
  async handleMessage(message) {
    try {
      const data = typeof message.data === 'string' ? 
        JSON.parse(message.data) :
        JSON.parse(message.data.toString());

      if (data.crmProcess !== 'screenerNotification') {
        console.warn('Unknown message type:', data.crmProcess);
        return false;
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
      // Publish failed message to DLQ using PubSub service
      await pubSubService.publishToDLQ(message, error);
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
        const data = JSON.parse(decodedData);
        console.log('Received push message:', {
          type: data.crmProcess,
          sessionId: data.sessionId,
          timestamp: data.timestamp
        });

        // Validate required fields for screener notification
        if (data.crmProcess !== 'screenerNotification') {
          throw new Error(`Unsupported message type: ${data.crmProcess}`);
        }

        if (!data.customer?.email || !data.sessionId || !data.metadata) {
          throw new Error('Missing required fields in screener notification');
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