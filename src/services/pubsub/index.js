const { PubSub } = require('@google-cloud/pubsub');

class PubSubService {
  constructor() {
    this.client = null;
    this.dlqSubscription = null;
    this.messageHandler = null;
    this.dlqTopic = null;
  }

  async initialize(projectId, subscriptionName, messageHandler) {
    console.log('\n=== Initializing PubSub Service ===');
    
    if (!projectId || !subscriptionName || !messageHandler) {
      throw new Error('Project ID, subscription name, and message handler are required');
    }

    this.messageHandler = messageHandler;
    
    try {
      // Initialize PubSub client
      this.client = new PubSub({ projectId });
      
      // Initialize DLQ topic and subscription
      const DLQ_TOPIC = process.env.DLQ_TOPIC || 'crm-dlq';
      this.dlqTopic = this.client.topic(DLQ_TOPIC);
      this.dlqSubscription = this.dlqTopic.subscription(`${DLQ_TOPIC}-sub`);

      // Set up DLQ message handling with timeout
      this.dlqSubscription.on('message', this._handleDLQMessageWithTimeout.bind(this));
      this.dlqSubscription.on('error', this._handleError.bind(this));
      
      console.log('✓ PubSub service initialized successfully');
      console.log('✓ DLQ subscription initialized');
      console.log('=== PubSub Initialization Complete ===\n');
    } catch (error) {
      console.error('Failed to initialize PubSub service:', error);
      throw error;
    }
  }

  async _handleDLQMessageWithTimeout(message) {
    const timeout = setTimeout(() => {
      console.warn('DLQ message processing timeout, nacking message');
      message.nack();
    }, 30000); // 30 second timeout
    
    try {
      await this.messageHandler(message);
      clearTimeout(timeout);
      message.ack();
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error in DLQ message handler:', error);
      message.nack();
    }
  }

  _handleError(error) {
    console.error('PubSub subscription error:', {
      error: error.message,
      code: error.code,
      details: error.details,
      metadata: error.metadata,
      stack: error.stack
    });
  }

  async shutdown() {
    if (this.dlqSubscription) {
      try {
        await this.dlqSubscription.close();
        console.log('DLQ subscription closed successfully');
      } catch (error) {
        console.error('Error closing DLQ subscription:', error);
        throw error;
      }
    }
  }

  async publishToDLQ(message, error) {
    try {
      const dlqMessage = {
        retryCount: 0,
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

  async republishToDLQ(dlqMessage, error) {
    try {
      const parsedMessage = JSON.parse(dlqMessage.data.toString());
      const newMessage = {
        ...parsedMessage,
        retryCount: (parsedMessage.retryCount || 0) + 1,
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      };

      await this.dlqTopic.publish(Buffer.from(JSON.stringify(newMessage)));
      console.log('Message republished to DLQ with incremented retry count');
    } catch (dlqError) {
      console.error('Failed to republish to DLQ:', dlqError);
    }
  }
}

module.exports = new PubSubService();