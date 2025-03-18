/**
 * Helper module with test data generators for different message process types.
 * This ensures consistent test data across the application.
 */

const TEST_EMAIL = 'test@example.com';

/**
 * Create test message data for a specific process type
 * @param {string} processType - The name of the process to generate data for
 * @param {number} timestamp - Timestamp to use in generating data
 * @returns {object} Generated test message data
 */
function createTestMessageData(processType, timestamp) {
  // Base message data with test marker
  const baseData = {
    customer: { 
      email: TEST_EMAIL,
      isTestMessage: true // Marker to identify test messages
    },
    metadata: { 
      timestamp,
      isTest: true,
      environment: 'production-test',
      origin: 'test' // Required by some validators
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
          sessionId: `test-session-${timestamp}`
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
            intent: "GENERAL_INQUIRY",
            urgency: "medium",
            responseType: "automated",
            requiresReply: true
          },
          attachments: { 
            hasImages: false, 
            imageCount: 0, 
            imageAnalysis: "" 
          },
          response: {
            generated: "",
            status: "pending"
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

module.exports = {
  createTestMessageData,
  TEST_EMAIL
};