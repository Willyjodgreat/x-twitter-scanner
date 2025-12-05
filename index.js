require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

// Use stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const KEYWORDS = process.env.KEYWORDS ? process.env.KEYWORDS.split(',') : ['web3', 'ai'];
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Stats tracking
let stats = {
  totalScans: 0,
  tweetsFound: 0,
  lastScan: null,
  uptime: Date.now()
};

// REAL Twitter scraping function
async function scrapeTweets(keyword, maxTweets = 20) {
  let browser = null;
  console.log(`🎯 Scraping tweets for: "${keyword}"`);
  
  try {
    // Browser setup for Render
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser'
    });
    
    const page = await browser.newPage();
    
    // Set stealth headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Go to Twitter search
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
    console.log(`🌐 Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content
    await page.waitForTimeout(5000);
    
    // Scroll to load more tweets
    const tweets = new Set();
    const maxScrolls = 3;
    
    for (let i = 0; i < maxScrolls; i++) {
      console.log(`📜 Scroll ${i + 1}/${maxScrolls}`);
      
      // Extract tweets from current page
      const newTweets = await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('article');
        const extracted = [];
        
        tweetElements.forEach(tweet => {
          try {
            // Get tweet ID from URL
            const tweetLink = tweet.querySelector('a[href*="/status/"]');
            const tweetUrl = tweetLink ? tweetLink.href : '';
            const tweetId = tweetUrl.split('/').pop().split('?')[0];
            
            // Get tweet text
            const textEl = tweet.querySelector('[data-testid="tweetText"]') || 
                          tweet.querySelector('[lang]') ||
                          tweet.querySelector('div[dir="auto"]');
            
            // Get author info
            const authorEl = tweet.querySelector('[data-testid="User-Name"] a') ||
                            tweet.querySelector('a[role="link"][href*="/"]');
            
            // Get timestamp
            const timeEl = tweet.querySelector('time');
            const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;
            
            // Get reply count (to prioritize engagement)
            const replyBtn = tweet.querySelector('[data-testid="reply"]');
            const replyCount = replyBtn ? replyBtn.innerText.match(/\d+/) : null;
            
            if (textEl && tweetId) {
              extracted.push({
                id: tweetId,
                text: textEl.innerText.trim().substring(0, 280),
                author: authorEl ? authorEl.innerText.trim() : '@unknown',
                authorHandle: authorEl ? authorEl.getAttribute('href').slice(1) : '',
                timestamp: timestamp || new Date().toISOString(),
                url: tweetUrl,
                replyCount: replyCount ? parseInt(replyCount[0]) : 0,
                canReply: !!replyBtn,
                platform: 'twitter'
              });
            }
          } catch (err) {
            // Skip individual tweet errors
          }
        });
        
        return extracted;
      });
      
      // Add new tweets
      newTweets.forEach(tweet => {
        if (tweet.id && tweet.text) {
          tweets.add(JSON.stringify(tweet));
        }
      });
      
      // Stop if we have enough
      if (tweets.size >= maxTweets) {
        console.log(`✅ Collected ${tweets.size} tweets, stopping`);
        break;
      }
      
      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 1.5);
      });
      
      await page.waitForTimeout(2000 + Math.random() * 2000);
      
      // Random mouse movement (human-like)
      await page.mouse.move(
        Math.random() * 800,
        Math.random() * 600
      );
    }
    
    // Convert Set to array and deduplicate
    const allTweets = Array.from(tweets).map(t => JSON.parse(t));
    
    // Remove duplicates by ID
    const uniqueTweets = [];
    const seenIds = new Set();
    
    for (const tweet of allTweets) {
      if (!seenIds.has(tweet.id)) {
        seenIds.add(tweet.id);
        uniqueTweets.push(tweet);
      }
    }
    
    console.log(`✅ Found ${uniqueTweets.length} unique tweets for "${keyword}"`);
    return uniqueTweets.slice(0, maxTweets);
    
  } catch (error) {
    console.error(`❌ Error scraping "${keyword}":`, error.message);
    
    // Fallback to mock data if scraping fails
    console.log('⚠️ Using fallback mock data for demo');
    return generateMockTweets(keyword, 5);
    
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed');
    }
  }
}

// Fallback mock data generator
function generateMockTweets(keyword, count) {
  const mockTweets = [];
  const authors = ['@crypto_enthusiast', '@tech_analyst', '@web3_builder', '@ai_researcher', '@blockchain_dev'];
  
  for (let i = 0; i < count; i++) {
    mockTweets.push({
      id: `mock_${Date.now()}_${i}`,
      text: `Just discovered something amazing about ${keyword}! The potential is huge. #${keyword}`,
      author: authors[i % authors.length],
      authorHandle: authors[i % authors.length].replace('@', ''),
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Random last 24h
      url: `https://twitter.com/user/status/mock_${i}`,
      replyCount: Math.floor(Math.random() * 10),
      canReply: true,
      platform: 'twitter',
      isMock: true
    });
  }
  
  return mockTweets;
}

