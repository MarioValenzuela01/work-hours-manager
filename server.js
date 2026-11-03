require('dotenv').config({
    path: process.env.NODE_ENV === 'development'
        ? '.env.development'
        : '.env'
});
if (process.env.NODE_ENV === 'development') {
    if (process.env.MONGO_DB_NAME !== 'workhours_nfc_dev') {
        throw new Error('Development database is not configured');
    }

    console.log('Development mode enabled');
}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Hour = require('./models/hours.model'); // ✅ importa el modelo
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const { requireAuth } = require('./middleware/auth.middleware');
const inspectionRoutes = require('./inspection/inspection.routes');
const lawnInspectionRoutes = require("./routes/lawn-inspection.routes");
const equipmentRoutes = require('./routes/equipment.routes');
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;       // ✅ define port
const MONGO_URI = process.env.MONGO_URI;     // ✅ toma del .env
const photoRoutes = require("./routes/photo.Routes");


app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.status(200).send('OK'));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/inspection', inspectionRoutes);
app.use('/api/lawn-inspection', lawnInspectionRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use("/api/photos", photoRoutes);


// Connect Mongo
// mongoose.connect(MONGO_URI)
//     .then(() => console.log('✅ Mongo Connected'))
//     .catch(err => console.log(err));


const mongoOptions = {};

if (process.env.NODE_ENV === 'development') {
    if (process.env.MONGO_DB_NAME !== 'workhours_nfc_dev') {
        throw new Error('Invalid development database name');
    }

    mongoOptions.dbName = 'workhours_nfc_dev';
}


async function startServer() {
    try {
        if (process.env.NODE_ENV === 'development') {
            if (process.env.MONGO_DB_NAME !== 'workhours_nfc_dev') {
                throw new Error('Invalid development database');
            }

            if (!MONGO_URI) {
                throw new Error('MONGO_URI is missing');
            }
        }

        await mongoose.connect(MONGO_URI, mongoOptions);

        const databaseName = mongoose.connection.name;

        if (
            process.env.NODE_ENV === 'development' &&
            databaseName !== 'workhours_nfc_dev'
        ) {
            await mongoose.disconnect();
            throw new Error('Unsafe database connection');
        }

        console.log('MongoDB connected');
        console.log('Database:', databaseName);

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Startup failed:', error.message);
        process.exitCode = 1;
    }
}

startServer();



// GET all hours
app.get('/api/hours', requireAuth, async (req, res) => {
    try {
        const hours = await Hour.find({ userId: req.userId }).sort({ date: -1, startTime: -1 });
        res.json(hours);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// GET hours summary
app.get('/api/hours/summary', requireAuth, async (req, res) => {
    try {
        const hours = await Hour.find({ userId: req.userId })
            .sort({ date: -1, startTime: -1 });

        const summary = hours.map(item => {
            const start = new Date(`2000-01-01T${item.startTime}`);
            const end = new Date(`2000-01-01T${item.endTime}`);

            const totalHours = (end - start) / (1000 * 60 * 60);

            return {
                employee: 'Me',
                date: item.date,
                week: getWeekLabel(item.date),
                totalHours: totalHours,
                recordType: item.recordType,
                description: item.description
            };
        });

        res.json(summary);

    } catch (error) {
        res.status(500).json({ error: 'Failed to load summary' });
    }
});

function getWeekLabel(dateString) {
    const date = new Date(dateString);
    const firstDay = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + firstDay.getDay() + 1) / 7);

    return `Week ${weekNumber}`;
}

// POST new entry
app.post('/api/hours', requireAuth, async (req, res) => {
    try {
        const { date, startTime, endTime, description, recordType } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newEntry = new Hour({
            id: Date.now().toString(),
            userId: req.userId,
            date,
            startTime,
            endTime,
            description: description || '',
            recordType: recordType || 'work'
        });

        await newEntry.save();

        res.status(201).json(newEntry);
    } catch (error) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// PUT update entry
app.put('/api/hours/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { date, startTime, endTime, description, recordType } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const updated = await Hour.findOneAndUpdate(
            { id, userId: req.userId },
            { date, startTime, endTime, description: description || '', recordType: recordType || 'work' },
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
app.delete('/api/hours/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Hour.deleteOne({ id, userId: req.userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ message: 'Entry deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

app.get('/equipment/:nfcCode', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'public', 'equipment.html')
    );
});

app.get("/photos", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "photos.html"));
});

