const ScreenerProcessor = require('./ScreenerProcessor');
const ChatSummaryProcessor = require('./ChatSummaryProcessor');
const GmailProcessor = require('./GmailProcessor');
const AppraisalProcessor = require('./AppraisalProcessor');
const StripePaymentProcessor = require('./StripePaymentProcessor');
const { ValidationError } = require('../../../utils/errors');

class ProcessorFactory {
  constructor() {
    this.processors = {
      screenerNotification: new ScreenerProcessor(),
      chatSummary: new ChatSummaryProcessor(),
      gmailInteraction: new GmailProcessor(),
      appraisalRequest: new AppraisalProcessor(),
      stripePayment: new StripePaymentProcessor()
    };
  }

  getProcessor(processType) {
    const processor = this.processors[processType];
    if (!processor) {
      throw new ValidationError(`No processor found for process type: ${processType}`);
    }
    return processor;
  }
}

module.exports = ProcessorFactory;