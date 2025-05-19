const validateScreenerNotification = require('./screenerNotification');
const validateChatSummary = require('./chatSummary');
const validateGmailInteraction = require('./gmailInteraction');
const validateAppraisalRequest = require('./appraisalRequest');
const validateStripePayment = require('./stripePayment');
const validateBulkAppraisalEmailUpdate = require('./bulkAppraisalEmailUpdate.js');
const validateBulkAppraisalFinalized = require('./bulkAppraisalFinalized.js');
const validateAppraisalReadyNotification = require('./appraisalReadyNotification.js');

module.exports = {
  validateScreenerNotification,
  validateChatSummary,
  validateGmailInteraction,
  validateAppraisalRequest,
  validateStripePayment,
  validateBulkAppraisalEmailUpdate,
  validateBulkAppraisalFinalized,
  validateAppraisalReadyNotification
};