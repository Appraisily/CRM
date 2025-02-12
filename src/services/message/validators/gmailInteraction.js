const { ValidationError } = require('../../../utils/errors');

function validateGmailInteraction(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    email: 'object',
    metadata: 'object'
  };

  const emailFields = {
    messageId: 'string',
    threadId: 'string',
    subject: 'string',
    content: 'string',
    timestamp: 'string',
    classification: 'object',
    attachments: 'object',
    response: 'object'
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

  // Check email object fields
  if (data.email && typeof data.email === 'object') {
    for (const [field, type] of Object.entries(emailFields)) {
      if (!data.email[field]) {
        errors.push(`Missing required field: email.${field}`);
      } else if (typeof data.email[field] !== type) {
        errors.push(`Invalid type for email.${field}: expected ${type}`);
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

module.exports = validateGmailInteraction;