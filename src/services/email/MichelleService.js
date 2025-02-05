const fetch = require('node-fetch');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class MichelseService {
  constructor() {
    this.apiUrl = 'https://michelle-gmail-856401495068.us-central1.run.app/api/process-message';
    this.TIMEOUT_MS = 30000; // 30 second timeout
    this.apiKey = null;
    this.fromEmail = null;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.logger = new Logger('Michelle Service');
  }

  initialize(apiKey, fromEmail) {
    if (!apiKey || !fromEmail) {
      throw new InitializationError('API key and from email are required');
    }
    this.apiKey = apiKey;
    this.fromEmail = fromEmail;
  }

  async generatePrompt(analysisData) {
    const {
      detailedAnalysis = {},
      visualSearch = {},
      originAnalysis = {}
    } = analysisData;

    const {
      maker_analysis = {},
      origin_analysis = {},
      age_analysis = {},
      visual_search = {},
      marks_recognition = {}
    } = detailedAnalysis;

    return `You are Andrés Gómez, Lead Art Appraiser at Appraisily. You're writing a follow-up email to a potential client who used our free screening tool. The goal is to invite them to purchase a professional appraisal for their item in a warm, direct, and personal manner—without sounding overly formal or automated.

CONTEXT:
[Analysis Details from Initial Screening]
- Item Type: ${maker_analysis.creator_name || 'artwork'}
- Maker Analysis: ${maker_analysis.reasoning || 'Not available'}
- Origin Analysis: ${origin_analysis.reasoning || 'Not available'}
- Age Analysis: ${age_analysis.reasoning || 'Not available'}
- Visual Analysis: ${visual_search.notes || 'Not available'}
- Notable Features: ${marks_recognition.marks_identified || 'Not available'}
- Preliminary Value Range: Requires professional appraisal
- Special Offer: 20% discount on our base appraisal fee

OBJECTIVE:
- Encourage the client to move forward with a full professional appraisal.
- Highlight what makes their piece interesting or potentially valuable.
- Use a tone that is personable, genuine, and not overly formal.
- Emphasize the limited-time 20% discount on our base appraisal fee.
- Create a sense of urgency by mentioning the discount is only available for 48 hours.

OUTPUT REQUIREMENTS:
1. Your final answer must be **valid JSON** with exactly two keys: "subject" and "content".
2. The value of "content" must be an **HTML string** (basic tags like \`<p>\` or \`<br>\` are acceptable). 
3. No additional keys or placeholders.
4. Style the text freely—no strict structure—yet keep it succinct (around 200–300 words if possible).
5. Use **friendly, natural language** that fits a direct yet professional tone.
6. Avoid definitive value claims or guarantees; do not use placeholders or variables. Provide a plain, readable message.
7. IMPORTANT: Make sure to mention the 20% discount naturally in the content, emphasizing it's a limited-time offer.

Now, please produce your final answer **in valid JSON** with the structure:
{
  "subject": "...",
  "content": "..."
}`;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, options, retryCount = 0) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (retryCount < this.maxRetries) {
          console.log(`Request failed with status ${response.status}. Retrying (${retryCount + 1}/${this.maxRetries})...`);
          await this.sleep(this.retryDelay * (retryCount + 1)); // Exponential backoff
          return this.fetchWithRetry(url, options, retryCount + 1);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;

    } catch (error) {
      console.log(`Attempt ${retryCount + 1} failed:`, error.message);

      if (error.name === 'AbortError') {
        console.warn(`Timeout validating URL: ${url} (exceeded ${this.TIMEOUT_MS}ms)`);
      }
      
      if (retryCount < this.maxRetries) {
        console.log(`Retrying request (${retryCount + 1}/${this.maxRetries})...`);
        await this.sleep(this.retryDelay * (retryCount + 1)); // Exponential backoff
        return this.fetchWithRetry(url, options, retryCount + 1);
      }

      console.error(`Failed to complete request after ${this.maxRetries} retries:`, error.message);
      throw error;
    }
  }

  async generateContent(analysisData) {
    if (!this.apiKey || !this.fromEmail) {
      throw new InitializationError('Michelle service not initialized');
    }

    this.logger.info('Michelle API Request Details', {
      maker_analysis: analysisData.detailedAnalysis?.maker_analysis || 'Not available',
      origin_analysis: analysisData.detailedAnalysis?.origin_analysis || 'Not available',
      age_analysis: analysisData.detailedAnalysis?.age_analysis || 'Not available',
      visual_search: analysisData.detailedAnalysis?.visual_search || 'Not available',
      marks_recognition: analysisData.detailedAnalysis?.marks_recognition || 'Not available'
    });

    const prompt = await this.generatePrompt(analysisData);
    this.logger.info('Generated Prompt', { prompt });

    const requestBody = {
      text: prompt,
      senderName: 'Andrés Gómez',
      senderEmail: this.fromEmail
    };

    this.logger.info('Sending request to Michelle API', { requestBody });

    try {
      const response = await this.fetchWithRetry(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      this.logger.info('Michelle API Response Received', { status: response.status });
      const responseText = await response.text();

      // Try to parse the response text as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (error) {
        this.logger.error('Failed to parse response as JSON', error);
        throw new ProcessingError(`Invalid JSON response: ${responseText.substring(0, 200)}...`);
      }

      if (!data.success || !data.response || !data.response.text) {
        throw new ProcessingError('Invalid response format from Michelle API');
      }

      try {
        const content = JSON.parse(data.response.text);
        if (!content.subject || !content.content) {
          this.logger.error('Invalid content structure', { content });
          throw new ProcessingError('Missing required fields in email content');
        }
        this.logger.info('Content Generated Successfully', {
          subject: content.subject,
          contentLength: content.content.length
        });
        this.logger.end();
        return content;
      } catch (error) {
        this.logger.error('Failed to parse Michelle API response', error);
        throw new ProcessingError(`Failed to parse Michelle API response: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Error in Michelle API request', error);
      throw error;
    }
  }
}

module.exports = new MichelseService();