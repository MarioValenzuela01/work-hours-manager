const express = require('express');
const router = express.Router();
const controller = require('./inspection.controller');

// Existing inspection routes
router.get('/', controller.loadForm);
router.post('/pdf', controller.generatePDF);

// New routes for selecting hours
router.get('/select-hours', controller.loadSelectHours);
router.post('/select-hours', controller.handleSelectHour);

module.exports = router;