console.log('Starting app.js...');

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const workHoursRoutes = require('./routes/workHours.routes');

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/hours', workHoursRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'API running 🚀' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('Mongo error:', err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));