const { Pool } = require('pg');
const Logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.logger = new Logger('Database Service');
  }

  initialize() {
    try {
      this.logger.info('Initializing database connection');
      
      // Get database connection details from environment
      const instanceUnixSocket = process.env.DB_SOCKET_PATH || '/cloudsql';
      const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
      
      if (!instanceConnectionName) {
        throw new Error('INSTANCE_CONNECTION_NAME environment variable is required');
      }

      // Configure connection pool
      this.pool = new Pool({
        user: 'postgres',
        password: process.env.DB_PASSWORD,
        database: 'appraisily_activity_db',
        host: `${instanceUnixSocket}/${instanceConnectionName}`,
        port: 5432,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      });

      // Test the connection
      this.pool.query('SELECT NOW()', (err, res) => {
        if (err) {
          this.logger.error('Error testing database connection', err);
        } else {
          this.logger.success('Database connection test successful');
        }
      });

      this.logger.success('Database connection pool initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool.query(text, params);
  }

  async disconnect() {
    if (this.pool) {
      try {
        this.logger.info('Disconnecting from database');
        await this.pool.end();
        this.logger.success('Database disconnected successfully');
      } catch (error) {
        this.logger.error('Error disconnecting from database', error);
        throw error;
      }
    }
  }
}

module.exports = new DatabaseService();