const mongoose = require('mongoose');

const hourSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },   // mantengo tu id string
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    description: { type: String, default: '' },
    recordType: { type: String, enum: ['work', 'practicum'], default: 'work' }
});

module.exports = mongoose.model('Hour', hourSchema);