const databaseService = require('../../database');
const Logger = require('../../../utils/logger');

class ChatSummaryProcessor {
  constructor() {
    this.logger = new Logger('Chat Summary Processor');
  }

  async process(data) {
    try {
      this.logger.info('Processing chat summary', {
        sessionId: data.chat.sessionId,
        messageCount: data.chat.messageCount
      });

      // Create or get user
      const userResult = await databaseService.query(
        `INSERT INTO users (email) 
         VALUES ($1)
         ON CONFLICT (email) DO UPDATE 
         SET last_activity = NOW()
         RETURNING id`,
        [data.customer.email]
      );
      
      const userId = userResult.rows[0].id;
      
      // Record chat session
      await databaseService.query(
        `INSERT INTO chat_sessions 
         (id, user_id, agent_id, status, started_at, ended_at, satisfaction_score, transcript) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          data.chat.sessionId,
          userId,
          data.metadata.agentId,
          'closed',
          data.chat.startedAt,
          data.chat.endedAt,
          data.chat.satisfactionScore,
          data.chat.summary
        ]
      );

      // Record activity
      await databaseService.query(
        `INSERT INTO user_activities 
         (user_id, activity_type, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          'chat',
          'completed',
          {
            sessionId: data.chat.sessionId,
            messageCount: data.chat.messageCount,
            topics: data.chat.topics,
            sentiment: data.chat.sentiment,
            origin: data.metadata.origin,
            timestamp: data.metadata.timestamp
          }
        ]
      );

      this.logger.success('Chat summary processed successfully');
      return {
        success: true,
        sessionId: data.chat.sessionId,
        userId
      };

    } catch (error) {
      this.logger.error('Failed to process chat summary', error);
      throw error;
    }
  }
}

module.exports = ChatSummaryProcessor;