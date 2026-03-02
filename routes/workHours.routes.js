const express = require('express');
const { requireAuth } = require('../middleware/auth.middleware');
const { createHours, getMyHours, updateHours, deleteHours } = require('../controllers/workHours.controller');

const router = express.Router();

router.get('/', requireAuth, getMyHours);
router.post('/', requireAuth, createHours);
router.put('/:id', requireAuth, updateHours);
router.delete('/:id', requireAuth, deleteHours);

module.exports = router;