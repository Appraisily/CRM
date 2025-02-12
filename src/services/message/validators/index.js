const validateScreenerNotification = require('./screenerNotification');
const validateChatSummary = require('./chatSummary');
const validateGmailInteraction = require('./gmailInteraction');
const validateAppraisalRequest = require('./appraisalRequest');

module.exports = {
  validateScreenerNotification,
  validateChatSummary,
  validateGmailInteraction,
  validateAppraisalRequest
};