# Taskflow

A full-stack Kanban task board built with MongoDB, Express, React, Node.js, and Socket.io. It includes account registration, admin/member roles, task assignments and priorities, drag-and-drop status changes, and live updates across signed-in clients.

## Requirements

- Node.js 18+
- MongoDB 6+ (local or hosted)

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a long, random `JWT_SECRET`.
3. Start the API and React development server:

   ```bash
   npm run dev
   ```

4. Visit `http://localhost:5173` and create an account. The first registered account is the workspace admin; later registrations are members.

If the API is already running on the configured port, the development command reuses it instead of starting a duplicate server.

The Express API runs on port `5000` by default. Set `CLIENT_ORIGIN` if the Vite client uses a different origin. To make a production client bundle, run `npm run build`; to run the API, use `npm start`.

## Roles

- **Admin:** create, edit, assign, move, and delete tasks.
- **Member:** create tasks and move them between workflow stages.

Task updates are persisted in MongoDB. Authenticated Socket.io clients receive task creation, update, and deletion events in real time.

The workspace navigation includes an overview, a board, tasks assigned to the signed-in user, and a due-date calendar. Projects are shared and persisted in MongoDB; tasks can be assigned to a project when they are created or edited.

Help & support includes task, project, role, and calendar guidance. Account settings let each user update their display name and securely change their password using their current password.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/me`, `GET /api/auth/members`
- `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`
- `GET /api/projects`, `POST /api/projects`
- `GET /api/health`
