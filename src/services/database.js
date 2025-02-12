const { Pool } = require('pg');
const Logger = require('../utils/logger');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const PROJECT_ID = 'civil-forge-403609';

class DatabaseService {
  constructor() {
    this.pool = null;
    this.logger = new Logger('Database Service');
    this.secretClient = new SecretManagerServiceClient();
  }

  async initialize() {
    try {
      this.logger.info('Initializing database connection');

      // Get database connection details from environment
      const instanceUnixSocket = process.env.DB_SOCKET_PATH || '/cloudsql';
      const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
      
      // Configure connection pool with more resilient settings
      const config = {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'appraisily_activity_db',
        max: 10, // Reduce max connections
        idleTimeoutMillis: 10000, // Reduce idle timeout to 10 seconds
        connectionTimeoutMillis: 5000, // Increase connection timeout to 5 seconds
        maxUses: 7500, // Recycle connections after 7500 queries
      };

      // Add Unix socket configuration if running in Cloud Run
      if (instanceConnectionName) {
        config.host = `${instanceUnixSocket}/${instanceConnectionName}`;
      }

      // Configure connection pool
      this.pool = new Pool(config);

      // Add error handler to the pool
      this.pool.on('error', (err, client) => {
        this.logger.error('Unexpected error on idle client', err);
      });

      // Add connection handler
      this.pool.on('connect', (client) => {
        this.logger.info('New client connected to the pool');
      });

      // Test the connection
      const testResult = await this.pool.query('SELECT NOW()');
      this.logger.success('Database connection test successful');

      // Check for existing tables
      const { rows } = await this.pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      this.logger.info('Database tables found:', {
        tableCount: rows.length,
        tables: rows.map(row => row.table_name)
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

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      this.logger.info('Executed query', { 
        text, 
        duration,
        rowCount: result.rowCount 
      });
      return result;
    } catch (error) {
      this.logger.error('Query error', { text, error: error.message });
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      try {
        this.logger.info('Disconnecting from database');
        // Wait for all queries to finish
        await Promise.all(this.pool.waitingCount);
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