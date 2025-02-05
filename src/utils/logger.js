class Logger {
  constructor(context) {
    this.context = context;
  }

  info(message, data = {}) {
    console.log(`\n=== ${this.context} ===`);
    console.log(message);
    if (Object.keys(data).length > 0) {
      console.log(data);
    }
  }

  success(message) {
    console.log(`✓ ${message}`);
  }

  error(message, error) {
    console.error(`\n=== Error in ${this.context} ===`);
    console.error('Error:', message);
    if (error?.stack) {
      console.error('Stack:', error.stack);
    }
  }

  end() {
    console.log(`=== ${this.context} Complete ===\n`);
  }
}

module.exports = Logger;