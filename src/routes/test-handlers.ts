import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { PubSub } from '@google-cloud/pubsub';
import Logger from '../utils/logger';
import { createTestMessageData, TEST_EMAIL } from '../scripts/test-data';

const router = express.Router();
const logger = new Logger('Test Handlers');

// Middleware to ensure only authorized access
const ensureAuthorized: RequestHandler = (req, res, next): void => {
  const apiKey = req.headers['x-api-key'];
  // Only allow access with a specific test API key
  // For testing purposes, allow "test" as a fallback if env var isn't set
  if (apiKey !== (process.env.TEST_HANDLERS_API_KEY || "test")) {
    res.status(403).json({ error: 'Unauthorized access to test handlers' });
    return;
  }
  next();
};

router.use(ensureAuthorized);

// Route to just validate message data without processing
router.post('/validate', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { processType, messageData } = req.body;
      
      if (!processType || !messageData) {
        return res.status(400).json({ error: 'Missing required fields: processType and messageData' });
      }
      
      // Import validators
      const validators = require('../services/message/validators');
      const validator = validators[`validate${processType.charAt(0).toUpperCase() + processType.slice(1)}`];
      
      if (!validator || typeof validator !== 'function') {
        return res.status(400).json({ 
          error: `No validator found for process type: ${processType}`,
          availableValidators: Object.keys(validators)
            .filter(key => key.startsWith('validate'))
            .map(key => key.replace('validate', ''))
        });
      }
      
      // Run validation
      const validation = validator(messageData);
      
      return res.json({
        processType,
        isValid: validation.isValid,
        errors: validation.errors || [],
        messageData
      });
    } catch (error) {
      logger.error('Error in validation handler', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  })().catch(next);
});

