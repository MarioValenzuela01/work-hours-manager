
const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    name: {
        type: String,
        required: true,
        trim: true
    },

    brand: {
        type: String,
        required: true
    },

    model: {
        type: String,
        required: true
    },

    serialNumber: {
        type: String,
        default: ''
    },

    nfcCode: {
        type: String,
        required: true,
        unique: true
    },

    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Equipment', equipmentSchema);
