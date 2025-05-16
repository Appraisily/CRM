const BaseSheetService = require('./base');

class BulkAppraisalSheetService extends BaseSheetService {
  constructor() {
    super();
    this.bulkAppraisalsSheet = "Bulk Appraisals";
  }

  async logBulkAppraisalEmail(sessionId, email, timestamp) {
    this.checkInitialized();

    try {
      this.logger.info('Logging bulk appraisal email to Google Sheets...');
      
      const response = await this.retryOperation(() =>
        this.sheets.spreadsheets.values.get({
          spreadsheetId: this.sheetsId,
          range: `'${this.bulkAppraisalsSheet}'!A:A`
        })
      );
      
      const nextRow = (response.data.values || []).length + 1;
      
      await this.retryOperation(() =>
        this.sheets.spreadsheets.values.update({
          spreadsheetId: this.sheetsId,
          range: `'${this.bulkAppraisalsSheet}'!A${nextRow}:D${nextRow}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              new Date(timestamp * 1000).toISOString(), // A: Timestamp
              sessionId,                                // B: Session ID
              email,                                    // C: Email
              'Email Submitted'                         // D: Status
            ]]
          }
        })
      );

      this.logger.success('Successfully logged bulk appraisal email to sheets');
      return true;
    } catch (error) {
      this.logger.error('Error logging bulk appraisal email to sheets', error);
      throw error;
    }
  }
}

module.exports = new BulkAppraisalSheetService();