const express = require('express');
const ProcessorFactory = require('../services/message/processors/ProcessorFactory');
const validators = require('../services/message/validators');
const fs = require('fs');
const path = require('path');
const Logger = require('../utils/logger');

const router = express.Router();
const logger = new Logger('API Docs');

/**
 * Helper function to extract required fields from validator files
 * This helps identify processor-specific fields automatically
 */
function getValidatorRequiredFields(validatorName) {
  try {
    // Try to find the validator file
    const validatorFileName = `validate${validatorName.charAt(0).toUpperCase() + validatorName.slice(1)}.js`;
    const validatorPath = path.join(__dirname, '..', 'services', 'message', 'validators', validatorFileName);
    
    // Check if the file exists
    if (!fs.existsSync(validatorPath)) {
      return null;
    }
    
    // Read the file content
    const content = fs.readFileSync(validatorPath, 'utf8');
    
    // Extract required fields using regex
    const requiredFieldsMatch = content.match(/const\s+requiredFields\s*=\s*{([^}]*)}/s);
    if (!requiredFieldsMatch) {
      return null;
    }
    
    // Parse the required fields
    const fieldsText = requiredFieldsMatch[1];
    const fieldMatches = [...fieldsText.matchAll(/['"]?(\w+)['"]?\s*:\s*['"](\w+)['"]/g)];
    
    const fields = {};
    fieldMatches.forEach(match => {
      fields[match[1]] = match[2];
    });
    
    return fields;
  } catch (error) {
    logger.error(`Error extracting fields from validator ${validatorName}`, error);
    return null;
  }
}

/**
 * Helper function to get processor information
 * This minimizes code duplication
 */
function getProcessorInfo() {
  // Get processor info from the factory
  const processorFactory = new ProcessorFactory();
  const processorTypes = Object.keys(processorFactory.processors);
  
  // Get validator info
  const validatorTypes = Object.keys(validators)
    .map(key => key.replace('validate', ''))
    .map(name => name.charAt(0).toLowerCase() + name.slice(1));
  
  // Combine information into a helpful format
  const processors = processorTypes.map(type => {
    const validatorExists = validatorTypes.includes(type);
    
    // Define schema based on validator requirements
    let schema = { type: 'object', properties: {} };
    if (validatorExists) {
      schema = {
        type: 'object',
        properties: {
          crmProcess: { type: 'string', description: 'Process identifier', example: type },
          customer: { 
            type: 'object', 
            description: 'Customer information', 
            properties: {
              email: { type: 'string', description: 'Customer email address' }
            },
            required: ['email']
          },
          metadata: {
            type: 'object',
            description: 'Context information',
            properties: {
              origin: { type: 'string', description: 'Origin of the request' },
              sessionId: { type: 'string', description: 'Unique session identifier' },
              environment: { type: 'string', description: 'Environment (production, development)' },
              timestamp: { type: 'number', description: 'Timestamp in milliseconds' }
            },
            required: ['origin', 'sessionId', 'environment', 'timestamp']
          }
        },
        required: ['crmProcess', 'customer', 'metadata']
      };
      
      // Automatically detect processor-specific fields from validator
      const requiredFields = getValidatorRequiredFields(type);
      if (requiredFields) {
        // Add fields that are not already in the base schema
        Object.keys(requiredFields).forEach(field => {
          if (!schema.properties[field] && !['crmProcess', 'customer', 'metadata'].includes(field)) {
            schema.properties[field] = { 
              type: requiredFields[field], 
              description: `${field.replace(/_/g, ' ')} for the ${type} process` 
            };
            schema.required.push(field);
          }
        });
      }
    }
    
    return {
      type,
      validatorExists,
      schema
    };
  });
  
  return processors;
}

/**
 * Generate example fields for a processor based on its schema
 */
function getExampleForType(type, schema) {
  // Start with basic example structure
  let example = {
    crmProcess: type,
    customer: {
      email: 'customer@example.com',
      name: 'John Doe'
    },
    metadata: {
      origin: 'api-docs',
      sessionId: 'example-session-123',
      environment: 'development',
      timestamp: Date.now()
    }
  };
  
  // Add example values for all required fields based on their type
  if (schema && schema.properties) {
    Object.keys(schema.properties).forEach(field => {
      // Skip fields already in the basic example
      if (!['crmProcess', 'customer', 'metadata'].includes(field) && !example[field]) {
        const prop = schema.properties[field];
        
        // Generate appropriate example values based on field type
        if (prop.type === 'string') {
          if (field.includes('link') || field.includes('url')) {
            example[field] = `https://example.com/${type}/${field.replace('_', '-')}-example`;
          } else if (field.includes('email')) {
            example[field] = 'example@email.com';
          } else if (field.includes('id')) {
            example[field] = `${field}_12345`;
          } else {
            example[field] = `Example ${field.replace(/_/g, ' ')}`;
          }
        } else if (prop.type === 'number') {
          example[field] = 12345;
        } else if (prop.type === 'boolean') {
          example[field] = true;
        } else if (prop.type === 'object') {
          example[field] = {};
        } else if (prop.type === 'array') {
          example[field] = [];
        }
      }
    });
  }
  
  return example;
}

// Get available message processors and their schemas
router.get('/processors', (req, res) => {
  try {
    logger.info('Fetching available message processors');
    
    const processors = getProcessorInfo();
    
    logger.success('Processors fetched successfully');
    res.json({
      success: true,
      data: processors
    });
  } catch (error) {
    logger.error('Error fetching processor information', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching processor information'
    });
  }
});

// Get detailed information about a specific processor
router.get('/processors/:type', (req, res) => {
  try {
    const { type } = req.params;
    logger.info(`Fetching information for processor: ${type}`);
    
    const processors = getProcessorInfo();
    const processor = processors.find(p => p.type === type);
    
    if (!processor) {
      return res.status(404).json({
        success: false,
        message: 'Processor not found'
      });
    }
    
    // Generate example message for the processor
    const example = getExampleForType(type, processor.schema);
    
    const response = {
      ...processor,
      example
    };
    
    logger.success('Processor information fetched successfully');
    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Error fetching processor information', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching processor information'
    });
  }
});

module.exports = router; 