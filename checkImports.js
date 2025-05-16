const fs = require('fs');
const path = require('path');

console.log('Checking imports in key files...');

try {
  // List of key files to check
  const filesToCheck = [
    'index.js',
    'src/services/database/index.js',
    'src/services/database/connection.js',
    'src/services/pubsub/index.js',
    'src/services/sheets/base.js',
    'src/services/sheets/bulk.js',
    'src/services/message/handler.js',
    'src/services/message/processors/BulkAppraisalEmailProcessor.js'
  ];

  let errors = 0;

  for (const file of filesToCheck) {
    try {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        errors++;
        continue;
      }

      console.log(`Checking ${file}...`);
      const content = fs.readFileSync(file, 'utf8');
      
      // Look for common require patterns
      const requireMatches = content.match(/require\(['"](.*?)['"]\)/g) || [];
      
      for (const match of requireMatches) {
        const modulePath = match.match(/require\(['"](.*?)['"]\)/)[1];
        
        // Skip node core modules and npm packages
        if (!modulePath.startsWith('.') && !modulePath.startsWith('/')) {
          continue;
        }
        
        // Resolve relative path
        const basedir = path.dirname(file);
        const resolvedPath = path.resolve(basedir, modulePath);
        
        // Check if file exists
        if (!fs.existsSync(resolvedPath) && !fs.existsSync(resolvedPath + '.js')) {
          console.error(`  - Missing dependency in ${file}: ${modulePath}`);
          errors++;
        }
      }
    } catch (err) {
      console.error(`Error checking ${file}:`, err);
      errors++;
    }
  }

  console.log('\nImport check completed.');
  if (errors > 0) {
    console.error(`Found ${errors} potential import errors.`);
    process.exit(1);
  } else {
    console.log('No import errors found.');
    process.exit(0);
  }
} catch (err) {
  console.error('Error running import check:', err);
  process.exit(1);
} 