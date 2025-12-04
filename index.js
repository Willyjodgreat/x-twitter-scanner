require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const axios = require('axios');

const app = express();
app.use(express.json());

const KEYWORDS = process.env.KEYWORDS ? process.env.KEYWORDS.split(',') : ['web3', 'ai'];
const WEBHOOK_URL = process.env.WEBHOOK_URL;

app.post('/scan', async (req, res) => {
  let browser = null;
  try {
    // USE CHROME-AWS-LAMBDA (optimized for serverless)
    const executablePath = await chromium.executablePath;
    
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: executablePath,
      headless: chromium.headless
    });
    
    const page = await browser.newPage();
    const keyword = req.body.keyword || KEYWORDS[0];
    
    await page.goto(`https://x.com/search?q=${keyword}`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Wait and extract
    await page.waitForTimeout(3000);
    const tweets = await page.evaluate(() => {
      const articles = document.querySelectorAll('article');
      return Array.from(articles).slice(0, 10).map(article => ({
        text: article.innerText.substring(0, 200),
        timestamp: new Date().toISOString()
      }));
    });
    
    // Send response immediately
    res.json({
      success: true,
      tweets: tweets.length,
      keyword: keyword
    });
    
    // Send to webhook in background
    if (WEBHOOK_URL && tweets.length > 0) {
      setTimeout(async () => {
        try {
          await axios.post(WEBHOOK_URL, {
            keyword: keyword,
            tweets: tweets
          });
        } catch (e) { /* ignore webhook errors */ }
      }, 100);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    res.json({
      success: false,
      error: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Bot running on port ${PORT}`);
});
