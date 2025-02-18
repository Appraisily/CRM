const { ValidationError } = require('../../../utils/errors');

function validateBulkAppraisalFinalized(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    appraisal: 'object',
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

  // Validate customer data
  if (data.customer && typeof data.customer === 'object') {
    if (!data.customer.email) {
      errors.push('Missing required field: customer.email');
    } else if (typeof data.customer.email !== 'string') {
      errors.push('Invalid type for customer.email: expected string');
    }
    if (data.customer.notes && typeof data.customer.notes !== 'string') {
      errors.push('Invalid type for customer.notes: expected string');
    }
  }

  // Validate appraisal data
  if (data.appraisal && typeof data.appraisal === 'object') {
    const validTypes = ['regular', 'insurance', 'tax'];
    if (!data.appraisal.type) {
      errors.push('Missing required field: appraisal.type');
    } else if (!validTypes.includes(data.appraisal.type)) {
      errors.push(`Invalid appraisal type: ${data.appraisal.type}`);
    }
    if (!data.appraisal.itemCount) {
      errors.push('Missing required field: appraisal.itemCount');
    } else if (typeof data.appraisal.itemCount !== 'number') {
      errors.push('Invalid type for appraisal.itemCount: expected number');
    }
    if (!data.appraisal.sessionId) {
      errors.push('Missing required field: appraisal.sessionId');
    } else if (typeof data.appraisal.sessionId !== 'string') {
      errors.push('Invalid type for appraisal.sessionId: expected string');
    }
  }

  // Validate metadata
  if (data.metadata && typeof data.metadata === 'object') {
    if (!data.metadata.origin) {
      errors.push('Missing required field: metadata.origin');
    } else if (typeof data.metadata.origin !== 'string') {
      errors.push('Invalid type for metadata.origin: expected string');
    }
    if (!data.metadata.environment) {
      errors.push('Missing required field: metadata.environment');
    } else if (!['production', 'development'].includes(data.metadata.environment)) {
      errors.push('Invalid environment value');
    }
    if (!data.metadata.timestamp) {
      errors.push('Missing required field: metadata.timestamp');
    } else if (typeof data.metadata.timestamp !== 'number') {
      errors.push('Invalid type for metadata.timestamp: expected number');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateBulkAppraisalFinalized;