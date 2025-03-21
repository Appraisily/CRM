const connection = require('./connection');
const QueryManager = require('./query');
const SchemaManager = require('./schema');
const Logger = require('../../utils/logger');

class DatabaseService {
  constructor() {
    this.logger = new Logger('Database Service');
    this.connection = connection;
    this.queryManager = null;
  }

  async initialize() {
    try {
      this.logger.info('Initializing database service');
      
      // Initialize connection
      const pool = await this.connection.initialize();
      
      // Initialize schema
      this.schemaManager = new SchemaManager(pool);
      await this.schemaManager.checkAndApplySchema();

      // Initialize managers
      this.queryManager = new QueryManager(pool);

      this.logger.success('Database service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database service', error);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.queryManager) {
      throw new Error('Database service not initialized');
    }
    return this.queryManager.query(text, params);
  }

  async disconnect() {
    return this.connection.disconnect();
  }
}

module.exports = new DatabaseService();