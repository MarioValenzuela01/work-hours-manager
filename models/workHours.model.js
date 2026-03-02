const mongoose = require('mongoose');

const workHoursSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  date: {
    type: Date,
    required: true
  },
  hours: {
    type: Number,
    required: true
  },
  note: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('WorkHours', workHoursSchema);