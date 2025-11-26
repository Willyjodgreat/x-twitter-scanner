require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

app.post('/start', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) return res.status(400).json({ error: 'Missing keyword' });

    // Call the original bot URL from env variables
    const botUrl = process.env.BOT_URL;

    const response = await axios.post(botUrl, { keyword });

    res.json(response.data);
  } catch (error) {
    console.error('Wrapper error:', error.message);
    res.status(500).json({ error: 'Failed to call the bot' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Wrapper bot running on port ${PORT}`);
});
