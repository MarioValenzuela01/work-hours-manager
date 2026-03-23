const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');   // 👈 AGREGAR ESTA LINEA
const User = require('../models/user.model');

const register = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'username and password required' });
  }

  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(400).json({ ok: false, message: 'Username already exists' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  await User.create({ username, passwordHash });
  return res.status(201).json({ ok: true, message: 'User created' });
};

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'username and password required' });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(401).json({ ok: false, message: 'Invalid login' });
  }

  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ ok: false, message: 'Invalid login' });
  }

  // ✅ Crear JWT
  const token = jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  return res.status(200).json({
    ok: true,
    message: 'Login OK',
    token,
    role: user.role
  });
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.userId;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, message: 'Old and new password required' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, message: 'User not found' });
    }

    const match = bcrypt.compareSync(oldPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, message: 'Invalid old password' });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    await user.save();

    return res.status(200).json({ ok: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ ok: false, message: 'Server error changing password' });
  }
};

module.exports = { register, login, changePassword };