import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import projectRoutes from './routes/projects.js';
import User from './models/User.js';

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  throw new Error('MONGODB_URI and JWT_SECRET must be set in the environment.');
}

const app = express();
const server = http.createServer(app);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: clientOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'] } });

app.set('io', io);
app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required.'));
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(userId).select('_id');
    if (!user) return next(new Error('Account not found.'));
    socket.data.userId = userId;
    next();
  } catch (error) {
    next(error);
  }
});

io.on('connection', () => {});

const port = Number(process.env.PORT || 5000);
await mongoose.connect(process.env.MONGODB_URI);
server.on('error', async (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing process or set a different PORT in .env.`);
  } else {
    console.error('Unable to start the Taskflow API:', error.message);
  }
  await mongoose.disconnect();
  process.exitCode = 1;
});
server.listen(port, () => console.log(`Taskflow API listening on port ${port}`));
