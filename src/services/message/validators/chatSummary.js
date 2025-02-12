const { ValidationError } = require('../../../utils/errors');

function validateChatSummary(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    chat: 'object',
    metadata: 'object'
  };

  const chatFields = {
    sessionId: 'string',
    startedAt: 'string',
    endedAt: 'string',
    messageCount: 'number',
    satisfactionScore: 'number',
    summary: 'string',
    topics: 'object',
    sentiment: 'string'
  };

  const errors = [];

  // Check top-level fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
    }
  }

  // Check chat object fields
  if (data.chat && typeof data.chat === 'object') {
    for (const [field, type] of Object.entries(chatFields)) {
      if (!data.chat[field]) {
        errors.push(`Missing required field: chat.${field}`);
      } else if (type === 'object' ? !Array.isArray(data.chat[field]) : typeof data.chat[field] !== type) {
        errors.push(`Invalid type for chat.${field}: expected ${type}`);
      }
    }
  }

  // Validate customer email
  if (data.customer && typeof data.customer === 'object') {
    if (!data.customer.email) {
      errors.push('Missing required field: customer.email');
    } else if (typeof data.customer.email !== 'string') {
      errors.push('Invalid type for customer.email: expected string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateChatSummary;