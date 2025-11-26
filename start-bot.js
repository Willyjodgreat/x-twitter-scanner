require('dotenv').config(); // Load environment variables from .env

// Inject globals for dynamic keywords, search query, and webhook
global.KEYWORDS = process.env.KEYWORDS?.split(',') || ['web3', 'ai'];
global.SEARCH_QUERY = process.env.SEARCH_QUERY || 'web3';
global.WEBHOOK_URL = process.env.WEBHOOK_URL;

// Run your existing bot
try {
  require('./williams.js'); // <- your hardcoded bot
} catch (err) {
  console.error('Error running williams.js:', err);
}
