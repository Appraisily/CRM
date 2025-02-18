const BaseSheetService = require('./base');

class AnalysisSheetService extends BaseSheetService {
  async updateVisualSearchResults(sessionId, analysisResults, category) {
    this.checkInitialized();

    try {
      this.logger.info('Attempting to update visual search results in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        this.logger.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!E${rowIndex + 1}:F${rowIndex + 1}`,
              values: [[
                `Analysis Complete - ${category || 'Unknown'}`,
                new Date().toISOString()
              ]]
            }
          ]
        }
      });

      this.logger.success('Successfully updated visual search results in sheets');
      return true;
    } catch (error) {
      this.logger.error('Error updating visual search results in sheets:', error);
      return false;
    }
  }

  async updateDetailedAnalysis(sessionId, detailedAnalysis) {
    this.checkInitialized();

    try {
      this.logger.info('Attempting to update detailed analysis in Google Sheets...');
      
      const rowIndex = await this.findRowBySessionId(sessionId);
      if (rowIndex === -1) {
        this.logger.error(`Session ID ${sessionId} not found in spreadsheet`);
        return false;
      }

      const {
        maker_analysis = {},
        age_analysis = {},
        origin_analysis = {}
      } = detailedAnalysis || {};

      const analysisInfo = [
        maker_analysis.creator_name || 'Unknown',
        age_analysis.estimated_date_range || 'Unknown',
        origin_analysis.likely_origin || 'Unknown'
      ].join(' | ');

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.sheetsId,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          data: [
            {
              range: `Sheet1!G${rowIndex + 1}:H${rowIndex + 1}`,
              values: [[
                `Detailed Analysis Complete - ${analysisInfo}`,
                new Date().toISOString()
              ]]
            }
          ]
        }
      });

      this.logger.success('Successfully updated detailed analysis in sheets');
      return true;
    } catch (error) {
      this.logger.error('Error updating detailed analysis in sheets:', error);
      return false;
    }
  }
}

module.exports = new AnalysisSheetService();