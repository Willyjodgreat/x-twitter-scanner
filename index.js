const puppeteer = require('puppeteer');
const axios = require('axios');

const WEBHOOK_URL = 'https://n8n-kkdq.onrender.com/webhook-test/7da40efb-5ac9-487d-8109-f4542bc49ebe';
const KEYWORDS = ['web3', 'ai'];
const MAX_BATCH_SIZE = 10;
const DELAY_MS = 10000; // 10 seconds delay between batches

// Optional proxy support — leave empty if none
const PROXY = ''; // e.g. 'http://username:password@proxyserver:port'

const SEEN_TWEETS = new Set();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeTweets(page) {
  return page.
    
eval('article', articles =>
    articles.map(article => {
      const text = article.innerText;
      const author = article.querySelector('a[href*="/"] > div > div > span')?.innerText || 'unknown';
      const link = [...article.querySelectorAll('a')]
        .map(a => a.href)
        .find(href => href.includes('/status/'));
      return { text, author, link };
    })
  );
}

async function sendBatch(batch) {
  try {
    await axios.post(WEBHOOK_URL, { tweets: batch });
    console.log(`Sent batch of ${batch.length} tweets`);
  } catch (error) {
console.error('Error sending batch:', error.message);
  

async function runBot() 
  const launchOptions = PROXY ?  headless: 'new', args: [`–proxy-server={PROXY}`] } : { headless: 'new' };
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.goto('https://x.com/search?q=web3&f=live', { waitUntil: 'domcontentloaded' });

  let tweets = await scrapeTweets(page);

  // Filter by keywords and skip seen tweets
  tweets = tweets.filter(tweet =>
    tweet.link &&
    !SEEN_TWEETS.has(tweet.link) &&
    KEYWORDS.some(keyword => tweet.text.toLowerCase().includes(keyword))
  );

  // Mark these tweets as seen
  tweets.forEach(tweet => SEEN_TWEETS.add(tweet.link));

  // Send tweets in batches
  for (let i = 0; i < tweets.length; i += MAX_BATCH_SIZE) {
    const batch = tweets.slice(i, i + MAX_BATCH_SIZE).map(t => ({
      tweetId: t.link.split('/status/')[1],
      text: t.text,
      author: t.author
    }));
    await sendBatch(batch);

    if (i + MAX_BATCH_SIZE < tweets.length) {
      console.log(`Waiting ${DELAY_MS / 1000}s before sending next batch...`);
      await delay(DELAY_MS);
    }
  }

  await browser.close();
}

runBot().catch(console.error);
