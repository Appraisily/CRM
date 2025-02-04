const fetch = require('node-fetch');

class AnalysisClient {
  constructor(baseUrl = 'https://appraisals-web-services-backend-856401495068.us-central1.run.app') {
    this.baseUrl = baseUrl;
    this.timeout = 60000; // 60 seconds
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async fetchAnalysis(sessionId, endpoint) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`${endpoint} failed with status ${response.status}`);
        }

        const result = await response.json();
        return result.results;
      } catch (error) {
        console.error(`Attempt ${attempt}/${this.maxRetries} failed for ${endpoint}:`, error);
        if (attempt < this.maxRetries) {
          console.log(`Waiting ${this.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          throw error;
        }
      }
    }
  }

  async getAnalysisResults(sessionId) {
    try {
      console.log('\n=== Fetching Analysis Results ===');
      const [visualSearch, originAnalysis, detailedAnalysis] = await Promise.all([
        this.fetchAnalysis(sessionId, 'visual-search')
          .then(data => data)
          .catch(error => {
            console.error('Visual search failed:', error);
            return null;
          }),
        this.fetchAnalysis(sessionId, 'origin-analysis')
          .then(data => data)
          .catch(error => {
            console.error('Origin analysis failed:', error);
            return null;
          }),
        this.fetchAnalysis(sessionId, 'full-analysis')
          .then(data => data?.detailedAnalysis)
          .catch(error => {
            console.error('Full analysis failed:', error);
            return null;
          })
      ]);

      console.log('Analysis Results Status:', {
        visualSearch: visualSearch ? '✓' : '✗',
        originAnalysis: originAnalysis ? '✓' : '✗',
        detailedAnalysis: detailedAnalysis ? '✓' : '✗'
      });

      return { visualSearch, originAnalysis, detailedAnalysis };
    } catch (error) {
      console.error('Failed to fetch analysis results:', error);
      return { visualSearch: null, originAnalysis: null, detailedAnalysis: null };
    }
  }
}

module.exports = new AnalysisClient();