// Main scan endpoint
app.post('/scan', async (req, res) => {
  try {
    const { keywords = KEYWORDS, maxTweets = 20 } = req.body;
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    
    console.log(`🚀 Starting scan for ${keywordList.length} keyword(s)`);
    
    const results = [];
    let totalTweets = 0;
    
    // Scan each keyword sequentially
    for (const keyword of keywordList) {
      console.log(`🔍 Scanning: ${keyword}`);
      
      const startTime = Date.now();
      const tweets = await scrapeTweets(keyword, maxTweets);
      const scanTime = Date.now() - startTime;
      
      results.push({
        keyword,
        scanTimeMs: scanTime,
        tweetsFound: tweets.length,
        tweets: tweets,
        source: tweets[0]?.isMock ? 'fallback_mock' : 'real_scrape'
      });
      
      totalTweets += tweets.length;
      
      // Send to webhook if configured
      if (WEBHOOK_URL && tweets.length > 0) {
        try {
          await axios.post(WEBHOOK_URL, {
            keyword,
            tweets: tweets,
            timestamp: new Date().toISOString(),
            scanId: `scan_${Date.now()}`
          }, {
            timeout: 5000
          });
          console.log(`📤 Sent ${tweets.length} tweets for "${keyword}" to webhook`);
        } catch (webhookError) {
          console.log('⚠️ Webhook error:', webhookError.message);
        }
      }
      
      // Delay between keywords (be polite)
      if (keyword !== keywordList[keywordList.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Update stats
    stats.totalScans++;
    stats.tweetsFound += totalTweets;
    stats.lastScan = new Date().toISOString();
    
    // Return results
    res.json({
      success: true,
      scanId: `scan_${Date.now()}`,
      timestamp: stats.lastScan,
      totalKeywords: keywordList.length,
      totalTweetsFound: totalTweets,
      stats: {
        totalScans: stats.totalScans,
        totalTweetsFound: stats.tweetsFound,
        uptime: Math.floor((Date.now() - stats.uptime) / 1000) + 's'
      },
      results: results
    });
    
  } catch (error) {
    console.error('💥 Scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Twitter Scraper Bot',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - stats.uptime) / 1000) + ' seconds',
    stats: stats,
    config: {
      keywords: KEYWORDS,
      webhookConfigured: !!WEBHOOK_URL
    }
  });
});

// Simple dashboard
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Twitter Scraper Bot</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          color: white;
          margin-bottom: 40px;
          padding: 20px;
        }
        .header h1 {
          font-size: 2.5em;
          margin-bottom: 10px;
        }
        .card {
          background: white;
          border-radius: 15px;
          padding: 30px;
          margin-bottom: 30px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .stat-box {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
        }
        .stat-box .number {
          font-size: 2em;
          font-weight: bold;
          color: #667eea;
        }
        .stat-box .label {
          color: #666;
          margin-top: 5px;
        }
        .btn {
          background: #667eea;
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          margin: 10px;
          transition: all 0.3s;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .btn:hover {
          background: #5a6fd8;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-scan {
          background: #10b981;
        }
        .btn-scan:hover {
          background: #0da271;
        }
        .keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 20px 0;
        }
        .keyword-tag {
          background: #e0e7ff;
          color: #4f46e5;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
        }
        .logs {
          background: #1a1a1a;
          color: #00ff9d;
          padding: 20px;
          border-radius: 10px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          height: 200px;
          overflow-y: auto;
          margin-top: 20px;
        }
        .log-entry {
          margin-bottom: 5px;
          border-bottom: 1px solid #333;
          padding-bottom: 5px;
        }
        .status-badge {
          display: inline-block;
          background: #10b981;
          color: white;
          padding: 5px 10px;
          border-radius: 20px;
          font-size: 12px;
          margin-left: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🐦 Twitter Scraper Bot</h1>
          <p>Scrape real tweets for engagement opportunities</p>
          <div class="status-badge">LIVE</div>
        </div>
        
        <div class="card">
          <h2>📊 Bot Status</h2>
          <div class="stats-grid" id="stats">
            <!-- Stats will be loaded here -->
          </div>
        </div>
        
        <div class="card">
          <h2>⚡ Quick Actions</h2>
          <div>
            <button class="btn btn-scan" onclick="scanNow()">
              <span>🔍</span> Scan Now
            </button>
            <button class="btn" onclick="checkHealth()">
              <span>🏥</span> Health Check
            </button>
            <button class="btn" onclick="refreshStats()">
              <span>🔄</span> Refresh Stats
            </button>
          </div>
          
          <div style="margin-top: 20px;">
            <h3>Current Keywords:</h3>
            <div class="keywords" id="keywords">
              <!-- Keywords will be loaded here -->
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>📝 Live Logs</h2>
          <div class="logs" id="logs">
            <!-- Logs will appear here -->
          </div>
        </div>
      </div>
      
      <script>
        let logEntries = [];
        
        function log(message) {
          const timestamp = new Date().toLocaleTimeString();
          const entry = \`[\${timestamp}] \${message}\`;
          logEntries.unshift(entry);
          
          const logsDiv = document.getElementById('logs');
          logsDiv.innerHTML = logEntries.slice(0, 20).map(entry => 
            \`<div class="log-entry">\${entry}</div>\`
          ).join('');
        }
        
        async function scanNow() {
          const btn = event.target;
          const originalText = btn.innerHTML;
          btn.innerHTML = '<span>⏳</span> Scanning...';
          btn.disabled = true;
          
          log('Starting scan...');
          
          try {
            const response = await fetch('/scan', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                keywords: ${JSON.stringify(KEYWORDS)},
                maxTweets: 20
              })
            });
            
            const data = await response.json();
            
            if (data.success) {
              log(\`✅ Scan complete! Found \${data.totalTweetsFound} tweets\`);
              alert(\`🎉 Found \${data.totalTweetsFound} tweets across \${data.totalKeywords} keywords!\`);
            } else {
              log(\`❌ Scan failed: \${data.error}\`);
              alert('Scan failed: ' + data.error);
            }
            
            refreshStats();
          } catch (error) {
            log(\`💥 Error: \${error.message}\`);
            alert('Connection error: ' + error.message);
          }
          
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
        
        async function checkHealth() {
          log('Checking health...');
          try {
            const response = await fetch('/health');
            const data = await response.json();
            log(\`✅ Health: \${data.status} | Uptime: \${data.uptime}\`);
            alert(\`✅ Bot is \${data.status}\\nUptime: \${data.uptime}\`);
          } catch (error) {
            log(\`❌ Health check failed: \${error.message}\`);
            alert('Health check failed');
          }
        }
        
        async function refreshStats() {
          try {
            const response = await fetch('/health');
            const data = await response.json();
            
            // Update stats grid
            const statsDiv = document.getElementById('stats');
            statsDiv.innerHTML = \`
              <div class="stat-box">
                <div class="number">\${data.stats.totalScans}</div>
                <div class="label">Total Scans</div>
              </div>
              <div class="stat-box">
                <div class="number">\${data.stats.tweetsFound}</div>
                <div class="label">Tweets Found</div>
              </div>
              <div class="stat-box">
                <div class="number">\${data.uptime}</div>
                <div class="label">Uptime</div>
              </div>
              <div class="stat-box">
                <div class="number">\${data.config.keywords.length}</div>
                <div class="label">Keywords</div>
              </div>
            \`;
            
            // Update keywords
            const keywordsDiv = document.getElementById('keywords');
            keywordsDiv.innerHTML = data.config.keywords
              .map(keyword => \`<div class="keyword-tag">#\${keyword}</div>\`)
              .join('');
            
            log('Stats refreshed');
          } catch (error) {
            log('Failed to refresh stats');
          }
        }
        
        // Auto-refresh stats every 30 seconds
        refreshStats();
        setInterval(refreshStats, 30000);
        
        // Initial log
        log('Bot dashboard loaded');
        log(\`Target keywords: \${${JSON.stringify(KEYWORDS)}}\`);
      </script>
    </body>
    </html>
  `);
});

// API endpoint to get bot info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Twitter Scraper Bot',
    version: '1.0.0',
    endpoints: {
      scan: 'POST /scan - Scrape tweets by keywords',
      health: 'GET /health - Check bot status',
      info: 'GET /api/info - This info'
    },
    features: [
      'Real Twitter scraping',
      'Stealth browsing',
      'Webhook integration',
      'Live dashboard',
      'Mock data fallback'
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🔥 TWITTER SCRAPER BOT STARTED!
📍 Port: ${PORT}
🔑 Keywords: ${KEYWORDS.join(', ')}
🎯 Purpose: Find tweets to reply to
🏥 Health: http://localhost:${PORT}/health
🌐 Dashboard: http://localhost:${PORT}
📊 API Info: http://localhost:${PORT}/api/info

⚡ Usage:
  1. POST /scan with {"keywords": ["web3", "ai"]}
  2. Returns tweets with reply opportunities
  3. Send to your reply bot for action
  `);
});
