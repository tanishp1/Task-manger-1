import { Router } from 'express';
import mongoose from 'mongoose';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();
const allowedStatuses = ['todo', 'progress', 'review', 'done'];
const allowedPriorities = ['low', 'medium', 'high'];

function taskPayload(task) {
  return {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    project: task.project ? { id: task.project._id, name: task.project.name, color: task.project.color } : null,
    assignee: task.assignee ? { id: task.assignee._id, name: task.assignee.name, email: task.assignee.email } : null,
    createdBy: task.createdBy ? { id: task.createdBy._id, name: task.createdBy.name } : null,
    createdAt: task.createdAt,
  };
}

const populatedTask = (query) => query.populate('assignee', 'name email').populate('createdBy', 'name').populate('project', 'name color');

router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try {
    const tasks = await populatedTask(Task.find()).sort({ createdAt: -1 });
    res.json(tasks.map(taskPayload));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description = '', status = 'todo', priority = 'medium', dueDate = null, assignee = null, project = null } = req.body;
    if (typeof title !== 'string' || !title.trim() || title.length > 140) return res.status(400).json({ message: 'Task title is required (140 characters max).' });
    if (!allowedStatuses.includes(status) || !allowedPriorities.includes(priority)) return res.status(400).json({ message: 'Choose a valid status and priority.' });
    if (typeof description !== 'string' || description.length > 1000) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) return res.status(400).json({ message: 'Choose a valid due date.' });
    if (assignee && !mongoose.isValidObjectId(assignee)) return res.status(400).json({ message: 'Choose a valid team member.' });
    if (project && !mongoose.isValidObjectId(project)) return res.status(400).json({ message: 'Choose a valid project.' });
    if (project && !(await Project.exists({ _id: project }))) return res.status(400).json({ message: 'That project no longer exists.' });
    const task = await Task.create({ title: title.trim(), description, status, priority, dueDate: dueDate || null, assignee: assignee || null, project: project || null, createdBy: req.user._id });
    const populated = await populatedTask(Task.findById(task._id));
    const result = taskPayload(populated);
    req.app.get('io').emit('task:created', result);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID.' });
    const changes = {};
    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid status.' });
      changes.status = req.body.status;
    }
    if (req.user.role === 'admin') {
      for (const key of ['title', 'description', 'priority']) {
        if (req.body[key] !== undefined) changes[key] = req.body[key];
      }
      if (req.body.assignee !== undefined) {
        if (req.body.assignee && !mongoose.isValidObjectId(req.body.assignee)) return res.status(400).json({ message: 'Choose a valid team member.' });
        changes.assignee = req.body.assignee || null;
      }
      if (req.body.project !== undefined) {
        if (req.body.project && !mongoose.isValidObjectId(req.body.project)) return res.status(400).json({ message: 'Choose a valid project.' });
        if (req.body.project && !(await Project.exists({ _id: req.body.project }))) return res.status(400).json({ message: 'That project no longer exists.' });
        changes.project = req.body.project || null;
      }
      if (req.body.dueDate !== undefined) {
        if (req.body.dueDate && Number.isNaN(Date.parse(req.body.dueDate))) return res.status(400).json({ message: 'Choose a valid due date.' });
        changes.dueDate = req.body.dueDate || null;
      }
    }
    if (changes.title !== undefined && (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.length > 140)) {
      return res.status(400).json({ message: 'Task title is required (140 characters max).' });
    }
    if (changes.description !== undefined && (typeof changes.description !== 'string' || changes.description.length > 1000)) return res.status(400).json({ message: 'Description must be 1,000 characters or fewer.' });
    if (changes.priority !== undefined && !allowedPriorities.includes(changes.priority)) return res.status(400).json({ message: 'Choose a valid priority.' });
    const task = await populatedTask(Task.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }));
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const result = taskPayload(task);
    req.app.get('io').emit('task:updated', result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task ID.' });
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    req.app.get('io').emit('task:deleted', { id: req.params.id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
