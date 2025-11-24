const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const axios = require('axios');

const app = express();
app.use(express.json());

const KEYWORDS = ['web3', 'ai'];
const WEBHOOK_URL = 'https://n8n-kkdq.onrender.com/webhook-test/7da40efb-5ac9-487d-8109-f4542bc49ebe';

async function scanAndPost() {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });

    const page = await browser.newPage();
    await page.goto('https://x.com/search?q=web3&f=live', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('article div[lang]', { timeout: 5000 });

    const tweets = await page.
    
eval('article div[lang]', nodes =>
      nodes.map(node => ({ text: node.innerText }))
    );

    const filtered = tweets.filter(t =>
      KEYWORDS.some(k => t.text.toLowerCase().includes(k))
    );

    for (let tweet of filtered.slice(0, 10)) {
      await axios.post(WEBHOOK_URL, {
        tweetId: Date.now(),
        text: tweet.text,
        author: '@unknown'
      });
    }

    console.log(`Sent filtered.length tweets.`);
  return {
  status: 'ok',
  sent: filtered.length
};

try {
  console.log(`Sent filtered.length tweets.`);
  return 
    status: 'ok',
    sent: filtered.length
  ;
 catch (err) 
  console.error("Error during scan:", err.message);
  return  status: "error", message: err.message ;
 finally 
  if (browser) await browser.close();


// 🟢 Route to trigger from n8n
app.post('/scan', async (req, res) => 
  const result = await scanAndPost();
  res.json(result);
);

// 🌐 Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
  console.log(`Bot listening on{PORT}`);
});
