const { ValidationError } = require('../../../utils/errors');

function validateNewRegistrationEmail(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    metadata: 'object'
  };

  const customerFields = {
    email: 'string'
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

  // Validate customer fields
  if (data.customer && typeof data.customer === 'object') {
    for (const [field, type] of Object.entries(customerFields)) {
      if (!data.customer[field]) {
        errors.push(`Missing required field: customer.${field}`);
      } else if (typeof data.customer[field] !== type) {
        errors.push(`Invalid type for customer.${field}: expected ${type}`);
      }
    }

    // Optional name field validation
    if (data.customer.name !== undefined && typeof data.customer.name !== 'string') {
      errors.push('Invalid type for customer.name: expected string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateNewRegistrationEmail; 