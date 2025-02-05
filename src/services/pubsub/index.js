const { PubSub } = require('@google-cloud/pubsub');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class PubSubService {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.messageHandler = null;
    this.dlqTopic = null;
    this.logger = new Logger('PubSub Service');
  }

  async initialize(projectId, subscriptionName, messageHandler) {
    this.logger.info('Initializing PubSub Service');
    
    if (!projectId || !subscriptionName || !messageHandler) {
      throw new InitializationError('Project ID, subscription name, and message handler are required');
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
        throw new InitializationError(`Subscription ${subscriptionName} does not exist`);
      }

      // Initialize DLQ topic
      const DLQ_TOPIC = process.env.DLQ_TOPIC || 'crm-dlq';
      this.dlqTopic = this.client.topic(DLQ_TOPIC);
      
      // Set up message handling with timeout
      this.subscription.on('message', this._handleMessageWithTimeout.bind(this));
      this.subscription.on('error', this._handleError.bind(this));
      
      this.logger.success('PubSub service initialized successfully');
      this.logger.end();
    } catch (error) {
      this.logger.error('Failed to initialize PubSub service', error);
      throw error;
    }
  }

  async _handleMessageWithTimeout(message) {
    const timeout = setTimeout(() => {
      this.logger.error('Message processing timeout, nacking message');
      message.nack();
    }, 30000);
    
    try {
      await this.messageHandler(message);
      clearTimeout(timeout);
      message.ack();
    } catch (error) {
      clearTimeout(timeout);
      this.logger.error('Error in message handler', error);
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
        this.logger.success('PubSub subscription closed successfully');
      } catch (error) {
        this.logger.error('Error closing PubSub subscription', error);
        throw new ProcessingError(`Failed to close subscription: ${error.message}`);
      }
    }
  }

  async publishToDLQ(message, error) {
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
      this.logger.success('Message published to DLQ');
    } catch (dlqError) {
      this.logger.error('Failed to publish to DLQ', dlqError);
    }
  }
}