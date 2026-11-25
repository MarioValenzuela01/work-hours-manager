const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth.middleware');
const {
    getAllUsers,
    resetUserPassword,
    deleteUser,
    getAllHours,
    getUserHours,
    updateUserFullName
} = require('../controllers/admin.controller');

const router = express.Router();

// All routes require both authentication and admin privileges
router.use(requireAuth);
router.use(requireAdmin);

router.get('/users', getAllUsers);
router.put('/users/password', resetUserPassword);
router.patch('/users/:userId/full-name', updateUserFullName);
router.delete('/users/:userId', deleteUser);
router.get('/hours', getAllHours);
router.get('/users/:userId/hours', getUserHours);

module.exports = router;
