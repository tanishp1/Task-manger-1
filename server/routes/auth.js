import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function issueToken(user) {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ message: 'Add your name, a valid email, and a password of at least 8 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'An account with that email already exists.' });
    const role = await User.estimatedDocumentCount() === 0 ? 'admin' : 'member';
    const user = await User.create({
      name: name.trim().slice(0, 60),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role,
    });
    res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with that email already exists.' });
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'That email and password don’t match.' });
    }
    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    const changingPassword = Boolean(currentPassword || newPassword);

    if (!name || name.length > 60) return res.status(400).json({ message: 'Your name is required (60 characters max).' });
    if (changingPassword && (!currentPassword || newPassword.length < 8)) {
      return res.status(400).json({ message: 'Enter your current password and a new password of at least 8 characters.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'Your account is no longer available.' });
    if (changingPassword && !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }

    user.name = name;
    if (changingPassword) user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/members', authenticate, async (_req, res, next) => {
  try {
    const members = await User.find().select('name email role').sort({ name: 1 });
    res.json(members.map(publicUser));
  } catch (error) {
    next(error);
  }
});

export default router;
