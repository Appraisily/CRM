const Logger = require('../../utils/logger');

class QueryManager {
  constructor(pool) {
    this.pool = pool;
    this.logger = new Logger('Query Manager');
  }

  async query(text, params) {
    // Check if database is available globally
    if (global.databaseAvailable === false) {
      this.logger.warn('Query attempted but database is unavailable', {
        text,
        paramCount: params ? params.length : 0
      });
      // Return mock result with empty rows array
      return { 
        rows: [],
        rowCount: 0,
        command: 'MOCK',
        fields: []
      };
    }
    
    const start = Date.now();
    try {
      this.logger.info('Executing query:', {
        text,
        paramCount: params ? params.length : 0
      });

      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      this.logger.info('Query completed', { 
        duration,
        rowCount: result.rowCount 
      });

      return result;
    } catch (error) {
      this.logger.error('Query error', {
        text,
        params,
        error: error.message,
        duration: Date.now() - start
      });
      
      // If the error is related to a database connection, set global flag
      if (
        error.message.includes('Connection terminated') ||
        error.message.includes('timeout') ||
        error.message.includes('connection refused')
      ) {
        global.databaseAvailable = false;
        this.logger.warn('Database marked as unavailable');
      }
      
      // Return mock empty result to allow processing to continue
      return { 
        rows: [],
        rowCount: 0,
        command: 'MOCK',
        fields: []
      };
    }
  }
}

module.exports = QueryManager;