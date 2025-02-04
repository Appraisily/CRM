const fetch = require('node-fetch');
const { Storage } = require('@google-cloud/storage');

class AnalysisClient {
  constructor(baseUrl = 'https://appraisals-web-services-backend-856401495068.us-central1.run.app') {
    this.baseUrl = baseUrl;
    this.timeout = 60000; // 60 seconds
    this.maxRetries = 3;
    this.retryDelay = 5000;
    this.storage = new Storage();
    this.bucket = this.storage.bucket('images_free_reports');
  }

  async checkGCSFile(sessionId, filename) {
    try {
      const file = this.bucket.file(`sessions/${sessionId}/${filename}`);
      const [exists] = await file.exists();
      
      if (exists) {
        console.log(`✓ Found ${filename} in GCS`);
        const [content] = await file.download();
        return JSON.parse(content.toString());
      }
      
      console.log(`✗ ${filename} not found in GCS`);
      return null;
    } catch (error) {
      console.error(`Error checking ${filename} in GCS:`, error);
      return null;
    }
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
      console.log('\n=== Checking GCS for Analysis Results ===');
      
      // First check GCS for existing results
      const [gcsVisualSearch, gcsOriginAnalysis, gcsDetailedAnalysis] = await Promise.all([
        this.checkGCSFile(sessionId, 'analysis.json'),
        this.checkGCSFile(sessionId, 'origin.json'),
        this.checkGCSFile(sessionId, 'detailed.json')
      ]);

      // If all results exist in GCS, return them
      if (gcsVisualSearch && gcsOriginAnalysis && gcsDetailedAnalysis) {
        console.log('✓ All analysis results found in GCS');
        return {
          visualSearch: gcsVisualSearch,
          originAnalysis: gcsOriginAnalysis,
          detailedAnalysis: gcsDetailedAnalysis
        };
      }

      // Otherwise, fetch missing results from API
      console.log('\n=== Fetching Missing Analysis Results from API ===');
      const [visualSearch, originAnalysis, detailedAnalysis] = await Promise.all([
        !gcsVisualSearch ? this.fetchAnalysis(sessionId, 'visual-search')
          .then(data => data)
          .catch(error => {
            console.error('Visual search failed:', error);
            return null;
          }) : Promise.resolve(gcsVisualSearch),
        !gcsOriginAnalysis ? this.fetchAnalysis(sessionId, 'origin-analysis')
          .then(data => data)
          .catch(error => {
            console.error('Origin analysis failed:', error);
            return null;
          }) : Promise.resolve(gcsOriginAnalysis),
        !gcsDetailedAnalysis ? this.fetchAnalysis(sessionId, 'full-analysis')
          .then(data => data?.detailedAnalysis)
          .catch(error => {
            console.error('Full analysis failed:', error);
            return null;
          }) : Promise.resolve(gcsDetailedAnalysis)
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