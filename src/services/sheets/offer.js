const BaseSheetService = require('./base');

class OfferSheetService extends BaseSheetService {
  async updateOfferStatus(sessionId, success = true, offerContent = '', scheduledTime = null) {
    this.checkInitialized();

    try {
      this.logger.info('Attempting to update offer status in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        this.logger.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      let status;
      if (!success) {
        status = `Offer Failed: ${offerContent}`;
      } else if (scheduledTime) {
        status = 'Offer Scheduled';
      } else {
        status = 'Offer Sent';
      }

      const timestamp = scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString();

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!M${rowIndex + 1}:P${rowIndex + 1}`,
              values: [[
                status,
                timestamp,
                success ? (scheduledTime ? 'Scheduled' : 'Sent') : 'Failed',
                offerContent
              ]]
            }
          ]
        }
      });

      this.logger.success('Successfully updated offer status in sheets');
      return true;
    } catch (error) {
      this.logger.error('Error updating offer status in sheets:', error);
      throw error;
    }
  }
}

module.exports = new OfferSheetService();