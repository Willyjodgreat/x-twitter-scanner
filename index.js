const puppeteer = require('puppeteer');
const axios = require('axios');

const WEBHOOK_URL = 'https://n8n-kkdq.onrender.com/webhook-test/7da40efb-5ac9-487d-8109-f4542bc49ebe';

const KEYWORDS = ['web3', 'ai'];
const MAX_TWEETS = 10;

let seenTweets = new Set();

async function scrapeAndSend() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://x.com/search?q=web3&f=live', { waitUntil: 'networkidle2' });

  // Wait for tweets to load
  await page.waitForSelector('article');

  const tweets = await page.
    
eval('article', (nodes, keywords) => {
    return nodes.map(node => {
      const tweetId = node.querySelector('a[href*="/status/"]')?.getAttribute('href')?.split('/').pop();
      const text = node.innerText || '';
      const author = node.querySelector('a[href*="/"]')?.getAttribute('href')?.split('/')[1] || '';
      return { tweetId, text, author };
    }).filter(t => t.tweetId && keywords.some(k => t.text.toLowerCase().includes(k)));
  }, KEYWORDS);

  let sentCount = 0;

  for (const tweet of tweets) {
    if (sentCount >= MAX_TWEETS) break;
    if (!seenTweets.has(tweet.tweetId)) {
      try {
        await axios.post(WEBHOOK_URL, tweet);
        console.log(`Sent tweet tweet.tweetId`);
        seenTweets.add(tweet.tweetId);
        sentCount++;
       catch (err) 
        console.error(`Failed sending tweet{tweet.tweetId}:`, err.message);
      }
    }
  }

  // Wait 10 seconds before closing to mimic delay
  await new Promise(r => setTimeout(r, 10_000));

  await browser.close();
}

scrapeAndSend().catch(console.error);

