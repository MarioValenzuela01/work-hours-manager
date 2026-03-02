const WorkHours = require('../models/workHours.model');

const createHours = async (req, res) => {
  const { date, hours, note } = req.body;

  if (!date || hours === undefined) {
    return res.status(400).json({ ok: false, message: 'date and hours required' });
  }

  const numHours = Number(hours);
  if (Number.isNaN(numHours) || numHours < 0) {
    return res.status(400).json({ ok: false, message: 'hours must be a number >= 0' });
  }

  const item = await WorkHours.create({
    userId: req.userId,
    date: new Date(date),
    hours: numHours,
    note: note || ''
  });

  return res.status(201).json({ ok: true, item });
};

const getMyHours = async (req, res) => {
  const items = await WorkHours.find({ userId: req.userId }).sort({ date: -1 });
  return res.json({ ok: true, items });
};

const updateHours = async (req, res) => {
  const { id } = req.params;
  const { date, hours, note } = req.body;

  const doc = await WorkHours.findOne({ _id: id, userId: req.userId });
  if (!doc) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }

  if (date) doc.date = new Date(date);

  if (hours !== undefined) {
    const numHours = Number(hours);
    if (Number.isNaN(numHours) || numHours < 0) {
      return res.status(400).json({ ok: false, message: 'hours must be a number >= 0' });
    }
    doc.hours = numHours;
  }

  if (note !== undefined) doc.note = note;

  await doc.save();
  return res.json({ ok: true, item: doc });
};

const deleteHours = async (req, res) => {
  const { id } = req.params;

  const deleted = await WorkHours.findOneAndDelete({ _id: id, userId: req.userId });
  if (!deleted) {
    return res.status(404).json({ ok: false, message: 'Not found' });
  }

  return res.json({ ok: true, message: 'Deleted' });
};

// ✅ Export al final
module.exports = { createHours, getMyHours, updateHours, deleteHours };