const { ValidationError } = require('../../../utils/errors');

function validateResetPasswordRequest(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    token: 'string',
    metadata: 'object'
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

  // Validate customer email
  if (data.customer && typeof data.customer === 'object') {
    if (!data.customer.email) {
      errors.push('Missing required field: customer.email');
    } else if (typeof data.customer.email !== 'string') {
      errors.push('Invalid type for customer.email: expected string');
    }
  }

  // Validate token
  if (data.token && typeof data.token === 'string') {
    if (data.token.length < 32) {
      errors.push('Token must be at least 32 characters long');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateResetPasswordRequest; 