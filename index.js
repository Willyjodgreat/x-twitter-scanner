// index.js
require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function scrapeTwitter(keyword) {
    let browser;
    try {
        console.log(`🚀 Launching puppeteer for: ${keyword}`);
        
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process'
            ],
            headless: 'new'
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // Navigate to Twitter search
        const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(keyword)}&f=live`;
        console.log(`🌐 Navigating to: ${searchUrl}`);
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for tweets to load
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
        
        // Extract tweets
        const tweets = await page.evaluate(() => {
            const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
            const results = [];
            
            tweetElements.forEach(tweet => {
                const text = tweet.querySelector('[data-testid="tweetText"]')?.innerText || '';
                const username = tweet.querySelector('[data-testid="User-Name"]')?.innerText || '';
                const timestamp = tweet.querySelector('time')?.getAttribute('datetime') || '';
                
                if (text) {
                    results.push({
                        text: text.substring(0, 280),
                        username,
                        timestamp,
                        url: window.location.href
                    });
                }
            });
            
            return results.slice(0, 5); // Return first 5 tweets
        });
        
        console.log(`✅ Found ${tweets.length} tweets for: ${keyword}`);
        return tweets;
        
    } catch (error) {
        console.error(`❌ Error scraping ${keyword}:`, error.message);
        // Fallback mock data
        return [{
            text: `Mock tweet about ${keyword} - puppeteer failed`,
            username: 'test_user',
            timestamp: new Date().toISOString(),
            url: 'https://twitter.com'
        }];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Send to n8n webhook
async function sendToWebhook(data) {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('⚠️ No WEBHOOK_URL set, skipping webhook');
        return;
    }
    
    try {
        console.log(`📤 Sending to webhook: ${webhookUrl}`);
        const response = await axios.post(webhookUrl, data, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`✅ Webhook success: ${response.status}`);
    } catch (error) {
        console.error(`❌ Webhook error: ${error.message}`);
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Response: ${JSON.stringify(error.response.data)}`);
        }
    }
}

// Scan endpoint
app.post('/scan', async (req, res) => {
    try {
        const { keywords } = req.body;
        
        if (!keywords || !Array.isArray(keywords)) {
            return res.status(400).json({ error: 'Keywords array required' });
        }
        
        console.log(`🔍 Scanning keywords: ${keywords.join(', ')}`);
        
        const allResults = [];
        
        for (const keyword of keywords) {
            const tweets = await scrapeTwitter(keyword);
            allResults.push({
                keyword,
                tweets,
                scannedAt: new Date().toISOString()
            });
        }
        
        // Send to n8n
        await sendToWebhook({
            type: 'twitter_scan',
            results: allResults,
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: `Scanned ${keywords.length} keywords`,
            results: allResults,
            sentToWebhook: !!process.env.WEBHOOK_URL
        });
        
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Twitter Scanner Bot',
        endpoints: {
            scan: 'POST /scan',
            health: 'GET /'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔧 WEBHOOK_URL: ${process.env.WEBHOOK_URL ? 'Set' : 'Not set'}`);
});
