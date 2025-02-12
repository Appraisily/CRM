const { ValidationError } = require('../../../utils/errors');

function validateAppraisalRequest(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    appraisal: 'object',
    metadata: 'object'
  };

  const appraisalFields = {
    serviceType: 'string',
    sessionId: 'string',
    requestDate: 'string',
    status: 'string',
    editLink: 'string',
    images: 'object',
    value: 'object',
    documents: 'object',
    publishing: 'object'
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

  // Check appraisal object fields
  if (data.appraisal && typeof data.appraisal === 'object') {
    for (const [field, type] of Object.entries(appraisalFields)) {
      if (!data.appraisal[field]) {
        errors.push(`Missing required field: appraisal.${field}`);
      } else if (typeof data.appraisal[field] !== type) {
        errors.push(`Invalid type for appraisal.${field}: expected ${type}`);
      }
    }

    // Validate value object
    if (data.appraisal.value) {
      const { amount, currency, range } = data.appraisal.value;
      if (typeof amount !== 'number') {
        errors.push('Invalid type for appraisal.value.amount: expected number');
      }
      if (typeof currency !== 'string') {
        errors.push('Invalid type for appraisal.value.currency: expected string');
      }
      if (!range || typeof range.min !== 'number' || typeof range.max !== 'number') {
        errors.push('Invalid range object in appraisal.value');
      }
    }
  }

  // Validate customer data
  if (data.customer && typeof data.customer === 'object') {
    if (!data.customer.email) {
      errors.push('Missing required field: customer.email');
    } else if (typeof data.customer.email !== 'string') {
      errors.push('Invalid type for customer.email: expected string');
    }
    if (!data.customer.name) {
      errors.push('Missing required field: customer.name');
    } else if (typeof data.customer.name !== 'string') {
      errors.push('Invalid type for customer.name: expected string');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateAppraisalRequest;