const { PubSub } = require('@google-cloud/pubsub');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class PubSubService {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.isProcessing = false;
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
      
      // Configure subscription settings
      await this.subscription.setMetadata({
        ackDeadlineSeconds: 30, // Give 30 seconds to process each message
        enableMessageOrdering: true
      });

      // Start pulling messages
      this._startPulling();
      
      this.logger.success('PubSub service initialized successfully');
      this.logger.end();
    } catch (error) {
      this.logger.error('Failed to initialize PubSub service', error);
      throw error;
    }
  }

  async _startPulling() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.info('Starting message pull loop');

    while (this.isProcessing) {
      try {
        // Pull a single message
        const [messages] = await this.subscription.pull({
          maxMessages: 1,
          returnImmediately: false
        });

        if (messages && messages.length > 0) {
          const message = messages[0];
          await this._processMessage(message);
        }
      } catch (error) {
        if (error.code !== 4) { // Ignore DEADLINE_EXCEEDED errors
          this.logger.error('Error pulling messages', error);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
        }
      }
    }
  }

  async _processMessage(message) {
    try {
      await this.messageHandler(message);
      await this.subscription.ack(message);
      this.logger.success('Message processed and acknowledged');
    } catch (error) {
      this.logger.error('Error in message handler', error);
      await this.subscription.nack(message);
    }
  }

  async shutdown() {
    if (this.subscription) {
      try {
        this.isProcessing = false;
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