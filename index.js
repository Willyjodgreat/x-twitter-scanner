require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const KEYWORDS = process.env.KEYWORDS ? process.env.KEYWORDS.split(',') : ['web3', 'ai'];
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Simple in-memory storage
let stats = {
  totalScans: 0,
  totalTweets: 0,
  lastScan: null
};

// Main scan endpoint
app.post('/scan', async (req, res) => {
  try {
    const keywords = req.body.keywords || KEYWORDS;
    const results = [];
    
    console.log(`🔍 Scanning: ${keywords.join(', ')}`);
    
    // Simulate scanning
    for (const keyword of keywords) {
      // Mock tweets for now
      const mockTweets = [
        { 
          text: `New development in ${keyword} happening right now!`, 
          author: '@technews', 
          timestamp: new Date().toISOString() 
        },
        { 
          text: `Breaking: Major update in ${keyword} ecosystem`, 
          author: '@updatebot', 
          timestamp: new Date().toISOString() 
        },
        { 
          text: `Why ${keyword} is changing the industry`, 
          author: '@industryexpert', 
          timestamp: new Date().toISOString() 
        }
      ];
      
      results.push({
        keyword,
        tweets_found: mockTweets.length,
        tweets: mockTweets
      });
      
      // Optional: Send to webhook
      // Comment this out if you don't have a webhook URL
      if (WEBHOOK_URL && mockTweets.length > 0) {
        try {
          await axios.post(WEBHOOK_URL, {
            keyword,
            tweets: mockTweets,
            timestamp: new Date().toISOString()
          });
          console.log(`📤 Sent ${mockTweets.length} tweets for ${keyword} to webhook`);
        } catch (webhookError) {
          console.log('⚠️ Webhook error (non-critical):', webhookError.message);
        }
      }
    }
    
    // Update stats
    stats.totalScans++;
    stats.totalTweets += results.reduce((sum, r) => sum + r.tweets_found, 0);
    stats.lastScan = new Date().toISOString();
    
    res.json({
      status: 'complete',
      timestamp: stats.lastScan,
      total_keywords: keywords.length,
      total_tweets: results.reduce((sum, r) => sum + r.tweets_found, 0),
      results: results,
      note: 'Using mock data. Add puppeteer for real scraping.'
    });
    
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0',
    keywords: KEYWORDS,
    stats: stats,
    webhook_configured: !!WEBHOOK_URL,
    timestamp: new Date().toISOString()
  });
});

// Simple dashboard
app.get('/', (req, res) => {
  res.send(`
    <html>
      <style>
        body { font-family: Arial; padding: 20px; background: #f0f2f5; }
        .card { background: white; padding: 20px; border-radius: 10px; margin: 10px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        button { background: #1DA1F2; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .stat { background: #f8f9fa; padding: 10px; border-radius: 5px; }
      </style>
      <body>
        <div style="max-width: 800px; margin: 0 auto;">
          <h1>🐦 X/Twitter Scraper Bot</h1>
          
          <div class="card">
            <h3>📊 Status Dashboard</h3>
            <div class="stats">
              <div class="stat">
                <strong>Total Scans:</strong><br>
                <span id="totalScans">${stats.totalScans}</span>
              </div>
              <div class="stat">
                <strong>Total Tweets:</strong><br>
                <span id="totalTweets">${stats.totalTweets}</span>
              </div>
              <div class="stat">
                <strong>Last Scan:</strong><br>
                <span id="lastScan">${stats.lastScan || 'Never'}</span>
              </div>
              <div class="stat">
                <strong>Keywords:</strong><br>
                ${KEYWORDS.join(', ')}
              </div>
            </div>
          </div>
          
          <div class="card">
            <h3>⚡ Quick Actions</h3>
            <button onclick="scanNow()">🔍 Scan Now</button>
            <button onclick="checkHealth()" style="background: #28a745;">🏥 Health Check</button>
            <button onclick="updateStats()" style="background: #6c757d;">🔄 Refresh Stats</button>
          </div>
          
          <div class="card">
            <h3>📝 Logs</h3>
            <div id="logs" style="background: #f8f9fa; padding: 10px; border-radius: 5px; height: 100px; overflow-y: auto; font-family: monospace; font-size: 12px;">
            </div>
          </div>
        </div>
        
        <script>
          function log(message) {
            const logs = document.getElementById('logs');
            logs.innerHTML = '[' + new Date().toLocaleTimeString() + '] ' + message + '<br>' + logs.innerHTML;
          }
          
          async function scanNow() {
            const btn = event.target;
            btn.disabled = true;
            btn.innerHTML = '⏳ Scanning...';
            log('Starting scan...');
            
            try {
              const res = await fetch('/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              
              const data = await res.json();
              log('Scan complete: ' + data.total_tweets + ' tweets found');
              alert('✅ Scan complete! Found ' + data.total_tweets + ' tweets');
              
              updateStats();
            } catch (error) {
              log('❌ Scan failed: ' + error.message);
              alert('Scan failed: ' + error.message);
            }
            
            btn.disabled = false;
            btn.innerHTML = '🔍 Scan Now';
          }
          
          async function checkHealth() {
            log('Checking health...');
            const res = await fetch('/health');
            const data = await res.json();
            log('Health: ' + data.status);
            alert('✅ Bot is ' + data.status + '\\nKeywords: ' + data.keywords.join(', '));
          }
          
          async function updateStats() {
            const res = await fetch('/health');
            const data = await res.json();
            
            document.getElementById('totalScans').textContent = data.stats.totalScans;
            document.getElementById('totalTweets').textContent = data.stats.totalTweets;
            document.getElementById('lastScan').textContent = data.stats.lastScan || 'Never';
            
            log('Stats updated');
          }
          
          // Auto-refresh stats every 30 seconds
          setInterval(updateStats, 30000);
        </script>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🔥 X Scraper Bot Started!
📍 Port: ${PORT}
🔑 Keywords: ${KEYWORDS.join(', ')}
🎯 Target: ~500 tweets/day
🏥 Health: http://localhost:${PORT}/health
🌐 Dashboard: http://localhost:${PORT}
  `);
});
