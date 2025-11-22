import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

app.get('/scan', async (req, res) => {
  const tweetUrl = req.query.url;
  if (!tweetUrl) return res.status(400).send("❌ Missing tweet URL");

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(tweetUrl, { waitUntil: 'networkidle2' });

    const tweetText = await page.evaluate(() => {
      const tweet = document.querySelector('div[data-testid="tweetText"]');
      return tweet ? tweet.innerText : null;
    });

    await browser.close();

    if (!tweetText) return res.status(404).send("❌ Couldn't find tweet content");

    res.json({ tweetText });
  } catch (err) {
    res.status(500).send("❌ Error: " + err.message);
  }
});

app.listen(3000, () => console.log("🟢 Scraper running on port 3000"));
