const { PubSub } = require('@google-cloud/pubsub');

class PubSubService {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.messageHandler = null;
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
      
      // Get subscription
      this.subscription = this.client.subscription(subscriptionName);
      
      // Verify subscription access
      const [exists] = await this.subscription.exists();
      if (!exists) {
        throw new Error(`Subscription ${subscriptionName} does not exist`);
      }
      
      // Set up message handling with timeout
      this.subscription.on('message', this._handleMessageWithTimeout.bind(this));
      this.subscription.on('error', this._handleError.bind(this));
      
      console.log('✓ PubSub service initialized successfully');
      console.log('=== PubSub Initialization Complete ===\n');
    } catch (error) {
      console.error('Failed to initialize PubSub service:', error);
      throw error;
    }
  }

  async _handleMessageWithTimeout(message) {
    const timeout = setTimeout(() => {
      console.warn('Message processing timeout, nacking message');
      message.nack();
    }, 30000); // 30 second timeout
    
    try {
      await this.messageHandler(message);
      clearTimeout(timeout);
    } catch (error) {
      clearTimeout(timeout);
      console.error('Error in message handler:', error);
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
    if (this.subscription) {
      try {
        await this.subscription.close();
        console.log('PubSub subscription closed successfully');
      } catch (error) {
        console.error('Error closing PubSub subscription:', error);
        throw error;
      }
    }
  }
}

module.exports = new PubSubService();