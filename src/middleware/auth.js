const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const Logger = require('../utils/logger');

const PROJECT_ID = 'civil-forge-403609';
const logger = new Logger('Auth Middleware');
const secretClient = new SecretManagerServiceClient();

// Cache API keys for 5 minutes
const apiKeyCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getApiKeys() {
  try {
    const name = `projects/${PROJECT_ID}/secrets/API_KEYS/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name });
    return JSON.parse(version.payload.data.toString());
  } catch (error) {
    logger.error('Error fetching API keys', error);
    throw error;
  }
}

async function validateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required'
      });
    }

    // Check cache first
    const cachedKeys = apiKeyCache.get('apiKeys');
    let validKeys;

    if (cachedKeys && cachedKeys.timestamp > Date.now() - CACHE_TTL) {
      validKeys = cachedKeys.keys;
    } else {
      // Fetch fresh keys
      validKeys = await getApiKeys();
      apiKeyCache.set('apiKeys', {
        keys: validKeys,
        timestamp: Date.now()
      });
    }

    const keyInfo = validKeys.find(k => k.key === apiKey);
    if (!keyInfo) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Add service info to request
    req.service = {
      name: keyInfo.service,
      permissions: keyInfo.permissions
    };

    next();
  } catch (error) {
    logger.error('Error validating API key', error);
    res.status(500).json({
      success: false,
      message: 'Error validating API key'
    });
  }
}