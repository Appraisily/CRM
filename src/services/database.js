const { PrismaClient } = require('@prisma/client');
const Logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.client = null;
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

      // Configure Prisma to use Unix socket
      const socketPath = `${instanceUnixSocket}/${instanceConnectionName}`;
      
      this.client = new PrismaClient({
        datasources: {
          db: {
            url: `postgresql://postgres:${process.env.DB_PASSWORD}@localhost:5432/appraisily_activity_db?host=${socketPath}`
          }
        }
      });

      this.logger.success('Database connection initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database connection', error);
      throw error;
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error('Database client not initialized');
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      try {
        this.logger.info('Disconnecting from database');
        await this.client.$disconnect();
        this.logger.success('Database disconnected successfully');
      } catch (error) {
        this.logger.error('Error disconnecting from database', error);
        throw error;
      }
    }
  }
}

module.exports = new DatabaseService();