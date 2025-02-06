const { PubSub } = require('@google-cloud/pubsub');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class PubSubService {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.messageHandler = null;
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

      // Set up message handling
      this.subscription.on('message', this._handleMessage.bind(this));
      this.subscription.on('error', this._handleError.bind(this));
      
      this.logger.success('PubSub service initialized successfully');
      this.logger.end();
    } catch (error) {
      this.logger.error('Failed to initialize PubSub service', error);
      throw error;
    }
  }

  async _handleMessage(message) {
    try {
      await this.messageHandler(message);
      message.ack();
      this.logger.success('Message processed and acknowledged');
    } catch (error) {
      this.logger.error('Error in message handler', error);
      message.nack();
    }
  }

  _handleError(error) {
    this.logger.error('Subscription error', error);
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
      // DLQ handling disabled
      this.logger.info('DLQ handling is disabled');
    } catch (dlqError) {
      this.logger.error('Failed to publish to DLQ', dlqError);
    }
  }
}

module.exports = new PubSubService();