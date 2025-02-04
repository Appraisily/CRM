const emailService = require('../email');

class MessageHandler {
  async handleMessage(message) {
    try {
      const data = JSON.parse(message.data.toString());
      console.log('Received message:', {
        type: data.type,
        sessionId: data.sessionId,
        email: data.email ? '***@***.***' : undefined
      });

      switch (data.type) {
        case 'ANALYSIS_COMPLETE':
          await emailService.handleAnalysisComplete(data);
          break;
        case 'GENERATE_OFFER':
          await emailService.handleGenerateOffer(data);
          break;
        case 'SEND_REPORT':
          await emailService.handleSendReport(data);
          break;
        case 'SCREENER_NOTIFICATION':
          await emailService.handleScreenerNotification(data);
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }

      message.ack();
    } catch (error) {
      console.error('Error processing message:', error);
      message.nack();
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

      console.log('Received push message:', {
        type: data.type,
        sessionId: data.sessionId,
        timestamp: data.timestamp
      });

      await this.handleMessage({ data: Buffer.from(JSON.stringify(data)) });
      res.status(204).send();

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