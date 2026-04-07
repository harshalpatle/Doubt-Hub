import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.join(__dirname, 'data');
const dbPath = path.join(dataPath, 'db.sqlite');

if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const db = await open({ filename: dbPath, driver: sqlite3.Database });
await db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  points INTEGER NOT NULL,
  role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  details TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  answers INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  questionId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(questionId) REFERENCES questions(id),
  FOREIGN KEY(userId) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  questionId INTEGER NOT NULL,
  UNIQUE(userId, questionId),
  FOREIGN KEY(userId) REFERENCES users(id),
  FOREIGN KEY(questionId) REFERENCES questions(id)
);
`);

function sanitizeUser(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
}

async function requireUser(req, res, next) {
    const userId = req.header('x-user-id');
    if (!userId) {
        return res.status(401).json({ error: 'Missing user header' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
        return res.status(401).json({ error: 'Invalid user' });
    }

    req.user = user;
    next();
}

app.post('/api/auth/signup', async(req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const role = 'Novice learner';
    const points = 120;
    const result = await db.run('INSERT INTO users (name, email, password, points, role) VALUES (?, ?, ?, ?, ?)', [name, email, password, points, role]);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/login', async(req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ user: sanitizeUser(user) });
});

app.get('/api/users/me', requireUser, async(req, res) => {
    res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/questions', async(req, res) => {
    const userId = req.header('x-user-id');
    const questions = await db.all(
        `SELECT q.id, q.subject, q.title, q.details, q.createdAt, q.likes, q.answers, u.name AS author
     FROM questions q
     JOIN users u ON q.userId = u.id
     ORDER BY q.createdAt DESC`
    );

    if (userId) {
        const bookmarks = await db.all('SELECT questionId FROM bookmarks WHERE userId = ?', [userId]);
        const bookmarkSet = new Set(bookmarks.map((row) => row.questionId));
        const questionsWithBookmark = questions.map((question) => ({
            ...question,
            bookmarked: bookmarkSet.has(question.id),
        }));
        return res.json({ questions: questionsWithBookmark });
    }

    res.json({ questions });
});

app.get('/api/categories', async(req, res) => {
    const categories = await db.all('SELECT subject AS name, COUNT(*) AS count FROM questions GROUP BY subject ORDER BY count DESC');
    res.json({ categories });
});

app.post('/api/questions', requireUser, async(req, res) => {
    const { subject, title, details } = req.body;
    if (!subject || !title || !details) {
        return res.status(400).json({ error: 'Subject, title and details are required' });
    }

    const createdAt = new Date().toISOString();
    const result = await db.run(
        'INSERT INTO questions (userId, subject, title, details, createdAt, likes, answers) VALUES (?, ?, ?, ?, ?, 0, 0)', [req.user.id, subject, title, details, createdAt]
    );

    await db.run('UPDATE users SET points = points + 5 WHERE id = ?', [req.user.id]);

    const question = await db.get(
        `SELECT q.id, q.subject, q.title, q.details, q.createdAt, q.likes, q.answers, u.name AS author
     FROM questions q
     JOIN users u ON q.userId = u.id
     WHERE q.id = ?`, [result.lastID]
    );

    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ question, user: sanitizeUser(updatedUser) });
});

app.post('/api/questions/:id/answers', requireUser, async(req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Answer text is required' });
    }

    const question = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!question) {
        return res.status(404).json({ error: 'Question not found' });
    }

    const createdAt = new Date().toISOString();
    const result = await db.run(
        'INSERT INTO answers (questionId, userId, text, createdAt) VALUES (?, ?, ?, ?)', [id, req.user.id, text, createdAt]
    );

    await db.run('UPDATE questions SET answers = answers + 1 WHERE id = ?', [id]);
    await db.run('UPDATE users SET points = points + 10 WHERE id = ?', [req.user.id]);

    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const answer = await db.get('SELECT * FROM answers WHERE id = ?', [result.lastID]);
    res.json({ answer, user: sanitizeUser(updatedUser) });
});

app.get('/api/questions/:id/answers', async(req, res) => {
    const { id } = req.params;
    const answers = await db.all(
        `SELECT a.id, a.text, a.createdAt, u.name AS author
     FROM answers a
     JOIN users u ON a.userId = u.id
     WHERE a.questionId = ?
     ORDER BY a.createdAt DESC`, [id]
    );
    res.json({ answers });
});

app.get('/api/bookmarks', requireUser, async(req, res) => {
    const bookmarks = await db.all(
        `SELECT q.id, q.subject, q.title, q.details, q.createdAt, q.likes, q.answers, u.name AS author
     FROM bookmarks b
     JOIN questions q ON b.questionId = q.id
     JOIN users u ON q.userId = u.id
     WHERE b.userId = ?
     ORDER BY q.createdAt DESC`, [req.user.id]
    );
    res.json({ bookmarks });
});

app.post('/api/bookmarks', requireUser, async(req, res) => {
    const { questionId } = req.body;
    if (!questionId) {
        return res.status(400).json({ error: 'Question ID required' });
    }

    await db.run('INSERT OR IGNORE INTO bookmarks (userId, questionId) VALUES (?, ?)', [req.user.id, questionId]);
    res.json({ ok: true });
});

app.delete('/api/bookmarks/:questionId', requireUser, async(req, res) => {
    const { questionId } = req.params;
    await db.run('DELETE FROM bookmarks WHERE userId = ? AND questionId = ?', [req.user.id, questionId]);
    res.json({ ok: true });
});

app.get('/api/leaderboard', async(req, res) => {
    const leaderboard = await db.all('SELECT id, name, points, role FROM users ORDER BY points DESC LIMIT 10');
    res.json({ leaderboard });
});

app.listen(4000, () => {
    console.log('DoubtHub backend running on http://localhost:4000');
});