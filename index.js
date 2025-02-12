const express = require('express');
const { loadSecrets } = require('./src/config/secrets');
const corsMiddleware = require('./src/middleware/cors');
const customerRoutes = require('./src/routes/customers');
const cloudServices = require('./src/services/storage');
const emailService = require('./src/services/email');
const sheetsService = require('./src/services/sheets');
const databaseService = require('./src/services/database');
const encryption = require('./src/services/encryption');
const pubSubService = require('./src/services/pubsub');
const messageHandler = require('./src/services/message/handler');
const Logger = require('./src/utils/logger');

const app = express();
const logger = new Logger('Main Service');

app.use(express.json());

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

app.use(corsMiddleware);

// API Routes
app.use('/api/customers', customerRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: Date.now()
  });
});

// Initialize application
const init = async () => {
  try {
    logger.info('Starting CRM service initialization');
    const { secrets, keyFilePath } = await loadSecrets();

    // Initialize database service
    logger.info('Initializing database service');
    await databaseService.initialize();

    // Initialize cloud storage service
    logger.info('Initializing cloud storage service');
    await cloudServices.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      keyFilePath,
      secrets.GCS_BUCKET_NAME,
      secrets.OPENAI_API_KEY
    );

    // Initialize PubSub service
    logger.info('Initializing PubSub service');
    const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME;
    if (!subscriptionName) {
      throw new Error('PUBSUB_SUBSCRIPTION_NAME is required');
    }
    await pubSubService.initialize(
      secrets.GOOGLE_CLOUD_PROJECT_ID,
      subscriptionName,
      messageHandler.handleMessage.bind(messageHandler)
    );

    // Initialize sheets service
    logger.info('Initializing sheets service');
    sheetsService.initialize(keyFilePath, secrets.SHEETS_ID_FREE_REPORTS_LOG);

    // Initialize encryption service
    logger.info('Initializing encryption service');
    encryption.initialize(secrets.EMAIL_ENCRYPTION_KEY);

    // Initialize email service
    logger.info('Initializing email service');
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
      logger.success(`CRM service is running on port ${PORT}`);
    });

    logger.success('Service initialization complete');
  } catch (error) {
    logger.error('Failed to initialize application', error);
    process.exit(1);
  }

  // Handle shutdown signals
  const handleShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    try {
      await databaseService.disconnect();
      await pubSubService.shutdown();
      logger.success('PubSub subscription closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    handleShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    handleShutdown('UNHANDLED_REJECTION');
  });
};

init();