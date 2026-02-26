require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Hour = require('./models/hours.model'); // ✅ importa el modelo

const app = express();

const PORT = process.env.PORT || 3000;       // ✅ define port
const MONGO_URI = process.env.MONGO_URI;     // ✅ toma del .env

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Connect Mongo
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Mongo Connected'))
    .catch(err => console.log(err));

// GET all hours
app.get('/api/hours', async (req, res) => {
    try {
        const hours = await Hour.find().sort({ date: -1, startTime: -1 });
        res.json(hours);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST new entry
app.post('/api/hours', async (req, res) => {
    try {
        const { date, startTime, endTime, description } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newEntry = new Hour({
            id: Date.now().toString(),
            date,
            startTime,
            endTime,
            description: description || ''
        });

        await newEntry.save();

        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// PUT update entry
app.put('/api/hours/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { date, startTime, endTime, description } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const updated = await Hour.findOneAndUpdate(
            { id },
            { date, startTime, endTime, description: description || '' },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// DELETE entry
app.delete('/api/hours/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Hour.deleteOne({ id });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ message: 'Entry deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});