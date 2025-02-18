const Logger = require('../../utils/logger');

class QueryManager {
  constructor(pool) {
    this.pool = pool;
    this.logger = new Logger('Query Manager');
  }

  async query(text, params) {
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
      throw error;
    }
  }
}

module.exports = QueryManager;