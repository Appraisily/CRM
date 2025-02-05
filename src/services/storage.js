const { Storage } = require('@google-cloud/storage');
const openai = require('./openai');
const Logger = require('../utils/logger');
const { InitializationError } = require('../utils/errors');

class CloudServices {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.logger = new Logger('Cloud Services');
  }

  async initialize(projectId, keyFilePath, bucketName, openaiApiKey) {
    try {
      // Initialize Google Cloud Storage
      this.logger.info('Initializing Google Cloud Storage client');
      this.storage = new Storage({
        projectId,
        keyFilename: keyFilePath,
      });
      this.logger.success('Google Cloud Storage client initialized');

      this.bucket = this.storage.bucket(bucketName);
      this.logger.info(`Bucket set to: ${bucketName}`);

      // Verify bucket exists
      const [exists] = await this.bucket.exists();
      if (!exists) {
        throw new InitializationError(`Bucket '${bucketName}' does not exist`);
      }
      this.logger.success(`Bucket '${bucketName}' exists and is accessible`);

      // Initialize OpenAI client
      this.logger.info('Initializing OpenAI client');
      openai.initialize(openaiApiKey);
      this.logger.success('OpenAI client initialized');
      this.logger.end();

    } catch (error) {
      this.logger.error('Error initializing cloud services', error);
      throw error;
    }
  }

  getBucket() {
    return this.bucket;
  }
}

module.exports = new CloudServices();