const { ValidationError } = require('../../../utils/errors');

function validateScreenerNotification(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    sessionId: 'string',
    metadata: 'object',
    timestamp: 'number'
  };

  const errors = [];

  // Check all required fields
  for (const [field, type] of Object.entries(requiredFields)) {
    if (!data[field]) {
      errors.push(`Missing required field: ${field}`);
    } else if (typeof data[field] !== type) {
      errors.push(`Invalid type for ${field}: expected ${type}, got ${typeof data[field]}`);
    }
  }

  // Additional customer object validation
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

module.exports = validateScreenerNotification;