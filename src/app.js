const express = require('express');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Express app is running' });
});

module.exports = app;

