const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');
const axios = require('axios');

const WEBHOOK_URL = 'https://n8n-kkdq.onrender.com/webhook-test/7da40efb-5ac9-487d-8109-f4542bc49ebe'; // Replace with your webhook

(async () => {
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://x.com/search?q=web3&f=live', { waitUntil: 'networkidle2' });

    // Wait 10 seconds for content to load
    await page.waitForTimeout(10000);

    // Scrape tweets
      const tweets = await page.evaluate(() => {
      const nodes = document.querySelectorAll('article div[lang]');
      const results = [];
      nodes.forEach(node => {
        const text = node.innerText;
        const article = node.closest('article');
        const id = article?.querySelector('a[href*="/status/"]')?.getAttribute('href')?.split('/').pop() || null;
        if (id && text) {
          results.push({ id, text });
        }
      });
      return results;
    });

    // Filter tweets by keywords
    const keywords = ['web3', 'ai'];
    const filteredTweets = tweets.filter(t =>
      keywords.some(kw => t.text.toLowerCase().includes(kw))
    ).slice(0, 10); // max 10 tweets

    // Post each tweet to n8n webhook
    for (const tweet of filteredTweets) {
      await axios.post(WEBHOOK_URL, {
        tweetId: tweet.id,
        text: tweet.text,
      });
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
