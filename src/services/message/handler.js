const emailService = require('../email');

class MessageHandler {
  async handleMessage(message) {
    try {
      const data = typeof message.data === 'string' ? 
        JSON.parse(message.data) :
        JSON.parse(message.data.toString());

      // Map message format to expected type
      if (data.crmProcess === 'screenerNotification') {
        data.type = 'SCREENER_NOTIFICATION';
      }

      console.log('Received message:', {
        type: data.type,
        sessionId: data.sessionId,
        email: data.customer?.email ? '***@***.***' : undefined
      });

      let success = false;
      switch (data.type) {
        case 'ANALYSIS_COMPLETE':
          await emailService.handleAnalysisComplete(data);
          success = true;
          break;
        case 'GENERATE_OFFER':
          await emailService.handleGenerateOffer(data);
          success = true;
          break;
        case 'SEND_REPORT':
          await emailService.handleSendReport(data);
          success = true;
          break;
        case 'SCREENER_NOTIFICATION':
          const result = await emailService.handleScreenerNotification({
            customer: data.customer,
            sessionId: data.sessionId,
            metadata: data.metadata,
            timestamp: data.timestamp,
            origin: data.origin
          });
          success = result.success;
          success = true;
          break;
        default:
          console.warn('Unknown message type:', data.type);
          success = false;
      }

      // Only call ack/nack if they exist (PubSub pull subscription)
      if (message.ack && typeof message.ack === 'function') {
        message.ack();
      }
      return success;

    } catch (error) {
      console.error('Error processing message:', error);
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

      if (!req.body.message) {
        console.error('No message found in request body');
        return res.status(400).send('No message found');
      }

      const message = req.body.message;
      if (!message.data) {
        console.error('No data field in message');
        return res.status(400).send('Invalid message format');
      }

      let data;
      try {
        const decodedData = Buffer.from(message.data, 'base64').toString();
        data = JSON.parse(decodedData);
      } catch (error) {
        console.error('Error decoding/parsing message data:', error);
        return res.status(400).send('Invalid message data format');
      }

      // Add message type from attributes if available
      if (message.attributes && message.attributes.type) {
        data.type = message.attributes.type;
      } else if (data.crmProcess === 'screenerNotification') {
        data.type = 'SCREENER_NOTIFICATION';
      }

      console.log('Received push message:', {
        type: data.type,
        sessionId: data.sessionId,
        timestamp: data.timestamp,
        process: data.crmProcess
      });

      const success = await this.handleMessage({ data: JSON.stringify(data) });
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