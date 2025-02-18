const { ValidationError } = require('../../../utils/errors');

function validateBulkAppraisalEmailUpdate(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
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

  // Validate metadata
  if (data.metadata && typeof data.metadata === 'object') {
    const requiredMetadata = {
      origin: 'string',
      sessionId: 'string',
      environment: 'string',
      timestamp: 'number'
    };

    for (const [field, type] of Object.entries(requiredMetadata)) {
      if (!data.metadata[field]) {
        errors.push(`Missing required field: metadata.${field}`);
      } else if (typeof data.metadata[field] !== type) {
        errors.push(`Invalid type for metadata.${field}: expected ${type}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateBulkAppraisalEmailUpdate;