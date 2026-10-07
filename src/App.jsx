import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Activity, ArrowDownWideNarrow, ArrowRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Command, Filter, FolderKanban, LayoutGrid, ListTodo, Menu, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Users, X,
} from 'lucide-react';

const columns = [
  { id: 'todo', title: 'To do', color: '#9299aa', tone: 'slate' },
  { id: 'progress', title: 'In progress', color: '#805ce5', tone: 'violet' },
  { id: 'review', title: 'In review', color: '#eaa23e', tone: 'amber' },
  { id: 'done', title: 'Done', color: '#48a987', tone: 'green' },
];

const initialUser = () => {
  try { return JSON.parse(localStorage.getItem('taskflow_user')); } catch { return null; }
};
const initialToken = () => localStorage.getItem('taskflow_token') || '';
const avatarColor = (name = '') => ['#f4e4dc', '#dcebe2', '#e7e0f7', '#faedcc', '#dde8f7'][name.charCodeAt(0) % 5];
const initials = (name = '') => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

async function api(path, token, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
  } catch {
    throw new Error('Can’t reach the Taskflow API. Start the app with npm run dev and make sure MongoDB is running.');
  }
  if (response.status === 204) return null;
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The Taskflow API returned an invalid response. Restart the app and try again.');
  }
  if (!response.ok) throw new Error(result.message || 'Something went wrong.');
  return result;
}

function upsertTask(tasks, task) {
  let found = false;
  const updated = tasks.flatMap((item) => {
    if (item.id !== task.id) return [item];
    if (found) return [];
    found = true;
    return [task];
  });
  return found ? updated : [task, ...updated];
}

function Avatar({ name, small = false }) {
  return <span className={`avatar${small ? ' avatar-small' : ''}`} style={{ background: avatarColor(name) }}>{initials(name)}</span>;
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await api(`/auth/${mode}`, '', { method: 'POST', body: JSON.stringify(form) });
      onAuth(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="auth-page">
      <div className="auth-art"><div className="art-orb orb-one" /><div className="art-orb orb-two" /><div className="art-card"><span className="art-icon"><CheckCheck size={19} /></span><div className="art-line" /><div className="art-line short" /><div className="art-progress"><span /></div><div className="art-caption">A little progress, every day.</div></div><span className="art-star star-one">✳</span><span className="art-star star-two">✳</span><div className="art-copy"><span className="eyebrow">MAKE ROOM FOR GREAT WORK</span><h2>Good work<br />happens together.</h2><p>One clear view of what matters, what’s moving, and what’s next.</p></div><span className="art-foot">TASKFLOW · YOUR TEAM’S HAPPY PLACE</span></div>
      <section className="auth-panel"><div className="brand auth-brand"><span className="brand-mark"><CheckCheck size={18} /></span><span>taskflow</span></div><div className="auth-form-wrap"><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'YOUR NEXT CHAPTER'}</span><h1>{mode === 'login' ? 'Sign in to your space' : 'Create your account'}</h1><p className="auth-sub">{mode === 'login' ? 'Pick up where your team left off.' : 'Get your team moving in minutes.'}</p><form onSubmit={submit} className="auth-form">
        {mode === 'register' && <label>Your name<input required maxLength="60" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
        <label>Email address<input required type="email" autoComplete="email" placeholder="you@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input required minLength="8" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <div className="error-box">{error}</div>}<button className="primary-btn auth-submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button></form><p className="auth-switch">{mode === 'login' ? 'New to Taskflow?' : 'Already have a space?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><p className="auth-note"><Sparkles size={13} /> Your team’s work, always in sync.</p></div></section>
    </main>
  );
}

function TaskModal({ task, initialStatus = 'todo', members, projects, defaultProject = '', onClose, onSave, busy }) {
  const [form, setForm] = useState(task || { title: '', description: '', status: initialStatus, priority: 'medium', dueDate: '', assignee: '', project: defaultProject });
  const [error, setError] = useState('');
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event) {
    event.preventDefault(); setError('');
    try { await onSave({ ...form, dueDate: form.dueDate || null, assignee: form.assignee || null }); }
    catch (err) { setError(err.message); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="task-modal"><div className="modal-head"><div><span className="eyebrow">{task ? 'TASK DETAILS' : 'NEW TASK'}</span><h2>{task ? 'Edit task' : 'Add a task'}</h2></div><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit}><label>Task name<input required maxLength="140" autoFocus placeholder="What needs to get done?" value={form.title} onChange={(e) => set('title', e.target.value)} /></label><label>Description <span className="optional">OPTIONAL</span><textarea maxLength="1000" rows="3" placeholder="Add a little more context…" value={form.description} onChange={(e) => set('description', e.target.value)} /></label><div className="form-row"><label>Status<select value={form.status} onChange={(e) => set('status', e.target.value)}>{columns.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}</select></label><label>Priority<select value={form.priority} onChange={(e) => set('priority', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><div className="form-row"><label>Assignee<select value={form.assignee?.id || form.assignee || ''} onChange={(e) => set('assignee', e.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label><label>Project<select value={form.project?.id || form.project || ''} onChange={(e) => set('project', e.target.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div><label>Due date<input type="date" value={form.dueDate ? new Date(form.dueDate).toISOString().slice(0, 10) : ''} onChange={(e) => set('dueDate', e.target.value)} /></label>{error && <div className="error-box">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}<ArrowRight size={15} /></button></div></form></section></div>;
}

function ProjectModal({ onClose, onCreate, busy }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('purple');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    try { await onCreate({ name, color }); } catch (err) { setError(err.message); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="task-modal"><div className="modal-head"><div><span className="eyebrow">TEAM WORKSPACE</span><h2>Create a project</h2></div><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div><form onSubmit={submit}><label>Project name<input required maxLength="80" autoFocus placeholder="e.g. Website launch" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Project color<select value={color} onChange={(event) => setColor(event.target.value)}><option value="purple">Purple</option><option value="orange">Orange</option><option value="green">Green</option><option value="blue">Blue</option></select></label>{error && <div className="error-box">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-btn" onClick={onClose}>Cancel</button><button className="primary-btn" disabled={busy}>{busy ? 'Creating…' : 'Create project'}<ArrowRight size={15} /></button></div></form></section></div>;
}

function CalendarView({ month, tasks, onMonthChange }) {
  const first = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date;
  });
  const tasksByDate = new Map();
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    tasksByDate.set(key, [...(tasksByDate.get(key) || []), task]);
  }

  return <section className="calendar-view"><div className="calendar-head"><div><span className="eyebrow">PLAN YOUR WORK</span><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2></div><div className="calendar-controls"><button className="toolbar-icon" aria-label="Previous month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><button className="secondary-btn" onClick={() => onMonthChange(new Date())}>Today</button><button className="toolbar-icon" aria-label="Next month" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div></div><div className="calendar-grid">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{days.map((date) => { const key = date.toISOString().slice(0, 10); return <div className={`calendar-day${date.getUTCMonth() !== month.getMonth() ? ' outside-month' : ''}${key === new Date().toISOString().slice(0, 10) ? ' today' : ''}`} key={key}><span className="calendar-day-number">{date.getUTCDate()}</span><div className="calendar-day-tasks">{(tasksByDate.get(key) || []).map((task) => <span className={`calendar-task tone-${task.status}`} key={task.id} title={`${task.title} · ${task.status}`}>{task.title}</span>)}</div></div>; })}</div><p className="calendar-hint">Tasks with due dates appear on their scheduled day.</p></section>;
}

function SettingsView({ user, busy, onSave }) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      await onSave({ name, currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return <section className="settings-view">
    <div className="settings-intro"><span className="settings-avatar"><Avatar name={user.name} /></span><div><h2>Account settings</h2><p>Manage your profile and sign-in details.</p></div></div>
    <form className="settings-form" onSubmit={submit}>
      <div className="settings-section"><span className="eyebrow">PROFILE</span><label>Full name<input required maxLength="60" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Email address<input value={user.email} readOnly /><span className="settings-hint">Email address can’t be changed here.</span></label></div>
      <div className="settings-section"><span className="eyebrow">CHANGE PASSWORD</span><p className="settings-hint">Leave both password fields blank to keep your current password.</p><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label>New password<input type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label></div>
      {error && <div className="error-box">{error}</div>}{saved && <div className="success-box">Your settings have been saved.</div>}
      <div className="settings-actions"><button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}<Check size={15} /></button></div>
    </form>
  </section>;
}

function HelpView() {
  return <section className="help-view"><div className="help-welcome"><span className="help-icon"><CircleHelp size={22} /></span><div><span className="eyebrow">TASKFLOW HELP CENTER</span><h2>How can we help?</h2><p>Quick answers to help you and your team keep work moving.</p></div></div><div className="help-faq"><h3>Frequently asked questions</h3><details><summary>How do I create a task?</summary><p>Select <strong>New task</strong> or use <strong>Add a task</strong> in a board column. Add a title, then set its status, priority, assignee, project, and due date.</p></details><details><summary>How do I move a task?</summary><p>Drag a task card to another column. You can also open the task’s status menu to choose its next stage. Changes sync live with your team.</p></details><details><summary>What can each role do?</summary><p>Admins can create, edit, assign, and delete tasks. Members can create tasks and move them through the workflow.</p></details><details><summary>How do projects work?</summary><p>Choose <strong>Add a project</strong> in the sidebar to create a project. Assign tasks to it from the task form, then select the project to see its board.</p></details><details><summary>How do I change my name or password?</summary><p>Open <strong>Settings</strong> in the sidebar. Update your name, or provide your current password and a new password to change your sign-in details.</p></details></div><div className="help-contact"><div><strong>Still need a hand?</strong><span>Contact the Taskflow support team.</span></div><a className="secondary-btn" href="mailto:support@taskflow.app?subject=Taskflow%20support">Email support <ArrowRight size={14} /></a></div></section>;
}

function TaskCard({ task, canEdit, onEdit, onDragStart, onDragEnd }) {
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && task.status !== 'done';
  return <article className="task-card" draggable onDragStart={(event) => onDragStart(event, task)} onDragEnd={onDragEnd} onClick={() => canEdit && onEdit(task)}>
    <div className="card-top"><span className={`priority priority-${task.priority}`}><i />{task.priority}</span><button className="card-menu" aria-label={`Edit ${task.title}`} onClick={(e) => { e.stopPropagation(); onEdit(task); }}><MoreHorizontal size={17} /></button></div>
    <h3>{task.title}</h3>{task.description && <p className="task-desc">{task.description}</p>}
    <div className="card-bottom"><div className={`due-date${overdue ? ' overdue' : ''}`}>{due ? <><CalendarDays size={13} />{due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</> : <span className="no-date" />}</div>{task.assignee ? <div className="assignee" title={task.assignee.name}><Avatar name={task.assignee.name} small /></div> : <span className="unassigned">Unassigned</span>}</div>
  </article>;
}

function App() {
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(initialUser);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('board');
  const [selectedProject, setSelectedProject] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [projectModal, setProjectModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState(() => {
    try {
      const storedUser = initialUser();
      const stored = storedUser?.id
        ? JSON.parse(localStorage.getItem(`taskflow_read_notifications:${storedUser.id}`) || '[]')
        : [];
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const userId = user?.id;
  const isAdmin = user?.role === 'admin';

  function signIn(result) {
    localStorage.setItem('taskflow_token', result.token);
    localStorage.setItem('taskflow_user', JSON.stringify(result.user));
    setToken(result.token); setUser(result.user);
  }
  function signOut() {
    localStorage.removeItem('taskflow_token'); localStorage.removeItem('taskflow_user');
    setToken(''); setUser(null); setTasks([]); setMembers([]);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    Promise.all([api('/tasks', token), api('/auth/members', token), api('/auth/me', token), api('/projects', token)])
      .then(([nextTasks, nextMembers, profile, nextProjects]) => {
        if (active) { setTasks(nextTasks); setMembers(nextMembers); setUser(profile.user); setProjects(nextProjects); localStorage.setItem('taskflow_user', JSON.stringify(profile.user)); setError(''); }
      })
      .catch((err) => { if (active) { setError(err.message); if (err.message.includes('session')) signOut(); } });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = JSON.parse(localStorage.getItem(`taskflow_read_notifications:${user.id}`) || '[]');
      setReadNotifications(Array.isArray(stored) ? stored : []);
    } catch {
      setReadNotifications([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!token) return;
    const socket = io({ auth: { token } });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('task:created', (task) => setTasks((current) => upsertTask(current, task)));
    socket.on('task:updated', (task) => setTasks((current) => current.map((item) => item.id === task.id ? task : item)));
    socket.on('task:deleted', ({ id }) => setTasks((current) => current.filter((task) => task.id !== id)));
    return () => { socket.disconnect(); setConnected(false); };
  }, [token]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.description} ${task.assignee?.name || ''}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (priorityFilter === 'all' || task.priority === priorityFilter);
  }), [tasks, query, priorityFilter]);
  const visibleTasks = useMemo(() => {
    if (view === 'my-tasks') return filteredTasks.filter((task) => task.assignee?.id === userId);
    if (view === 'project') return filteredTasks.filter((task) => task.project?.id === selectedProject?.id);
    return filteredTasks;
  }, [filteredTasks, view, selectedProject, userId]);
  const counts = useMemo(() => Object.fromEntries(columns.map((col) => [col.id, tasks.filter((task) => task.status === col.id).length])), [tasks]);
  const doneCount = counts.done || 0;
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const notifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReminderDay = new Date(today);
    lastReminderDay.setDate(lastReminderDay.getDate() + 7);
    return tasks.flatMap((task) => {
      if (!userId || task.assignee?.id !== userId || task.status === 'done' || !task.dueDate) return [];
      const dateKey = new Date(task.dueDate).toISOString().slice(0, 10);
      const [year, month, day] = dateKey.split('-').map(Number);
      const dueDay = new Date(year, month - 1, day);
      if (dueDay > lastReminderDay) return [];
      const daysUntilDue = Math.round((dueDay - today) / 86400000);
      return [{
        id: `due:${task.id}:${dateKey}`,
        task,
        dueDay,
        daysUntilDue,
        read: readNotifications.includes(`due:${task.id}:${dateKey}`),
      }];
    }).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }, [tasks, userId, readNotifications]);
  const unreadNotificationCount = notifications.filter((notification) => !notification.read).length;

  async function moveTask(task, status) {
    const previous = tasks;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try { await api(`/tasks/${task.id}`, token, { method: 'PATCH', body: JSON.stringify({ status }) }); }
    catch (err) { setTasks(previous); setNotice(err.message); window.setTimeout(() => setNotice(''), 3500); }
  }
  async function saveTask(data) {
    setBusy(true);
    try {
      const isEditing = Boolean(modal?.id);
      const saved = await api(isEditing ? `/tasks/${modal.id}` : '/tasks', token, { method: isEditing ? 'PATCH' : 'POST', body: JSON.stringify(data) });
      setTasks((current) => upsertTask(current, saved));
      setModal(null);
    } finally { setBusy(false); }
  }
  async function createProject(data) {
    setBusy(true);
    try {
      const project = await api('/projects', token, { method: 'POST', body: JSON.stringify(data) });
      setProjects((current) => [...current, project]);
      setSelectedProject(project);
      setView('project');
      setMobileNav(false);
      setProjectModal(false);
    } finally { setBusy(false); }
  }
  async function saveSettings(data) {
    setBusy(true);
    try {
      const result = await api('/auth/me', token, { method: 'PATCH', body: JSON.stringify(data) });
      setUser(result.user);
      setMembers((current) => current.map((member) => member.id === result.user.id ? { ...member, name: result.user.name } : member));
      setTasks((current) => current.map((task) => ({
        ...task,
        assignee: task.assignee?.id === result.user.id ? { ...task.assignee, name: result.user.name } : task.assignee,
        createdBy: task.createdBy?.id === result.user.id ? { ...task.createdBy, name: result.user.name } : task.createdBy,
      })));
      localStorage.setItem('taskflow_user', JSON.stringify(result.user));
    } finally {
      setBusy(false);
    }
  }
  function navigate(nextView) {
    setView(nextView);
    setSelectedProject(null);
    setMobileNav(false);
    setNotificationsOpen(false);
    if (nextView === 'calendar') setCalendarMonth(new Date());
  }
  function markNotificationsRead(ids) {
    const updated = [...new Set([...readNotifications, ...ids])];
    setReadNotifications(updated);
    localStorage.setItem(`taskflow_read_notifications:${user.id}`, JSON.stringify(updated));
  }
  function openNotification(notification) {
    markNotificationsRead([notification.id]);
    setNotificationsOpen(false);
    setSelectedProject(null);
    setCalendarMonth(new Date(notification.dueDay.getFullYear(), notification.dueDay.getMonth(), 1));
    setView('calendar');
  }
  async function deleteTask() {
    if (!modal?.id || !window.confirm('Delete this task? This can’t be undone.')) return;
    try { await api(`/tasks/${modal.id}`, token, { method: 'DELETE' }); setTasks((current) => current.filter((task) => task.id !== modal.id)); setModal(null); }
    catch (err) { setNotice(err.message); window.setTimeout(() => setNotice(''), 3500); }
  }
  function onDragStart(event, task) {
    event.dataTransfer.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('dragging');
  }
  function onDragEnd(event) { event.currentTarget.classList.remove('dragging'); }

  if (!token || !user) return <AuthScreen onAuth={signIn} />;

  return <div className="app-shell">
    <aside className={`sidebar${mobileNav ? ' sidebar-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><CheckCheck size={18} /></span><span>taskflow</span><button className="nav-close icon-btn" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <button className="workspace-switch"><span className="workspace-icon">S</span><span className="workspace-label"><strong>Studio North</strong><small>Free workspace</small></span><ChevronDown size={15} /></button>
      <div className="nav-section"><span className="nav-label">WORKSPACE</span><button className={`nav-item${view === 'overview' ? ' active' : ''}`} onClick={() => navigate('overview')}><LayoutGrid size={17} />Overview</button><button className={`nav-item${view === 'board' ? ' active' : ''}`} onClick={() => navigate('board')}><FolderKanban size={17} />My board<span className="nav-count">{tasks.length}</span></button><button className={`nav-item${view === 'my-tasks' ? ' active' : ''}`} onClick={() => navigate('my-tasks')}><ListTodo size={17} />My tasks<span className="nav-count">{tasks.filter((task) => task.assignee?.id === user.id && task.status !== 'done').length || ''}</span></button><button className={`nav-item${view === 'calendar' ? ' active' : ''}`} onClick={() => navigate('calendar')}><CalendarDays size={17} />Calendar</button></div>
      <div className="nav-section project-section"><div className="nav-label-row"><span className="nav-label">YOUR PROJECTS</span><button className="mini-icon" aria-label="Add project" onClick={() => setProjectModal(true)}><Plus size={15} /></button></div>{projects.map((project) => <button className={`project-item${view === 'project' && selectedProject?.id === project.id ? ' project-active' : ''}`} key={project.id} onClick={() => { setSelectedProject(project); setView('project'); setMobileNav(false); }}><i className={`project-dot dot-${project.color}`} />{project.name}</button>)}<button className="add-project" onClick={() => setProjectModal(true)}><Plus size={14} />Add a project</button></div>
      <div className="sidebar-bottom"><div className="team-card"><div className="team-card-top"><span>YOUR TEAM</span><Users size={14} /></div><div className="avatar-stack">{members.slice(0, 4).map((member) => <Avatar key={member.id} name={member.name} small />)}{members.length > 4 && <span className="more-people">+{members.length - 4}</span>}</div><span className="team-caption">{members.length} {members.length === 1 ? 'person' : 'people'} in your workspace</span></div><button className={`nav-item${view === 'help' ? ' active' : ''}`} onClick={() => navigate('help')}><CircleHelp size={17} />Help & support</button><button className={`nav-item${view === 'settings' ? ' active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={17} />Settings</button></div>
    </aside>
    {mobileNav && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-btn" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Workspace</span><span className="crumb-divider">/</span><strong>{view === 'project' ? selectedProject?.name : ({ overview: 'Overview', board: 'My board', 'my-tasks': 'My tasks', calendar: 'Calendar', help: 'Help & support', settings: 'Settings' }[view])}</strong></div><div className="top-actions"><div className={`sync-status${connected ? ' is-connected' : ''}`}><span />{connected ? 'Live sync' : 'Connecting'}</div><span className="top-divider" /><div className="notification-wrap"><button className="icon-btn notification-btn" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} />{unreadNotificationCount > 0 && <span className="notification-count">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</button>{notificationsOpen && <section className="notification-panel" aria-label="Notifications"><div className="notification-panel-head"><div><strong>Notifications</strong><span>{unreadNotificationCount ? `${unreadNotificationCount} unread` : 'All caught up'}</span></div>{unreadNotificationCount > 0 && <button className="notification-mark-read" onClick={() => markNotificationsRead(notifications.filter((item) => !item.read).map((item) => item.id))}>Mark all read</button>}</div>{notifications.length ? <div className="notification-list">{notifications.map((notification) => <button key={notification.id} className={`notification-item${notification.read ? ' notification-read' : ''}`} onClick={() => openNotification(notification)}><span className={`notification-dot${notification.daysUntilDue < 0 ? ' notification-overdue' : ''}`} /><span className="notification-copy"><strong>{notification.task.title}</strong><span>{notification.daysUntilDue < 0 ? `Overdue by ${Math.abs(notification.daysUntilDue)} ${Math.abs(notification.daysUntilDue) === 1 ? 'day' : 'days'}` : notification.daysUntilDue === 0 ? 'Due today' : `Due in ${notification.daysUntilDue} ${notification.daysUntilDue === 1 ? 'day' : 'days'}`}</span></span><CalendarDays size={15} /></button>)}</div> : <p className="notification-empty">No upcoming task deadlines. You’re all caught up.</p>}</section>}</div><button className="profile-button" onClick={signOut} title="Sign out"><Avatar name={user.name} small /><span className="profile-name">{user.name.split(' ')[0]}</span><ChevronDown size={14} /></button></div></header>
      <div className="content-wrap">
        {view !== 'help' && view !== 'settings' && <section className="board-heading"><div className="heading-title"><div><div className="eyebrow board-eyebrow"><span className="live-dot" /> TEAM WORKSPACE <span className="heading-slash">/</span> <span className="role-label">{isAdmin ? 'ADMIN' : 'MEMBER'}</span></div><h1>{view === 'project' ? selectedProject?.name : ({ overview: 'Overview', board: 'My board', 'my-tasks': 'My tasks', calendar: 'Calendar' }[view])} <span className="heading-spark">✳</span></h1><p>{{ overview: 'A clear picture of what your team is working on.', board: 'A little progress goes a long way. Let’s make today count.', 'my-tasks': 'The tasks assigned to you, all in one place.', calendar: 'See what’s due and plan the work ahead.', project: `Tasks for ${selectedProject?.name || 'your project'}.` }[view]}</p></div><button className="primary-btn create-btn" onClick={() => setModal({ status: 'todo', ...(view === 'project' ? { project: selectedProject?.id } : {}) })}><Plus size={17} />New task</button></div>
          <div className="board-meta"><div className="meta-left"><span className="avatars-overlap">{members.slice(0, 3).map((member) => <Avatar key={member.id} name={member.name} small />)}{members.length > 3 && <span className="more-people">+{members.length - 3}</span>}</span><span className="meta-text"><strong>{members.length} collaborators</strong><span>·</span><span>Updated just now</span></span><span className="meta-separator" /><span className="completion-label"><Check size={13} />{progress}% complete</span></div><div className="meta-date"><CalendarDays size={14} />{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}<ChevronDown size={13} /></div></div>
        </section>}
        {view === 'help' && <section className="board-heading utility-heading"><div><div className="eyebrow board-eyebrow"><span className="live-dot" /> TASKFLOW SUPPORT</div><h1>Help & support</h1><p>Find answers and get back to moving work forward.</p></div></section>}
        {view === 'settings' && <section className="board-heading utility-heading"><div><div className="eyebrow board-eyebrow"><span className="live-dot" /> YOUR ACCOUNT</div><h1>Settings</h1><p>Keep your profile and account details up to date.</p></div></section>}
        {view === 'help' && <HelpView />}
        {view === 'settings' && <SettingsView user={user} busy={busy} onSave={saveSettings} />}
        {(view === 'board' || view === 'overview') && <section className="summary-strip"><div className="summary-intro"><span className="summary-icon"><Sparkles size={17} /></span><div><strong>Looking good, {user.name.split(' ')[0]}!</strong><span>You’ve got this. One task at a time.</span></div></div><div className="summary-stats"><div className="summary-stat"><span className="stat-number">{tasks.length}</span><span>Total tasks</span></div><div className="summary-stat"><span className="stat-number">{counts.progress || 0}</span><span>In progress</span></div><div className="summary-stat"><span className="stat-number">{doneCount}</span><span>Completed</span></div></div><div className="summary-progress"><div className="progress-label"><span>Team progress</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div></section>}
        {view === 'overview' && <section className="overview-panel"><div className="overview-panel-head"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>What’s happening</h2></div><button className="secondary-btn" onClick={() => navigate('board')}>View board <ArrowRight size={14} /></button></div><div className="overview-columns">{columns.map((column) => <button key={column.id} className={`overview-stat tone-${column.tone}`} onClick={() => navigate('board')}><span className="column-dot" /><span>{column.title}</span><strong>{counts[column.id] || 0}</strong></button>)}</div><h3 className="overview-subtitle">Recently updated</h3>{tasks.length ? <div className="overview-task-list">{[...tasks].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5).map((task) => <div className="overview-task" key={task.id}><span className={`column-dot tone-${task.status}`} /><strong>{task.title}</strong><span>{task.project?.name || 'No project'}</span><span>{task.assignee?.name || 'Unassigned'}</span></div>)}</div> : <p className="overview-empty">No tasks yet. Create your first task to get the team moving.</p>}</section>}
        {view !== 'calendar' && view !== 'overview' && view !== 'help' && view !== 'settings' && <section className="board-toolbar"><div className="toolbar-label"><Activity size={15} /><strong>{view === 'my-tasks' ? 'Assigned to me' : view === 'project' ? selectedProject?.name : 'Project board'}</strong><span className="task-total">{visibleTasks.length}</span></div><div className="toolbar-tools"><label className="search-box"><Search size={15} /><input placeholder="Search tasks..." value={query} onChange={(e) => setQuery(e.target.value)} /><kbd><Command size={10} /> K</kbd></label><label className="filter-select"><Filter size={14} /><select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><ChevronDown size={13} /></label><button className="toolbar-icon" title="Sort by priority"><ArrowDownWideNarrow size={15} /></button><span className="toolbar-divider" /><button className="toolbar-icon" title="Board options"><MoreHorizontal size={18} /></button></div></section>}
        {error && <div className="banner-error">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
        {view === 'calendar' && <CalendarView month={calendarMonth} tasks={tasks} onMonthChange={setCalendarMonth} />}
        {view === 'overview' && null}
        {view !== 'calendar' && view !== 'overview' && view !== 'help' && view !== 'settings' && <section className="kanban-board">{columns.map((column) => {
          const columnTasks = visibleTasks.filter((task) => task.status === column.id);
          return <div className="kanban-column" key={column.id} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => { e.preventDefault(); const task = tasks.find((item) => item.id === e.dataTransfer.getData('text/plain')); if (task && task.status !== column.id) moveTask(task, column.id); }}>
            <div className={`column-heading tone-${column.tone}`}><div className="column-title"><span className="column-dot" /><h2>{column.title}</h2><span className="column-count">{columnTasks.length}</span></div><button className="column-add" aria-label={`Add task to ${column.title}`} onClick={() => setModal({ status: column.id })}><Plus size={16} /></button></div>
            <div className="task-list">{columnTasks.map((task) => <TaskCard key={task.id} task={task} canEdit={isAdmin} onEdit={(item) => setModal(item)} onDragStart={onDragStart} onDragEnd={onDragEnd} />)}
              {columnTasks.length === 0 && <div className="empty-column">{query || priorityFilter !== 'all' ? 'No matching tasks' : 'Nothing here just yet'}{!query && priorityFilter === 'all' && <span>Drop a task here to keep things moving.</span>}</div>}
              <button className="add-task-inline" onClick={() => setModal({ status: column.id })}><Plus size={14} />Add a task</button>
            </div>
          </div>;
        })}</section>}
        {view !== 'overview' && view !== 'calendar' && view !== 'help' && view !== 'settings' && <footer className="board-footer"><span><Sparkles size={13} /> Small steps make big things happen.</span><span>{visibleTasks.length} tasks <i>·</i> {visibleTasks.filter((task) => task.status === 'done').length} completed</span></footer>}
      </div>
    </main>
    {modal && <TaskModal task={modal.id ? modal : null} initialStatus={modal.status} members={members} projects={projects} defaultProject={modal.project} onClose={() => setModal(null)} onSave={saveTask} busy={busy} />}
    {modal?.id && isAdmin && <button className="delete-task-btn" onClick={deleteTask}><X size={14} />Delete task</button>}
    {projectModal && <ProjectModal onClose={() => setProjectModal(false)} onCreate={createProject} busy={busy} />}
    {notice && <div className="toast-error">{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
  </div>;
}

export default App;
