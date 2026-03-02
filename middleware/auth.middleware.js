const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization; // "Bearer token"
  if (!header) return res.status(401).json({ ok: false, message: 'Missing Authorization header' });

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ ok: false, message: 'Invalid Authorization format' });
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid token' });
  }
};

module.exports = { requireAuth };