// Route to validate test data templates
router.get('/validate-templates', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const processType = req.query.process as string | undefined;
      const timestamp = Date.now();
      
      // Import validators
      const validators = require('../services/message/validators');
      
      const results: any[] = [];
      
      // If specific process requested, test only that one
      if (processType) {
        const messageData = createTestMessageData(processType, timestamp);
        if (!messageData) {
          return res.status(400).json({ error: `Unknown process type: ${processType}` });
        }
        
        const validatorName = `validate${processType.charAt(0).toUpperCase() + processType.slice(1)}`;
        const validator = validators[validatorName];
        
        if (!validator || typeof validator !== 'function') {
          return res.status(400).json({ 
            error: `No validator found for process type: ${processType}`,
            validatorName,
            availableValidators: Object.keys(validators)
              .filter(key => key.startsWith('validate'))
              .map(key => key.replace('validate', ''))
          });
        }
        
        // Run validation
        const validation = validator(messageData);
        
        return res.json({
          processType,
          isValid: validation.isValid,
          errors: validation.errors || [],
          messageData
        });
      }
      
      // Test all process types
      const processes = [
        'resetPasswordRequest',
        'newRegistrationEmail',
        'screenerNotification',
        'chatSummary',
        'gmailInteraction',
        'appraisalRequest',
        'stripePayment',
        'bulkAppraisalFinalized',
        'bulkAppraisalEmailUpdate'
      ];
      
      for (const proc of processes) {
        try {
          const messageData = createTestMessageData(proc, timestamp);
          if (!messageData) {
            results.push({
              processType: proc,
              isValid: false,
              error: 'Failed to create test message data'
            });
            continue;
          }
          
          const validatorName = `validate${proc.charAt(0).toUpperCase() + proc.slice(1)}`;
          const validator = validators[validatorName];
          
          if (!validator || typeof validator !== 'function') {
            results.push({
              processType: proc,
              isValid: false,
              error: `No validator found (${validatorName})`
            });
            continue;
          }
          
          // Run validation
          const validation = validator(messageData);
          
          results.push({
            processType: proc,
            isValid: validation.isValid,
            errors: validation.errors || [],
            messageData: validation.isValid ? undefined : messageData // Only include data if invalid
          });
        } catch (error) {
          results.push({
            processType: proc,
            isValid: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return res.json({
        results,
        timestamp,
        validResults: results.filter(r => r.isValid).length,
        invalidResults: results.filter(r => !r.isValid).length
      });
    } catch (error) {
      logger.error('Error in validation templates handler', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  })().catch(next);
});

interface TestResult {
  process: string;
  success: boolean;
  result?: any;
  error?: string;
}

// Gets the topic name from the subscription name
function getTopicFromSubscription(subscriptionName: string): string {
  // In GCP, subscription names often follow the pattern: projects/{project}/subscriptions/{subscription}
  // The associated topic is typically at: projects/{project}/topics/{topicName}
  // For simplicity, assume the subscription name is just the last part
  const parts = subscriptionName.split('/');
  const baseName = parts[parts.length - 1];
  
  // Return the topic name - usually it's similar to the subscription name
  // but without the -sub suffix if it exists
  return baseName.replace(/-sub$/, '');
}

// POST route for simulation with custom message
router.post('/simulate', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { processType, messageData } = req.body;
      
      if (!processType || !messageData) {
        return res.status(400).json({ error: 'Missing required fields: processType and messageData' });
      }
      
      // Import the message handler directly for simulation
      const MessageHandler = require('../services/message/handler');
      const handler = new MessageHandler();
      
      logger.info(`[SIMULATION] Processing message for: ${processType}`, { messageData });
      
      // Create a fake PubSub message structure
      const fakeMessage = {
        id: `sim-${Date.now()}`,
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: { timestamp: new Date().toISOString() },
        ack: () => logger.info('Message acknowledged (simulated)')
      };
      
      try {
        const result = await handler.handleMessage(fakeMessage);
        res.json({
          success: true,
          process: processType,
          result: {
            simulated: true,
            messageData,
            processingResult: result
          }
        });
      } catch (error) {
        logger.error(`Error in message handler simulation for ${processType}`, error);
        res.status(500).json({
          success: false,
          process: processType,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } catch (error) {
      logger.error('Error in simulation handler', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  })().catch(next);
});

// POST route for simulation with generated test data
router.post('/simulate-process/:processType', (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    try {
      const { processType } = req.params;
      const timestamp = Date.now();
      
      // Generate test message data for the specified process
      const messageData = createTestMessageData(processType, timestamp);
      if (!messageData) {
        return res.status(400).json({ error: `Unknown process type: ${processType}` });
      }
      
      // Allow request body to override parts of the generated message
      if (req.body && typeof req.body === 'object') {
        Object.assign(messageData, req.body);
      }
      
      // Import the message handler
      const MessageHandler = require('../services/message/handler');
      const handler = new MessageHandler();
      
      logger.info(`[SIMULATION] Processing generated message for: ${processType}`, { messageData });
      
      // Create a fake PubSub message structure
      const fakeMessage = {
        id: `sim-${timestamp}`,
        data: Buffer.from(JSON.stringify(messageData)),
        attributes: { timestamp: new Date(timestamp).toISOString() },
        ack: () => logger.info('Message acknowledged (simulated)')
      };
      
      try {
        const result = await handler.handleMessage(fakeMessage);
        res.json({
          success: true,
          process: processType,
          result: {
            simulated: true,
            messageData,
            processingResult: result
          }
        });
      } catch (error) {
        logger.error(`Error in message handler simulation for ${processType}`, error);
        res.status(500).json({
          success: false,
          process: processType,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    } catch (error) {
      logger.error('Error in simulation handler', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  })().catch(next);
});

// Test handlers endpoint that publishes messages to PubSub
const testHandlerRoute: RequestHandler = async (req, res, next) => {
  const processType = req.query.process as string | undefined;
  const timestamp = Date.now();
  const customMessage = req.body?.message; // Allow custom message data from request body
  const simulateMode = req.query.simulate === 'true'; // Simulate directly without publishing

  try {
    if (simulateMode) {
      // Simulate message handler directly without publishing to PubSub
      logger.info(`[TEST HANDLER] Simulating message processing for: ${processType || 'all'}`);
      
      // Import the message handler directly for simulation
      const MessageHandler = require('../services/message/handler');
      const handler = new MessageHandler();
      
      if (processType) {
        // Simulate a specific process
        const messageData = customMessage || createTestMessageData(processType, timestamp);
        if (!messageData) {
          res.status(400).json({ error: `Unknown process type: ${processType}` });
          return;
        }
        
        logger.info(`Simulating message processing for: ${processType}`, { messageData });
        
        try {
          // Create a fake PubSub message structure
          const fakeMessage = {
            id: `fake-message-${timestamp}`,
            data: Buffer.from(JSON.stringify(messageData)),
            attributes: { timestamp: new Date(timestamp).toISOString() },
            ack: () => logger.info('Message acknowledged (simulated)')
          };
          
          const result = await handler.handleMessage(fakeMessage);
          res.json({
            success: true,
            process: processType,
            result: {
              simulated: true,
              messageData,
              processingResult: result
            }
          });
        } catch (error) {
          logger.error(`Error simulating message handler for ${processType}`, error);
          res.status(500).json({
            success: false,
            process: processType,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          });
        }
        return;
      }
      
      // Simulate all handlers
      const results: TestResult[] = [];
      const processes = [
        'resetPasswordRequest',
        'newRegistrationEmail',
        'screenerNotification',
        'chatSummary',
        'gmailInteraction',
        'appraisalRequest',
        'stripePayment',
        'bulkAppraisalFinalized'
      ];
      
      for (const proc of processes) {
        try {
          const messageData = createTestMessageData(proc, timestamp);
          if (!messageData) {
            results.push({
              process: proc,
              success: false,
              error: 'Failed to create test message data'
            });
            continue;
          }
          
          logger.info(`Simulating message processing for: ${proc}`);
          
          // Create a fake PubSub message structure
          const fakeMessage = {
            id: `fake-message-${timestamp}-${proc}`,
            data: Buffer.from(JSON.stringify(messageData)),
            attributes: { timestamp: new Date(timestamp).toISOString() },
            ack: () => logger.info(`Message acknowledged (simulated) for ${proc}`)
          };
          
          const result = await handler.handleMessage(fakeMessage);
          results.push({
            process: proc,
            success: true,
            result: {
              simulated: true,
              processingResult: result
            }
          });
        } catch (error) {
          results.push({
            process: proc,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      res.json({ success: true, results });
      return;
    }
    
    // Regular PubSub publishing mode
    // Get the subscription name from environment variable
    const subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME;
    if (!subscriptionName) {
      throw new Error('PUBSUB_SUBSCRIPTION_NAME environment variable is not set');
    }

    // Derive the topic name from the subscription name
    const topicName = getTopicFromSubscription(subscriptionName);
    logger.info(`Using topic: ${topicName} derived from subscription: ${subscriptionName}`);

    // Create a PubSub client
    const pubSubClient = new PubSub();
    const topic = pubSubClient.topic(topicName);

    // Add a clear marker in logs for test requests
    logger.info(`[TEST HANDLER] Publishing test message for process: ${processType || 'all'}`); 

    // If specific process requested, test only that one
    if (processType) {
      const messageData = customMessage || createTestMessageData(processType, timestamp);
      if (!messageData) {
        res.status(400).json({ error: `Unknown process type: ${processType}` });
        return;
      }

      // Publish message to PubSub topic
      const messageId = await publishMessage(topic, messageData);
      
      res.json({ 
        success: true, 
        process: processType, 
        result: { 
          messageId, 
          topic: topicName,
          email: TEST_EMAIL,
          status: 'published',
          messageData
        } 
      });
      return;
    }

    // Test all handlers
    const results: TestResult[] = [];
    const processes = [
      'resetPasswordRequest',
      'newRegistrationEmail',
      'screenerNotification',
      'chatSummary',
      'gmailInteraction',
      'appraisalRequest',
      'stripePayment',
      'bulkAppraisalFinalized'
    ];

    for (const processType of processes) {
      try {
        const messageData = createTestMessageData(processType, timestamp);
        if (!messageData) {
          results.push({ 
            process: processType, 
            success: false, 
            error: 'Failed to create test message data'
          });
          continue;
        }

        // Publish message to PubSub
        const messageId = await publishMessage(topic, messageData);
        
        results.push({ 
          process: processType, 
          success: true, 
          result: {
            messageId,
            topic: topicName,
            email: TEST_EMAIL,
            status: 'published',
            messageData
          }
        });
      } catch (error) {
        results.push({ 
          process: processType, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    res.json({ success: true, results });
  } catch (error) {
    logger.error('Error in test handler', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
};

router.post('/test-handlers', testHandlerRoute);

// Publish a message to PubSub topic
async function publishMessage(topic: any, data: any): Promise<string> {
  const dataBuffer = Buffer.from(JSON.stringify(data));
  logger.info(`Publishing message to topic: ${topic.name}`, { data });
  
  try {
    const messageId = await topic.publish(dataBuffer);
    logger.success(`Message ${messageId} published to topic: ${topic.name}`);
    return messageId;
  } catch (error) {
    logger.error(`Error publishing to topic: ${topic.name}`, error);
    throw error;
  }
}

// Using imported createTestMessageData from test-data.js

export default router;