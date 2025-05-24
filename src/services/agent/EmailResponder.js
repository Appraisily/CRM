const { Configuration, OpenAIApi } = require('openai');
const databaseService = require('../database');
const gmailService = require('../gmail');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class EmailResponder {
  constructor() {
    this.initialized = false;
    this.openai = null;
    this.logger = new Logger('Email Responder');
  }

  initialize(apiKey) {
    if (!apiKey) {
      throw new InitializationError('OpenAI API key required to initialize EmailResponder');
    }

    const configuration = new Configuration({ apiKey });
    this.openai = new OpenAIApi(configuration);
    this.initialized = true;
    this.logger.success('EmailResponder initialized');
  }

  /**
   * Main entrypoint: fetch info, talk to OpenAI via function-calling, create Gmail draft
   * @param {object} data – Parsed gmailInteraction payload
   */
  async processIncomingEmail(data) {
    if (!this.initialized) {
      throw new InitializationError('EmailResponder not initialized');
    }

    try {
      const { customer, email } = data;

      // Build conversation
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful customer support assistant. Compose a friendly, professional email reply based on the customer\'s message. If additional information is required, you may call one of the provided functions. \n\nWhen you have all the information you need, reply with a VALID JSON object that has exactly two keys: "subject" and "content", where "content" is HTML representing the email body.'
        },
        {
          role: 'user',
          content: `Customer name: ${customer.name || 'Customer'}\nCustomer email: ${customer.email}\nSubject: ${email.subject}\nReceived message (HTML stripped):\n${email.content}`
        }
      ];

      const functions = [
        {
          name: 'get_customer_history',
          description: 'Retrieve the most recent email interactions with the given customer email. Useful for understanding context and past issues.',
          parameters: {
            type: 'object',
            properties: {
              customer_email: {
                type: 'string',
                description: 'The email address of the customer.'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of interactions to return'
              }
            },
            required: ['customer_email']
          }
        },
        {
          name: 'get_documentation',
          description: 'Search product or company documentation to answer customer inquiries.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Main topic or keywords to search for in the docs.'
              }
            },
            required: ['query']
          }
        }
      ];

      // Helper to call OpenAI and handle function calls recursively
      const invokeOpenAI = async (convMessages, depth = 0) => {
        if (depth > 3) {
          throw new ProcessingError('Exceeded function-call recursion limit');
        }

        const response = await this.openai.createChatCompletion({
          model: 'gpt-3.5-turbo-0613',
          messages: convMessages,
          functions,
          function_call: 'auto'
        });

        const message = response.data.choices[0].message;

        // Check if OpenAI wants to call a function
        if (message.function_call) {
          const { name, arguments: argsStr } = message.function_call;
          let args;
          try {
            args = JSON.parse(argsStr || '{}');
          } catch (e) {
            args = {};
          }

          let functionResponse;
          if (name === 'get_customer_history') {
            functionResponse = await this._getCustomerHistory(args.customer_email, args.limit);
          } else if (name === 'get_documentation') {
            functionResponse = await this._getDocumentation(args.query);
          } else {
            functionResponse = { error: `Unknown function ${name}` };
          }

          convMessages.push(message); // add function call msg
          convMessages.push({
            role: 'function',
            name,
            content: JSON.stringify(functionResponse)
          });

          return invokeOpenAI(convMessages, depth + 1);
        }

        return message;
      };

      const finalMessage = await invokeOpenAI([...messages]);

      let subject; let bodyHtml;
      try {
        const parsed = JSON.parse(finalMessage.content);
        subject = parsed.subject || email.subject;
        bodyHtml = parsed.content || parsed.body || finalMessage.content;
      } catch (err) {
        // Not JSON, treat entire content as body
        subject = `Re: ${email.subject}`;
        bodyHtml = finalMessage.content;
      }

      // Create draft via Gmail
      await gmailService.createDraft({
        to: customer.email,
        subject,
        html: bodyHtml,
        threadId: email.threadId,
        inReplyTo: email.messageId
      });

      this.logger.success('Draft created successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to process incoming email', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieve recent interactions for customer.
   * @private
   */
  async _getCustomerHistory(customerEmail, limit = 10) {
    try {
      const result = await databaseService.query(
        `SELECT ei.id, ei.type, ei.subject, ei.content, ei.status, ei.created_at
         FROM email_interactions ei
         JOIN users u ON ei.user_id = u.id
         WHERE u.email = $1
         ORDER BY ei.created_at DESC
         LIMIT $2`,
        [customerEmail, limit]
      );
      return result.rows;
    } catch (error) {
      this.logger.error('DB error while fetching customer history', error);
      return { error: 'Could not retrieve history' };
    }
  }

  /**
   * VERY basic documentation search – placeholder implementation.
   * Reads markdown files under /docs and returns their raw content.
   * In production, replace with proper search.
   * @private
   */
  async _getDocumentation(query) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const docsDir = path.join(__dirname, '../../../docs');
      const files = await fs.readdir(docsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));

      let combined = '';
      for (const file of mdFiles) {
        const content = await fs.readFile(path.join(docsDir, file), 'utf8');
        combined += `\n=== ${file} ===\n${content}`;
      }

      // For simplicity, just return all content. In reality, would filter by query.
      return combined.slice(0, 7000); // keep within reasonable token limit
    } catch (error) {
      this.logger.error('Error loading docs', error);
      return { error: 'Documentation not available' };
    }
  }
}

module.exports = new EmailResponder();