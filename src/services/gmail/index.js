const { google } = require('googleapis');
const Logger = require('../../utils/logger');
const { InitializationError, ProcessingError } = require('../../utils/errors');

class GmailService {
  constructor() {
    this.initialized = false;
    this.gmail = null;
    this.auth = null;
    this.senderEmail = null;
    this.logger = new Logger('Gmail Service');
  }

  /**
   * Initialize Gmail client using a service-account keyfile.
   * The service account must have domain-wide delegation enabled and the
   * senderEmail must be an account that the service account is authorised to
   * impersonate.
   *
   * @param {string} keyFilePath – Path to service-account JSON key.
   * @param {string} senderEmail – The Gmail address from which drafts will be created.
   */
  initialize(keyFilePath, senderEmail) {
    if (!keyFilePath || !senderEmail) {
      throw new InitializationError('GmailService requires key file path and sender email');
    }

    try {
      this.logger.info('Initializing Gmail client');
      this.senderEmail = senderEmail;

      const jwtClient = new google.auth.JWT({
        keyFile: keyFilePath,
        scopes: [
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.send'
        ],
        subject: senderEmail
      });

      this.auth = jwtClient;
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.initialized = true;
      this.logger.success('Gmail client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Gmail client', error);
      throw new InitializationError(`Failed to initialize Gmail client: ${error.message}`);
    }
  }

  /**
   * Create a reply draft to a customer.
   *
   * @param {object} params
   * @param {string} params.to – Recipient email address
   * @param {string} params.subject – Email subject
   * @param {string} params.html – HTML body content
   * @param {string} [params.threadId] – Gmail threadId to attach the draft to
   * @param {string} [params.inReplyTo] – Message-ID of the email we are replying to
   * @returns {Promise<object>} Gmail API draft creation response
   */
  async createDraft({ to, subject, html, threadId, inReplyTo }) {
    if (!this.initialized) {
      throw new InitializationError('GmailService not initialized');
    }

    try {
      const rawMessage = this._buildRawEmail({ to, subject, html, inReplyTo });
      const requestBody = {
        message: {
          raw: rawMessage,
          threadId: threadId || undefined
        }
      };

      const res = await this.gmail.users.drafts.create({
        userId: this.senderEmail || 'me',
        requestBody
      });

      this.logger.success(`Draft created for ${to}`);
      return res.data;
    } catch (error) {
      this.logger.error('Failed to create draft', error);
      throw new ProcessingError(`Failed to create Gmail draft: ${error.message}`);
    }
  }

  _buildRawEmail({ to, subject, html, inReplyTo }) {
    const headers = [
      `From: ${this.senderEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset="UTF-8"'
    ];

    if (inReplyTo) {
      headers.push(`In-Reply-To: <${inReplyTo}>`);
      headers.push(`References: <${inReplyTo}>`);
    }

    const email = `${headers.join('\r\n')}\r\n\r\n${html}`;

    // Gmail API expects base64url encoded string
    return Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

module.exports = new GmailService();