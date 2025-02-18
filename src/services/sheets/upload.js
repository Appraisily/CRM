const BaseSheetService = require('./base');

class UploadSheetService extends BaseSheetService {
  async logUpload(sessionId, timestamp, imageUrl) {
    this.checkInitialized();

    try {
      this.logger.info('Logging upload to Google Sheets...');
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetsId,
        range: 'Sheet1!A:A'
      });
      
      const nextRow = (response.data.values || []).length + 1;
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.sheetsId,
        range: `Sheet1!A${nextRow}:H${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(),           // A: Timestamp
            sessionId,                          // B: Session ID
            new Date(timestamp).toISOString(),  // C: Upload Time
            imageUrl,                           // D: Image URL
            'Pending Analysis',                 // E: Analysis Status
            '',                                // F: Analysis Time
            'Pending Origin',                   // G: Origin Status
            ''                                 // H: Origin Time
          ]]
        }
      });

      this.logger.success('Successfully logged upload to sheets');
      return true;
    } catch (error) {
      this.logger.error('Error logging upload to sheets:', error);
      throw error;
    }
  }
}

module.exports = new UploadSheetService();