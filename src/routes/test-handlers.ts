import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { PubSub } from '@google-cloud/pubsub';
import Logger from '../utils/logger';

const router = express.Router();
const TEST_EMAIL = 'ratonxi@gmail.com';
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

// Test handlers endpoint that publishes messages to PubSub
const testHandlerRoute: RequestHandler = async (req, res, next) => {
  const processType = req.query.process as string | undefined;
  const timestamp = Date.now();

  try {
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
      const messageData = createTestMessageData(processType, timestamp);
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
          status: 'published'
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
            status: 'published'
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

// Create test message data
function createTestMessageData(processType: string, timestamp: number): any {
  // Base message data with test marker
  const baseData = {
    customer: { 
      email: TEST_EMAIL,
      isTestMessage: true // Marker to identify test messages
    },
    metadata: { 
      timestamp,
      isTest: true,
      environment: 'production-test'
    }
  };

  let messageData;
  
  switch (processType) {
    case 'resetPasswordRequest':
      messageData = {
        ...baseData,
        crmProcess: processType,
        token: `test-token-${timestamp}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`
      };
      break;

    case 'newRegistrationEmail':
      messageData = {
        ...baseData,
        crmProcess: processType
      };
      break;

    case 'bulkAppraisalEmailUpdate':
      messageData = {
        ...baseData,
        crmProcess: processType,
        metadata: {
          ...baseData.metadata,
          sessionId: `test-session-${timestamp}`,
          origin: 'test',
          environment: 'test'
        }
      };
      break;

    case 'screenerNotification':
      messageData = {
        ...baseData,
        crmProcess: processType,
        sessionId: `test-session-${timestamp}`,
        timestamp: timestamp, // Required as a top-level field, not just in metadata
        metadata: {
          ...baseData.metadata,
          imageUrl: 'https://example.com/test-image.jpg'
        }
      };
      break;
      
    case 'chatSummary':
      messageData = {
        ...baseData,
        crmProcess: processType,
        chat: {
          sessionId: `test-session-${timestamp}`,
          startedAt: new Date(timestamp - 3600000).toISOString(),
          endedAt: new Date(timestamp).toISOString(),
          messageCount: 15,
          satisfactionScore: 4,
          summary: "Test chat summary",
          topics: ["art", "pricing", "appraisal"],
          sentiment: "positive"
        }
      };
      break;
      
    case 'gmailInteraction':
      messageData = {
        ...baseData,
        crmProcess: processType,
        email: {
          messageId: `test-${timestamp}`,
          threadId: `thread-${timestamp}`,
          subject: "Test Email Subject",
          content: "This is a test email content for testing the Gmail processor",
          timestamp: new Date(timestamp).toISOString(),
          classification: {
            intent: "inquiry",
            urgency: "medium",
            responseType: "automated",
            requiresReply: true
          },
          attachments: [], // Required field
          response: {      // Required field
            status: "pending",
            text: "",
            sentAt: null
          }
        }
      };
      break;
      
    case 'appraisalRequest':
      messageData = {
        ...baseData,
        crmProcess: processType,
        customer: {
          ...baseData.customer,
          name: "Test Customer" // Required field
        },
        appraisal: {
          serviceType: "standard",
          sessionId: `test-session-${timestamp}`,
          requestDate: new Date(timestamp).toISOString(),
          status: "pending",
          editLink: "https://example.com/edit",
          images: {
            description: "Test artwork image",
            customerDescription: "Painting of landscape",
            appraisersDescription: "Modern oil painting",
            finalDescription: "Oil painting on canvas, landscape scene"
          },
          value: {
            amount: 1200,
            currency: "USD",
            range: {
              min: 1000,
              max: 1500
            }
          },
          documents: [], // Required field
          publishing: {   // Required field
            status: "private",
            publishDate: null
          }
        }
      };
      break;
      
    case 'stripePayment':
      messageData = {
        ...baseData,
        crmProcess: processType,
        customer: {
          ...baseData.customer,
          name: "Test Customer",
          stripeCustomerId: `cus_test_${timestamp}`
        },
        payment: {
          checkoutSessionId: `cs_test_${timestamp}`,
          paymentIntentId: `pi_test_${timestamp}`,
          amount: 4995,
          currency: "USD",
          status: "succeeded",
          metadata: {
            serviceType: "appraisal",
            sessionId: `test-session-${timestamp}`
          }
        }
      };
      break;
      
    case 'bulkAppraisalFinalized':
      messageData = {
        ...baseData,
        crmProcess: processType,
        appraisal: {
          type: "bulk",
          itemCount: 5,
          sessionId: `test-bulk-${timestamp}`
        }
      };
      break;

    default:
      return null;
  }
  
  return messageData;
}

export default router; 