const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data', 'hours.json');

app.use(express.static('public'));
app.use(express.json());

// Helper to read data
const readData = () => {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
};

// Helper to write data
const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// API Endpoints

// GET all hours
app.get('/api/hours', (req, res) => {
    try {
        const hours = readData();
        res.json(hours);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// POST new entry
app.post('/api/hours', (req, res) => {
    try {
        const { date, startTime, endTime, description } = req.body;
        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newEntry = {
            id: Date.now().toString(),
            date,
            startTime,
            endTime,
            description: description || ''
        };

        const hours = readData();
        hours.push(newEntry);
        writeData(hours);

        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// PUT update entry
app.put('/api/hours/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { date, startTime, endTime, description } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let hours = readData();
        const index = hours.findIndex(entry => entry.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        hours[index] = {
            ...hours[index],
            date,
            startTime,
            endTime,
            description: description || ''
        };

        writeData(hours);
        res.json(hours[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update data' });
    }
});

// DELETE entry
app.delete('/api/hours/:id', (req, res) => {
    try {
        const { id } = req.params;
        let hours = readData();
        const initialLength = hours.length;
        hours = hours.filter(entry => entry.id !== id);

        if (hours.length === initialLength) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        writeData(hours);
        res.json({ message: 'Entry deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
