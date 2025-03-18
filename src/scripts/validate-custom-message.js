/**
 * Utility to validate a specific custom message against the appropriate validator
 */
const { validateMessage } = require('./validate-message');
const Logger = require('../utils/logger');

const logger = new Logger('Custom Validator');

// The message data that was failing
const problemMessage = {
  "customer": {
    "email": "ratonxi@gmail.com",
    "isTestMessage": true
  },
  "metadata": {
    "timestamp": 1742310309862,
    "isTest": true,
    "environment": "production-test",
    "origin": "gmail",
    "labels": ["CATEGORY_PROMOTIONS", "UNREAD", "INBOX"],
    "processingTime": 9255,
    "status": "processed",
    "error": null
  },
  "crmProcess": "gmailInteraction",
  "sessionId": "195a9c94b92b9b62",
  "email": {
    "messageId": "195a9c94b92b9b62",
    "threadId": "195a9c94b92b9b62",
    "subject": "Modern & Contemporary Paintings and Sculptures, Lithographs, Photographs, Multiples & Street Art",
    "content": "Invaluable \r\n\r\n \r\n  \r\n\r\nhttps://view.e.invaluable.com/?qs=c96f1ddf98853d37a87ddde3336857079fea4bab0cc5af608c3d0169a38b877c28a2ab76b97cc9a8cf133a675bb3ec988784cffdd8d6b5e8333dcb988ce3a3f5b8c27ace40d201d87e8cbbfffe57fe25 \r\nView in Browser \r\n\r\nhttps://click.e.invaluable.com/?qs=7ed4566f6b92fd2e8bbb9a276675968614d7c8f6f23e531b6f03640f1f47a51338859452988734e856c3e721de846cf8ec63b1e72fabf5d43d6b0a69f957c17b \r\nUpcoming On\r\n\r\n \r\n \r\n\r\n \r\n \r\n\r\n \r\nhttps://click.e.invaluable.com/?qs=7ed4566f6b92fd2e38bbc52bb9059a7a739a058edf8f1caf86a35b188c64e2d922bb5cce999cf58111a559c81fa3a2f7fa2d2e55d582b9ecf0841fac5b7d0847 \r\n\r\n\r\nhttps://click.e.invaluable.com/?qs=7ed4566f6b92fd2e38bbc52bb9059a7a739a058edf8f1caf86a35b188c64e2d922bb5cce999cf58111a559c81fa3a2f7fa2d2e55d582b9ecf0841fac5b7d0847 \r\nKeith Haring, Attributed to Pop Shop Stool, Funny Munny 1988 \r\n\r\nhttps://click.e.invaluable.com/?qs=7ed4566f6b92fd2ed83086e312a6ccd755e96b04e52b1023fdf30982962a1bab597ffce95f972cf06c449cd03e5d8df51c6cdbe8cba909094120a9490b2",
    "timestamp": "2025-03-18T15:04:54.000Z",
    "classification": {
      "intent": "GENERAL_INQUIRY",
      "urgency": "low",
      "responseType": "brief",
      "requiresReply": false
    },
    "attachments": {
      "hasImages": false,
      "imageCount": 0,
      "imageAnalysis": ""
    },
    "response": {
      "generated": "",
      "status": "pending"
    }
  }
};

// The message data from a failing bulk appraisal
const bulkAppraisalMessage = {
  "customer": {
    "email": "ratonxi@gmail.com",
    "isTestMessage": true
  },
  "metadata": {
    "timestamp": 1742309987298,
    "isTest": true,
    "environment": "production-test"
  },
  "crmProcess": "bulkAppraisalFinalized",
  "appraisal": {
    "type": "bulk",
    "itemCount": 5,
    "sessionId": "test-bulk-1742309987298"
  }
};

async function main() {
  logger.info('Validating problematic message data');
  
  // Test the gmailInteraction message
  const gmailResult = await validateMessage('gmailInteraction', problemMessage);
  console.log('Gmail Validation Result:', JSON.stringify(gmailResult, null, 2));
  
  // Test the bulkAppraisalFinalized message
  const bulkResult = await validateMessage('bulkAppraisalFinalized', bulkAppraisalMessage);
  console.log('Bulk Appraisal Validation Result:', JSON.stringify(bulkResult, null, 2));
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});