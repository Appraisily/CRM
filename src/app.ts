import express from 'express';
import cors from 'cors';
import testHandlersRouter from './routes/test-handlers';
import { validateApiKey } from './middleware/auth';
import Logger from './utils/logger';

const app = express();
const logger = new Logger('App');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// API key validation for all routes except health check
app.use((req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  validateApiKey(req, res, next);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Always include test handlers but protect them with API key
app.use('/api', testHandlersRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const port = process.env.PORT || 8080;

// Create server and handle errors
const server = app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
}).on('error', (error: Error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app; 