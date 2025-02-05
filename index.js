const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const corsMiddleware = require('./src/middleware/cors');
const emailService = require('./src/services/email');
const sheetsService = require('./src/services/sheets');
const encryption = require('./src/services/encryption');
const pubSubService = require('./src/services/pubsub');
const messageHandler = require('./src/services/message/handler');

const app = express();

app.use(express.json());

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(corsMiddleware);

// Mount PubSub push endpoint
app.post('/push-handler', messageHandler.handlePushMessage.bind(messageHandler));

// Initialize application
const init = async () => {
  try {
    const { secrets, keyFilePath } = await loadSecrets();

    // Initialize PubSub service
    await pubSubService.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      'CRM-tasks',
      messageHandler.handleMessage.bind(messageHandler)
    );

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
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing subscription...');
    pubSubService.shutdown()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });
};

init();