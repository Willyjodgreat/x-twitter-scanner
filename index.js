require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(express.json());

// CONFIG FROM ENV
const KEYWORDS = process.env.KEYWORDS ? process.env.KEYWORDS.split(',') : ['web3', 'ai'];
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// Calculate tweets per scan for 500/day goal
// 500 ÷ 48 (scans/day) = ~11 tweets/scan
const TWEETS_PER_SCAN = Math.ceil(500 / 48); // 11 tweets per scan

console.log(`🎯 Target: ${TWEETS_PER_SCAN} tweets per scan for ~500/day`);

async function scanTweets(keyword) {
  let browser = null;
  console.log(`🔍 Scanning for: ${keyword}`);
  
  try {
    // Render-compatible browser setup
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      headless: 'new'
    });
    
    const page = await browser.newPage();
    
    // Set realistic headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Go to Twitter search
    const url = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;
    console.log(`🌐 Going to: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait a bit for content
    await page.waitForTimeout(3000);
    
    // Scroll a little
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
    
    // Extract tweets - SIMPLE SELECTOR
    const tweets = await page.evaluate((maxTweets) => {
      const results = [];
      const tweetElements = document.querySelectorAll('article');
      
      for (const tweet of tweetElements) {
        if (results.length >= maxTweets) break;
        
        const textEl = tweet.querySelector('[data-testid="tweetText"], [lang]');
        const authorEl = tweet.querySelector('[data-testid="User-Name"] span');
        
        if (textEl && textEl.innerText.trim()) {
          results.push({
            text: textEl.innerText.trim().substring(0, 280),
            author: authorEl ? authorEl.innerText.trim() : '@unknown',
            keyword: window.location.search.match(/q=([^&]+)/)?.[1] || '',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      return results;
    }, TWEETS_PER_SCAN);
    
    console.log(`✅ Found ${tweets.length} tweets for "${keyword}"`);
    
    // Send to webhook if configured
    if (WEBHOOK_URL && tweets.length > 0) {
      try {
        for (const tweet of tweets) {
          await axios.post(WEBHOOK_URL, tweet, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          });
          console.log(`📤 Sent tweet: ${tweet.text.substring(0, 50)}...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        }
      } catch (webhookError) {
        console.error('❌ Webhook error:', webhookError.message);
      }
    }
    
    return {
      success: true,
      keyword: keyword,
      tweets_found: tweets.length,
      tweets_sent: WEBHOOK_URL ? tweets.length : 0,
      sample: tweets.slice(0, 3) // Show first 3 as sample
    };
    
  } catch (error) {
    console.error(`💥 Error scanning ${keyword}:`, error.message);
    return {
      success: false,
      keyword: keyword,
      error: error.message
    };
    
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔄 Browser closed');
    }
  }
}

// API ENDPOINTS
app.post('/scan', async (req, res) => {
  try {
    // Use keyword from request OR environment
    const keywords = req.body.keyword 
      ? [req.body.keyword]
      : req.body.keywords 
        ? req.body.keywords
        : KEYWORDS;
    
    console.log(`📡 Scan request for: ${keywords.join(', ')}`);
    
    // Run scans sequentially
    const results = [];
    for (const keyword of keywords) {
      const result = await scanTweets(keyword);
      results.push(result);
      
      // Small delay between keywords
      if (keyword !== keywords[keywords.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Calculate totals
    const totalTweets = results.reduce((sum, r) => sum + (r.tweets_found || 0), 0);
    const successful = results.filter(r => r.success).length;
    
    res.json({
      status: 'complete',
      timestamp: new Date().toISOString(),
      total_keywords: keywords.length,
      successful_scans: successful,
      total_tweets: totalTweets,
      results: results
    });
    
  } catch (error) {
    console.error('💥 Route error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0',
    keywords: KEYWORDS,
    tweets_per_scan: TWEETS_PER_SCAN,
    estimated_daily: TWEETS_PER_SCAN * 48
  });
});

app.get('/config', (req, res) => {
  res.json({
    current_keywords: KEYWORDS,
    webhook_configured: !!WEBHOOK_URL,
    tweets_per_scan: TWEETS_PER_SCAN,
    scan_interval: '30 minutes',
    estimated_daily_tweets: TWEETS_PER_SCAN * 48
  });
});

// Update keywords via API
app.post('/update-keywords', (req, res) => {
  const { keywords } = req.body;
  
  if (!keywords || !Array.isArray(keywords)) {
    return res.status(400).json({ error: 'Keywords array required' });
  }
  
  if (keywords.length > 5) {
    return res.status(400).json({ error: 'Max 5 keywords allowed' });
  }
  
  // In production, you'd save this to a database
  // For now, we'll just acknowledge
  console.log(`🔄 Keywords update requested: ${keywords.join(', ')}`);
  
  res.json({
    status: 'updated',
    message: 'Keywords update would be saved to DB',
    new_keywords: keywords,
    note: 'For persistent storage, use database or .env file'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🔥 X Scraper Bot Started!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔑 Keywords: ${KEYWORDS.join(', ')}`);
  console.log(`🎯 Target: ${TWEETS_PER_SCAN} tweets/scan (~${TWEETS_PER_SCAN * 48}/day)`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`⚙️ Config: http://localhost:${PORT}/config\n`);
});
