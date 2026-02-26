const mongoose = require('mongoose');

const hourSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },   // mantengo tu id string
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    description: { type: String, default: '' }
});

module.exports = mongoose.model('Hour', hourSchema);