import { Router } from 'express';
import Project from '../models/Project.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const projects = await Project.find().sort({ createdAt: 1 });
    res.json(projects.map((project) => ({
      id: project._id,
      name: project.name,
      color: project.color,
    })));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const color = req.body.color || 'purple';
    if (!name || name.length > 80) return res.status(400).json({ message: 'Project name is required (80 characters max).' });
    if (!['purple', 'orange', 'green', 'blue'].includes(color)) return res.status(400).json({ message: 'Choose a valid project color.' });
    const project = await Project.create({ name, color, createdBy: req.user._id });
    res.status(201).json({ id: project._id, name: project.name, color: project.color });
  } catch (error) {
    next(error);
  }
});

export default router;
