const User = require('../models/user.model');
const Hour = require('../models/hours.model');
const bcrypt = require('bcryptjs');

const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-passwordHash').sort({ username: 1 });
        return res.status(200).json({ ok: true, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ ok: false, message: 'Server error fetching users' });
    }
};

const resetUserPassword = async (req, res) => {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
        return res.status(400).json({ ok: false, message: 'User ID and new password are required' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }

        user.passwordHash = bcrypt.hashSync(newPassword, 10);
        await user.save();

        return res.status(200).json({ ok: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        return res.status(500).json({ ok: false, message: 'Server error resetting password' });
    }
};

const deleteUser = async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ ok: false, message: 'User not found' });
        }

        // Optionally prevent deleting self if req.userId === userId
        if (req.userId === userId) {
            return res.status(400).json({ ok: false, message: 'Cannot delete your own admin account' });
        }

        // Delete user
        await User.findByIdAndDelete(userId);
        // Delete their associated hours
        await Hour.deleteMany({ userId });

        return res.status(200).json({ ok: true, message: 'User and their hours deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ ok: false, message: 'Server error deleting user' });
    }
};

const getAllHours = async (req, res) => {
    try {
        // We fetch all hours and ideally populate user info if there was a proper ref.
        // Since hours.model probably stores userId as a String, we might need to manually group or just fetch all.
        // Let's fetch all hours. We'll sort by date descending.
        const hours = await Hour.find({}).sort({ date: -1, startTime: -1 });

        // To make it easy for frontend, we can get all users and map them
        const users = await User.find({}, 'username');
        const userMap = {};
        users.forEach(u => {
            userMap[u._id.toString()] = u.username;
        });

        // Attach username to each hour
        const hoursWithUsernames = hours.map(h => ({
            ...h.toObject(),
            username: userMap[h.userId] || 'Unknown User'
        }));

        return res.status(200).json({ ok: true, hours: hoursWithUsernames });
    } catch (error) {
        console.error('Error fetching all hours:', error);
        return res.status(500).json({ ok: false, message: 'Server error fetching all hours' });
    }
};

const getUserHours = async (req, res) => {
    const { userId } = req.params;
    try {
        const hours = await Hour.find({ userId }).sort({ date: -1, startTime: -1 });
        return res.status(200).json({ ok: true, hours });
    } catch (error) {
        console.error('Error fetching user hours:', error);
        return res.status(500).json({ ok: false, message: 'Server error fetching user hours' });
    }
};

module.exports = { getAllUsers, resetUserPassword, deleteUser, getAllHours, getUserHours };
