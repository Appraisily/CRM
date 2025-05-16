const { Pool } = require('pg');
const Logger = require('../../utils/logger');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.logger = new Logger('Database Connection');
  }

  async initialize() {
    try {
      this.logger.info('Initializing database connection using Cloud Run runtime variables');
      
      // Get database connection details directly from Cloud Run runtime variables
      const instanceConnectionName = process.env.DB_CRM_INSTANCE_CONNECTION_NAME;
      const databaseName = process.env.DB_CRM_NAME;
      const databasePassword = process.env.DB_CRM_PASSWORD;
      
      // Validate required environment variables
      if (!instanceConnectionName) {
        throw new Error('DB_CRM_INSTANCE_CONNECTION_NAME environment variable is required');
      }
      
      if (!databaseName) {
        throw new Error('DB_CRM_NAME environment variable is required');
      }
      
      if (!databasePassword) {
        throw new Error('DB_CRM_PASSWORD environment variable is required');
      }
      
      this.logger.info('Using database configuration from runtime variables', {
        instanceConnectionName,
        databaseName,
        passwordProvided: !!databasePassword
      });

      // Configure connection pool with Cloud Run variables
      const config = {
        user: 'postgres', // Fixed postgres user
        password: databasePassword,
        database: databaseName,
        host: `/cloudsql/${instanceConnectionName}`,
        ssl: false,
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000
      };

      // Configure connection pool
      this.pool = new Pool(config);
      this.logger.info('Database pool configured with Cloud Run variables');

      // Add error handler to the pool
      this.pool.on('error', (err, client) => {
        this.logger.error('Unexpected error on idle client', err);
      });

      // Add connection handler
      this.pool.on('connect', (client) => {
        this.logger.info('New client connected to the pool');
        client.on('error', err => {
          this.logger.error('Client error', err);
        });
      });

      // Test the connection
      await this.pool.query('SELECT NOW()');
      this.logger.success('Database connection test successful');

      return this.pool;
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  getPool() {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool;
  }

  async disconnect() {
    if (this.pool) {
      try {
        this.logger.info('Disconnecting from database');
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

module.exports = new DatabaseConnection();