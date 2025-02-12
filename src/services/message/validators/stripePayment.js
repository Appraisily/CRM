const { ValidationError } = require('../../../utils/errors');

function validateStripePayment(data) {
  const requiredFields = {
    crmProcess: 'string',
    customer: 'object',
    payment: 'object',
    metadata: 'object'
  };

  const customerFields = {
    email: 'string',
    name: 'string',
    stripeCustomerId: 'string'
  };

  const paymentFields = {
    checkoutSessionId: 'string',
    paymentIntentId: 'string',
    amount: 'number',
    currency: 'string',
    status: 'string',
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

  // Validate customer fields
  if (data.customer && typeof data.customer === 'object') {
    for (const [field, type] of Object.entries(customerFields)) {
      if (!data.customer[field]) {
        errors.push(`Missing required field: customer.${field}`);
      } else if (typeof data.customer[field] !== type) {
        errors.push(`Invalid type for customer.${field}: expected ${type}`);
      }
    }
  }

  // Validate payment fields
  if (data.payment && typeof data.payment === 'object') {
    for (const [field, type] of Object.entries(paymentFields)) {
      if (!data.payment[field]) {
        errors.push(`Missing required field: payment.${field}`);
      } else if (typeof data.payment[field] !== type) {
        errors.push(`Invalid type for payment.${field}: expected ${type}`);
      }
    }

    // Validate payment metadata
    if (data.payment.metadata) {
      if (!data.payment.metadata.serviceType) {
        errors.push('Missing required field: payment.metadata.serviceType');
      }
      if (!data.payment.metadata.sessionId) {
        errors.push('Missing required field: payment.metadata.sessionId');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = validateStripePayment;