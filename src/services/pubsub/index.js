const { PubSub } = require('@google-cloud/pubsub');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class PubSubService {
  constructor() {
    this.client = null;
    this.subscription = null;
    this.dlqSubscription = null;
    this.dlqTopic = null;
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
      
      // Initialize DLQ topic
      this.dlqTopic = this.client.topic(`${subscriptionName}-dlq`);
      const [dlqExists] = await this.dlqTopic.exists();
      if (!dlqExists) {
        this.logger.info('Creating DLQ topic...');
        await this.dlqTopic.create();
        
        // Create DLQ subscription
        const dlqSubscriptionName = `${subscriptionName}-dlq-sub`;
        this.dlqSubscription = this.dlqTopic.subscription(dlqSubscriptionName);
        const [dlqSubExists] = await this.dlqSubscription.exists();
        
        if (!dlqSubExists) {
          this.logger.info('Creating DLQ subscription...');
          await this.dlqSubscription.create();
        }
        
        this.logger.success('DLQ topic and subscription created');
      }
      
      // Set up DLQ message handling
      this.dlqSubscription.on('message', this._handleDLQMessage.bind(this));
      this.dlqSubscription.on('error', error => {
        this.logger.error('DLQ subscription error', error);
      });

      // Set up message handling
      const options = {
        flowControl: {
          maxMessages: 1,
          allowExcessMessages: false
        },
        batching: {
          maxMessages: 1,
          maxMilliseconds: 100
        }
      };

      this.subscription.on('message', async (message) => {
        try {
          await this._handleMessage(message);
        } catch (error) {
          this.logger.error('Error handling message', error);
        }
      });

      this.subscription.on('error', (error) => {
        this.logger.error('Subscription error', error);
        // Don't throw, just log the error to prevent crash
      });

      this.subscription.on('close', () => {
        this.logger.info('Subscription closed');
      });
      
      this.logger.success('PubSub service initialized successfully');
      this.logger.end();
    } catch (error) {
      this.logger.error('Failed to initialize PubSub service', error);
      throw error;
    }
  }

  async _handleMessage(message) {
    try {
      this.logger.info('Received message', {
        messageId: message.id,
        publishTime: message.publishTime
      });

      // Always parse and validate message before processing
      let data;
      try {
        data = typeof message.data === 'string' ? 
          JSON.parse(message.data) :
          JSON.parse(message.data.toString());
      } catch (parseError) {
        this.logger.error('Failed to parse message data', parseError);
        await this.publishToDLQ(message, parseError);
        message.ack(); // Ack malformed messages to prevent infinite retries
        return;
      }

      await this.messageHandler(message);
      this.logger.success('Message processed and acknowledged');
      message.ack();
    } catch (error) {
      this.logger.error('Error in message handler', error);
      
      // For validation errors, ack the message to prevent infinite retries
      if (error.name === 'ValidationError') {
        this.logger.info('Validation error - acknowledging message to prevent retries');
        await this.publishToDLQ(message, error);
        message.ack();
      } else {
        // For other errors, nack to retry
        message.nack();
      }
    }
  }

  async _handleDLQMessage(message) {
    try {
      this.logger.info('Processing DLQ message', {
        messageId: message.id,
        publishTime: message.publishTime
      });

      // Parse DLQ message
      const dlqData = JSON.parse(message.data.toString());
      const { originalMessage, error } = dlqData;

      this.logger.info('DLQ message details', {
        originalMessageId: originalMessage.id,
        errorType: error.name,
        errorMessage: error.message,
        timestamp: error.timestamp
      });

      // Here you can implement custom logic for DLQ messages
      // For example:
      // - Log to monitoring system
      // - Send alerts
      // - Attempt reprocessing with modified data
      // - Archive for manual review

      // For now, we'll just acknowledge the message
      message.ack();
      this.logger.success('DLQ message processed');

    } catch (error) {
      this.logger.error('Error processing DLQ message', error);
      message.nack(); // Retry DLQ message processing
    }
  }

  async shutdown() {
    if (this.subscription) {
      try {
        this.logger.info('Closing PubSub subscription...');
        await Promise.all([
          this.subscription.close(),
          this.dlqSubscription?.close()
        ]);
        this.logger.success('PubSub subscription closed successfully');
      } catch (error) {
        this.logger.error('Error closing PubSub subscription', error);
        // Don't throw on shutdown, just log the error
      }
    }
  }

  async publishToDLQ(message, error) {
    try {
      if (!this.dlqTopic) {
        this.logger.error('DLQ topic not initialized');
        return;
      }

      const dlqMessage = {
        originalMessage: {
          id: message.id,
          data: message.data.toString(),
          attributes: message.attributes,
          publishTime: message.publishTime
        },
        error: {
          name: error.name,
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

module.exports = new PubSubService();