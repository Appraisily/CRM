const BaseSheetService = require('./base');

class EmailSheetService extends BaseSheetService {
  async updateEmailSubmission(sessionId, email, timestamp, communicationType) {
    this.checkInitialized();

    try {
      this.logger.info('Attempting to update email in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        this.logger.error(`Session ID ${sessionId} not found in spreadsheet`);
        throw new Error(`Session ID ${sessionId} not found in spreadsheet`);
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!I${rowIndex + 1}`,
              values: [[email]]
            }
          ]
        }
      });

      this.logger.success('Successfully updated email in sheets');
      return true;
    } catch (error) {
      this.logger.error('Error updating email in sheets:', error);
      throw error;
    }
  }

  async updateFreeReportStatus(sessionId, success = true, timestamp, errorMessage = '') {
    this.checkInitialized();

    try {
      this.logger.info('Attempting to update free report status in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        this.logger.error(`Session ID ${sessionId} not found in spreadsheet`);
        throw new Error(`Session ID ${sessionId} not found in spreadsheet`);
      }

      const currentTime = new Date(timestamp || Date.now()).toISOString();
      const status = success ? 
        'Free Report Sent' : 
        `Free Report Failed: ${errorMessage || 'Unknown error'}`;

      await this.retryOperation(() =>
        this.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: this.sheetsId,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            data: [
              {
                range: `Sheet1!K${rowIndex + 1}:L${rowIndex + 1}`,
                values: [[
                  status,
                  currentTime
                ]]
              }
            ]
          }
        })
      );

      this.logger.success('Successfully updated free report status in sheets');
      return true;
    } catch (error) {
      this.logger.error('Error updating free report status in sheets', error);
      throw error;
    }
  }
}

module.exports = new EmailSheetService();