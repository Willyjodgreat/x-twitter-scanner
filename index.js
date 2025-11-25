require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const axios = require('axios');

const app = express();
app.use(express.json());

// 🔧 CONFIG - From .env
const KEYWORDS = process.env.KEYWORDS ? process.env.KEYWORDS.split(',') : ['web3', 'ai'];
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function scanAndPost() {
  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
     executablePath: chromium.executablePath
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto('https://x.com/search?q=web3&f=live', {
      waitUntil: 'domcontentloaded'
    });

    await page.waitForSelector('article div[lang]', { timeout: 5000 });

    const tweets = await page.$eval('article div[lang]', nodes =>
      nodes.map(node => ({
        text: node.innerText
      }))
    );

    const filtered = tweets.filter(t =>
      KEYWORDS.some(k => t.text.toLowerCase().includes(k))
    );

    // axios.post should be INSIDE the try block
    for (let tweet of filtered) { // Iterate through each tweet
      await axios.post(WEBHOOK_URL, {
        tweetId: Date.now(),
        text: tweet.text,
        author: '@unknown'
      });
    }

    console.log(`Sent ${filtered.length} tweets.`);

    return {
      status: 'ok',
      sent: filtered.length
    };

  } catch (err) {
    console.error("Error during scan:", err.message);
    return { status: "error", message: err.message };

  } finally {
    if (browser) await browser.close();
  }
}

app.post('/scan', async (req, res) => {
  const result = await scanAndPost();
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot listening on ${PORT}`);
});



