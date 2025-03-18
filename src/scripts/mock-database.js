/**
 * A mock implementation of the database service for testing
 */
const Logger = require('../utils/logger');

class MockQueryManager {
  async query(text, params) {
    return { rows: [] };
  }
}

class MockDatabaseService {
  constructor() {
    this.logger = new Logger('Mock Database');
    this.queryManager = new MockQueryManager();
  }

  async initialize() {
    this.logger.info('Mock database initialized');
    return true;
  }

  async query(text, params) {
    this.logger.info(`Mock query: ${text}`);
    return this.queryManager.query(text, params);
  }

  async disconnect() {
    this.logger.info('Mock database disconnected');
    return true;
  }
}

module.exports = new MockDatabaseService();