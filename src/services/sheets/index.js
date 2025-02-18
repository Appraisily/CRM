const uploadService = require('./upload');
const emailService = require('./email');
const offerService = require('./offer');
const analysisService = require('./analysis');
const bulkService = require('./bulk');

class SheetsService {
  initialize(keyFilePath, sheetsId) {
    uploadService.initialize(keyFilePath, sheetsId);
    emailService.initialize(keyFilePath, sheetsId);
    offerService.initialize(keyFilePath, sheetsId);
    analysisService.initialize(keyFilePath, sheetsId);
    bulkService.initialize(keyFilePath, sheetsId);
  }

  // Bulk appraisal methods
  logBulkAppraisalEmail(sessionId, email, timestamp) {
    return bulkService.logBulkAppraisalEmail(sessionId, email, timestamp);
  }

  // Upload methods
  logUpload(sessionId, timestamp, imageUrl) {
    return uploadService.logUpload(sessionId, timestamp, imageUrl);
  }

  // Email methods
  updateEmailSubmission(sessionId, email, timestamp, communicationType) {
    return emailService.updateEmailSubmission(sessionId, email, timestamp, communicationType);
  }

  updateFreeReportStatus(sessionId, success, timestamp, errorMessage) {
    return emailService.updateFreeReportStatus(sessionId, success, timestamp, errorMessage);
  }

  // Offer methods
  updateOfferStatus(sessionId, success, offerContent, scheduledTime) {
    return offerService.updateOfferStatus(sessionId, success, offerContent, scheduledTime);
  }

  // Analysis methods
  updateVisualSearchResults(sessionId, analysisResults, category) {
    return analysisService.updateVisualSearchResults(sessionId, analysisResults, category);
  }

  updateDetailedAnalysis(sessionId, detailedAnalysis) {
    return analysisService.updateDetailedAnalysis(sessionId, detailedAnalysis);
  }
}

module.exports = new SheetsService();