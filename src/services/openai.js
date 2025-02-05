const { Configuration, OpenAIApi } = require('openai');
const Logger = require('../utils/logger');
const { InitializationError } = require('../utils/errors');

class OpenAIService {
  constructor() {
    this.client = null;
    this.logger = new Logger('OpenAI Service');
  }

  initialize(apiKey) {
    if (!apiKey) {
      throw new InitializationError('OpenAI API key is required');
    }

    try {
      const configuration = new Configuration({ apiKey });
      this.client = new OpenAIApi(configuration);
      this.logger.success('OpenAI client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenAI client', error);
      throw new InitializationError(`Failed to initialize OpenAI client: ${error.message}`);
    }
  }

  async generateOfferContent(analysisData) {
    if (!this.client) {
      throw new InitializationError('OpenAI client not initialized');
    }

    try {
      const prompt = this.generatePrompt(analysisData);
      
      const response = await this.client.createCompletion({
        model: "gpt-3.5-turbo-instruct",
        prompt,
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      });

      const content = response.data.choices[0].text.trim();
      
      return {
        success: true,
        content
      };
    } catch (error) {
      this.logger.error('Error generating offer content', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generatePrompt(analysisData) {
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

    return `You are Andrés Gómez, Lead Art Appraiser at Appraisily. Write a personalized email to invite a potential client to purchase a professional appraisal for their artwork. Use a warm, direct tone while maintaining professionalism.

CONTEXT:
[Analysis Details]
- Item Type: ${maker_analysis.creator_name || 'artwork'}
- Maker Analysis: ${maker_analysis.reasoning || 'Not available'}
- Origin Analysis: ${origin_analysis.reasoning || 'Not available'}
- Age Analysis: ${age_analysis.reasoning || 'Not available'}
- Visual Analysis: ${visual_search.notes || 'Not available'}
- Notable Features: ${marks_recognition.marks_identified || 'Not available'}

KEY POINTS:
- Highlight interesting aspects of their piece
- Mention potential value indicators
- Emphasize the 20% discount (available for 48 hours)
- Create urgency without being pushy
- Keep it personal and engaging

REQUIREMENTS:
- Length: 200-300 words
- Tone: Professional yet warm
- Include specific details from the analysis
- Mention the limited-time discount naturally
- Focus on the value of a professional appraisal

Write the email content now, maintaining a natural flow and personal touch.`;
  }
}

module.exports = new OpenAIService();