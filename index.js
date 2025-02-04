const express = require('express');
const { PubSub } = require('@google-cloud/pubsub');
const { loadSecrets } = require('./src/config/secrets');
const corsMiddleware = require('./src/middleware/cors');
const emailService = require('./src/services/email');
const sheetsService = require('./src/services/sheets');
const encryption = require('./src/services/encryption');

const app = express();

app.use(express.json());

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(corsMiddleware);

// PubSub push endpoint
app.post('/push-handler', async (req, res) => {
  try {
    if (!req.body.message) {
      return res.status(400).send('No message found');
    }

    const message = req.body.message;
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    console.log('Received push message:', {
      crmProcess: data.crmProcess,
      sessionId: data.sessionId,
      origin: data.origin,
      timestamp: data.timestamp
    });

    if (data.crmProcess === 'screenerNotification') {
      await emailService.handleScreenerNotification(data);
      res.status(204).send();
    } else {
      console.warn('Unknown CRM process:', data.crmProcess);
      res.status(400).send('Unknown CRM process');
    }
  } catch (error) {
    console.error('Error handling push message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Initialize PubSub
let pubSubClient;
let subscription;

const messageHandler = async (message) => {
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
      default:
        console.warn('Unknown message type:', data.type);
    }

    message.ack();
  } catch (error) {
    console.error('Error processing message:', error);
    // Don't ack the message to allow retry
    message.nack();
  }
};

// Initialize application
const init = async () => {
  try {
    const { secrets, keyFilePath } = await loadSecrets();

    // Initialize PubSub
    console.log('\n=== Initializing PubSub Client ===');
    
    console.log('PubSub Client Configuration:', {
      projectId: secrets.GOOGLE_CLOUD_PROJECT_ID,
      keyFilePath,
      grpcSettings: {
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 10000
      }
    });

    const subscriptionName = 'CRM-tasks';
    if (!subscriptionName) {
      throw new Error('PUBSUB_SUBSCRIPTION_NAME environment variable is required');
    }
    
    console.log(`Using subscription name: ${subscriptionName}`);
    console.log(`Full subscription path: projects/${secrets.GOOGLE_CLOUD_PROJECT_ID}/subscriptions/${subscriptionName}`);

    // Initialize PubSub client without keyFilename
    pubSubClient = new PubSub({
      projectId: secrets.GOOGLE_CLOUD_PROJECT_ID,
      // Using Application Default Credentials instead of keyfile
      // The service account already has the necessary permissions
    });

    // Get subscription
    subscription = pubSubClient.subscription(subscriptionName);
    
    console.log('Subscription object created:', {
      name: subscription.name,
      projectId: subscription.projectId,
      metadata: subscription.metadata
    });

    // Verify subscription access
    try {
      console.log('Verifying subscription access...');
      const [exists] = await subscription.exists();
      console.log('Subscription exists check result:', exists);

      if (!exists) {
        throw new Error(`Subscription ${subscriptionName} does not exist`);
      }
      console.log('✓ Subscription access verified');
    } catch (error) {
      console.error('✗ Subscription access error:', error);
      console.error('Error details:', {
        code: error.code,
        details: error.details,
        metadata: error.metadata
      });

      throw new Error(`PubSub subscription access denied. Please ensure the service account has the following roles:
        - roles/pubsub.subscriber
        - roles/pubsub.publisher
        - Verify the subscription ${subscriptionName} exists and is accessible
        Error details: ${error.message}`);
    }
    
    // Listen for messages
    const messageHandlerWithTimeout = async (message) => {
      const timeout = setTimeout(() => {
        console.warn('Message processing timeout, nacking message');
        message.nack();
      }, 30000); // 30 second timeout
      
      try {
        await messageHandler(message);
        clearTimeout(timeout);
      } catch (error) {
        clearTimeout(timeout);
        console.error('Error in message handler:', error);
        message.nack();
      }
    };
    
    subscription.on('message', messageHandlerWithTimeout);
    subscription.on('error', error => {
      console.error('PubSub subscription error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        metadata: error.metadata,
        stack: error.stack
      });
    });

    console.log('✓ PubSub subscription initialized successfully');
    console.log('Subscription details:', {
      name: subscription.name,
      projectId: subscription.projectId,
      isOpen: subscription.isOpen,
      options: subscription.options
    });
    console.log('=== PubSub Initialization Complete ===\n');

    // Initialize sheets service
    sheetsService.initialize(keyFilePath, secrets.SHEETS_ID_FREE_REPORTS_LOG);

    // Initialize encryption service
    encryption.initialize(secrets.EMAIL_ENCRYPTION_KEY);

    // Initialize email service
    emailService.initialize(
      secrets.SENDGRID_API_KEY,
      secrets.SENDGRID_EMAIL,
      secrets.SEND_GRID_TEMPLATE_FREE_REPORT,
      secrets.SEND_GRID_TEMPLATE_PERSONAL_OFFER,
      secrets.SENDGRID_EMAIL,
      secrets.DIRECT_API_KEY
    );

    const PORT = process.env.PORT || 8080;
    app.listen(PORT, () => {
      console.log(`CRM service is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    if (subscription) {
      subscription.removeListener('message', messageHandler);
    }
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing subscription...');
    try {
      if (subscription) {
        subscription.close().then(() => {
          console.log('Subscription closed successfully');
          process.exit(0);
        }).catch(error => {
          console.error('Error closing subscription:', error);
          process.exit(1);
        });
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
};

init();