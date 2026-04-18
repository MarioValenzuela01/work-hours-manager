console.log('Starting app.js...');

const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const path = require('path');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const workHoursRoutes = require('./routes/workHours.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('OK'));

app.use('/api/auth', authRoutes);
app.use('/api/hours', workHoursRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/test', (req, res) => {
  res.json({ message: 'API running 🚀' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log('Mongo error:', err.message));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));