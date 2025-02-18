const { google } = require('googleapis');
const Logger = require('../../utils/logger');

class BaseSheetService {
  constructor() {
    this.initialized = false;
    this.sheetsId = null;
    this.sheets = null;
    this.auth = null;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.logger = new Logger('Sheets Service');
  }

  initialize(keyFilePath, sheetsId) {
    if (!keyFilePath || !sheetsId) {
      throw new Error('Service account key file and sheets ID are required');
    }
    this.sheetsId = sheetsId;

    try {
      this.logger.info('Initializing Google Sheets service...');
      this.auth = new google.auth.GoogleAuth({
        keyFile: keyFilePath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ 
        version: 'v4', 
        auth: this.auth 
      });      
      
      this.initialized = true;
      this.logger.success('Google Sheets service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Google Sheets service:', error);
      throw error;
    }
  }

  async retryOperation(operation, retryCount = 0) {
    try {
      return await operation();
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        this.logger.info(`Retrying operation (${retryCount + 1}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.retryOperation(operation, retryCount + 1);
      }
      throw error;
    }
  }

  isRetryableError(error) {
    const retryableErrors = [
      'socket disconnected',
      'ECONNRESET',
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
      'socket hang up',
      'connect ETIMEDOUT',
      'Client network socket disconnected'
    ];

    return retryableErrors.some(msg => 
      error.message?.toLowerCase().includes(msg.toLowerCase())
    );
  }

  async findRowBySessionId(sessionId) {
    const response = await this.retryOperation(() =>
      this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:P',
      })
    );

    const rows = response.data.values || [];
    return rows.findIndex(row => row[1] === sessionId);
  }

  checkInitialized() {
    if (!this.initialized) {
      throw new Error('Sheets service not initialized');
    }
  }
}

module.exports = BaseSheetService;