const emailService = require('../email');
const { PubSub } = require('@google-cloud/pubsub');

const DLQ_TOPIC = process.env.DLQ_TOPIC || 'crm-dlq';

class MessageHandler {
  constructor() {
    this.pubsub = new PubSub();
    this.dlqTopic = this.pubsub.topic(DLQ_TOPIC);
  }

  async _publishToDLQ(message, error) {
    try {
      const dlqMessage = {
        originalMessage: message.data.toString(),
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      };

      await this.dlqTopic.publish(Buffer.from(JSON.stringify(dlqMessage)));
      console.log('Message published to DLQ');
    } catch (dlqError) {
      console.error('Failed to publish to DLQ:', dlqError);
    }
  }

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
      // Publish failed message to DLQ
      await this._publishToDLQ(message, error);
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
      
      // Validate request body
      if (!req.body || !req.body.message) {
        console.error('No message found in request body');
        return res.status(400).send('No message found');
      }
      
      const message = req.body.message;
      if (!message.data) {
        console.error('No data field in message');
        return res.status(400).send('Invalid message format');
      }
      
      // Decode and parse message data
      let data;
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString();
        data = JSON.parse(decodedData);
        console.log('Received push message:', {
          type: data.crmProcess,
          sessionId: data.sessionId,
          timestamp: data.timestamp
        });
      } catch (error) {
        console.error('Error decoding/parsing message data:', error);
        return res.status(400).send('Invalid message data format');
      }
      
      // Validate required fields for screener notification
      if (data.crmProcess !== 'screenerNotification') {
        console.log('Unknown message type:', data.crmProcess);
        return res.status(400).send('Unsupported message type');
      }
      
      if (!data.customer?.email || !data.sessionId || !data.metadata) {
        console.error('Missing required fields in screener notification');
        await this._publishToDLQ({ data: message.data }, new Error('Missing required fields'));
        return res.status(400).send('Missing required fields');
      }
      
      // Process screener notification
      const success = await emailService.handleScreenerNotification(data);
      res.status(success ? 204 : 400).send();
      
      console.log('=== Push Message Processing Complete ===\n');
    } catch (error) {
      console.error('Error handling push message:', error);
      console.error('Stack trace:', error.stack);
      
      if (error.message.includes('Invalid') || error.message.includes('Missing')) {
        res.status(400).send(error.message);
      } else {
        res.status(500).send('Internal Server Error');
      }
    }
  }
}

module.exports = new MessageHandler();