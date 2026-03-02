const express = require('express');
const { register, login, changePassword } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.put('/password', requireAuth, changePassword);

module.exports = router;