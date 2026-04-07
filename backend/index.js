import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'data');
const dbPath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(dataPath, 'db.sqlite');

if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

const db = await open({ filename: dbPath, driver: sqlite3.Database });
await db.exec('PRAGMA foreign_keys = ON;');

console.log(`Using SQLite at ${dbPath}`);

async function tableColumns(tableName) {
    const rows = await db.all(`PRAGMA table_info(${tableName})`);
    return new Set(rows.map((row) => row.name));
}

async function tableExists(tableName) {
    const row = await db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [tableName]);
    return Boolean(row);
}

async function ensureSchema() {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 120,
        role TEXT NOT NULL DEFAULT 'Novice learner'
    );

    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        title TEXT NOT NULL,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        answers INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS answer_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        answer_id INTEGER NOT NULL,
        UNIQUE(user_id, answer_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        UNIQUE(user_id, question_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
    `);

    const initialQuestionCols = await tableColumns('questions');
    if (initialQuestionCols.has('userId') || initialQuestionCols.has('createdAt') || initialQuestionCols.has('questionId')) {
        // Legacy schema from older app versions can keep incompatible NOT NULL constraints.
        // Recreate content tables with the canonical snake_case schema.
        await db.exec(`
        DROP TABLE IF EXISTS bookmarks;
        DROP TABLE IF EXISTS answers;
        DROP TABLE IF EXISTS questions;

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subject TEXT NOT NULL,
            title TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL,
            likes INTEGER NOT NULL DEFAULT 0,
            answers INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL,
            likes INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS answer_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            answer_id INTEGER NOT NULL,
            UNIQUE(user_id, answer_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            UNIQUE(user_id, question_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
        );
        `);
    }

    const usersCols = await tableColumns('users');
    if (!usersCols.has('password')) {
        await db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''");
    }
    if (!usersCols.has('points')) {
        await db.exec('ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 120');
    }
    if (!usersCols.has('role')) {
        await db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'Novice learner'");
    }

    const questionsCols = await tableColumns('questions');
    if (!questionsCols.has('user_id')) {
        await db.exec('ALTER TABLE questions ADD COLUMN user_id INTEGER');
        if (questionsCols.has('userId')) {
            await db.exec('UPDATE questions SET user_id = userId WHERE user_id IS NULL');
        }
    }
    if (!questionsCols.has('subject')) {
        await db.exec("ALTER TABLE questions ADD COLUMN subject TEXT NOT NULL DEFAULT 'General'");
    }
    if (!questionsCols.has('created_at')) {
        await db.exec("ALTER TABLE questions ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
        await db.exec("UPDATE questions SET created_at = datetime('now') WHERE created_at = '' OR created_at IS NULL");
    }
    if (!questionsCols.has('likes')) {
        await db.exec('ALTER TABLE questions ADD COLUMN likes INTEGER NOT NULL DEFAULT 0');
    }
    if (!questionsCols.has('answers')) {
        await db.exec('ALTER TABLE questions ADD COLUMN answers INTEGER NOT NULL DEFAULT 0');
    }

    if (await tableExists('answers')) {
        const answersCols = await tableColumns('answers');
        if (!answersCols.has('question_id')) {
            await db.exec('ALTER TABLE answers ADD COLUMN question_id INTEGER');
            if (answersCols.has('questionId')) {
                await db.exec('UPDATE answers SET question_id = questionId WHERE question_id IS NULL');
            }
        }
        if (!answersCols.has('user_id')) {
            await db.exec('ALTER TABLE answers ADD COLUMN user_id INTEGER');
            if (answersCols.has('userId')) {
                await db.exec('UPDATE answers SET user_id = userId WHERE user_id IS NULL');
            }
        }
        if (!answersCols.has('created_at')) {
            await db.exec("ALTER TABLE answers ADD COLUMN created_at TEXT NOT NULL DEFAULT ''");
            await db.exec("UPDATE answers SET created_at = datetime('now') WHERE created_at = '' OR created_at IS NULL");
        }
        if (!answersCols.has('likes')) {
            await db.exec('ALTER TABLE answers ADD COLUMN likes INTEGER NOT NULL DEFAULT 0');
        }
    }

    if (await tableExists('bookmarks')) {
        const bookmarksCols = await tableColumns('bookmarks');
        if (!bookmarksCols.has('question_id')) {
            await db.exec('ALTER TABLE bookmarks ADD COLUMN question_id INTEGER');
            if (bookmarksCols.has('questionId')) {
                await db.exec('UPDATE bookmarks SET question_id = questionId WHERE question_id IS NULL');
            }
        }
        if (!bookmarksCols.has('user_id')) {
            await db.exec('ALTER TABLE bookmarks ADD COLUMN user_id INTEGER');
            if (bookmarksCols.has('userId')) {
                await db.exec('UPDATE bookmarks SET user_id = userId WHERE user_id IS NULL');
            }
        }
    }

    await db.exec(`
    CREATE TABLE IF NOT EXISTS answer_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        answer_id INTEGER NOT NULL,
        UNIQUE(user_id, answer_id),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(answer_id) REFERENCES answers(id) ON DELETE CASCADE
    );
    `);
}

await ensureSchema();

const app = express();
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
    })
);
app.use(express.json());

function sanitizeUser(user) {
    if (!user) return null;
    const { password, ...rest } = user;
    return rest;
}

async function requireUser(req, res, next) {
    const userId = Number(req.header('x-user-id'));
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

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.type('html').send('<h1>DoubtHub backend is running</h1><p>Use /api/health to verify API status.</p>');
});

app.post('/api/auth/signup', async(req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
    }

    const result = await db.run(
        'INSERT INTO users (name, email, password, points, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, password, 120, 'Novice learner']
    );

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
    const userId = Number(req.header('x-user-id')) || null;
    const questions = await db.all(
        `SELECT q.id, q.user_id AS userId, q.subject, q.title, q.details, q.created_at AS createdAt, q.likes, q.answers, 'Anonymous' AS author
         FROM questions q
         JOIN users u ON q.user_id = u.id
         ORDER BY q.created_at DESC`
    );

    if (!userId) {
        return res.json({ questions });
    }

    const bookmarks = await db.all('SELECT question_id AS questionId FROM bookmarks WHERE user_id = ?', [userId]);
    const bookmarkSet = new Set(bookmarks.map((row) => row.questionId));
    res.json({
        questions: questions.map((question) => ({
            ...question,
            bookmarked: bookmarkSet.has(question.id),
        })),
    });
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
        'INSERT INTO questions (user_id, subject, title, details, created_at, likes, answers) VALUES (?, ?, ?, ?, ?, 0, 0)',
        [req.user.id, subject, title, details, createdAt]
    );

    await db.run('UPDATE users SET points = points + 5 WHERE id = ?', [req.user.id]);

    const question = await db.get(
        `SELECT q.id, q.user_id AS userId, q.subject, q.title, q.details, q.created_at AS createdAt, q.likes, q.answers, 'Anonymous' AS author
         FROM questions q
         JOIN users u ON q.user_id = u.id
         WHERE q.id = ?`,
        [result.lastID]
    );
    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);

    res.json({ question, user: sanitizeUser(updatedUser) });
});

app.put('/api/questions/:id', requireUser, async(req, res) => {
    const { id } = req.params;
    const { subject, title, details } = req.body;
    if (!subject || !title || !details) {
        return res.status(400).json({ error: 'Subject, title and details are required' });
    }

    const question = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!question) {
        return res.status(404).json({ error: 'Question not found' });
    }
    if (question.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can edit only your own question' });
    }

    await db.run('UPDATE questions SET subject = ?, title = ?, details = ? WHERE id = ?', [subject, title, details, id]);
    const updatedQuestion = await db.get(
        `SELECT q.id, q.user_id AS userId, q.subject, q.title, q.details, q.created_at AS createdAt, q.likes, q.answers, 'Anonymous' AS author
         FROM questions q
         JOIN users u ON q.user_id = u.id
         WHERE q.id = ?`,
        [id]
    );
    res.json({ question: updatedQuestion });
});

app.delete('/api/questions/:id', requireUser, async(req, res) => {
    const { id } = req.params;
    const question = await db.get('SELECT * FROM questions WHERE id = ?', [id]);
    if (!question) {
        return res.status(404).json({ error: 'Question not found' });
    }
    if (question.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can delete only your own question' });
    }

    await db.run('DELETE FROM questions WHERE id = ?', [id]);
    res.json({ ok: true });
});

app.get('/api/questions/:id/answers', async(req, res) => {
    const { id } = req.params;
    const userId = Number(req.header('x-user-id')) || null;
    const answers = await db.all(
        `SELECT a.id,
                a.user_id AS userId,
                a.text,
                a.created_at AS createdAt,
                a.likes,
                'Anonymous' AS author,
                CASE
                    WHEN ? IS NULL THEN 0
                    ELSE EXISTS(
                        SELECT 1
                        FROM answer_likes al
                        WHERE al.answer_id = a.id AND al.user_id = ?
                    )
                END AS likedByUser
         FROM answers a
         JOIN users u ON a.user_id = u.id
         WHERE a.question_id = ?
         ORDER BY a.created_at DESC`,
        [userId, userId, id]
    );
    res.json({ answers });
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
        'INSERT INTO answers (question_id, user_id, text, created_at) VALUES (?, ?, ?, ?)',
        [id, req.user.id, text, createdAt]
    );
    await db.run('UPDATE questions SET answers = answers + 1 WHERE id = ?', [id]);
    await db.run('UPDATE users SET points = points + 10 WHERE id = ?', [req.user.id]);

    const answer = await db.get(
        'SELECT id, question_id AS questionId, user_id AS userId, text, created_at AS createdAt, likes FROM answers WHERE id = ?',
        [result.lastID]
    );
    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({ answer: { ...answer, author: 'Anonymous', likedByUser: false }, user: sanitizeUser(updatedUser) });
});

app.put('/api/answers/:id', requireUser, async(req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Answer text is required' });
    }

    const answer = await db.get('SELECT * FROM answers WHERE id = ?', [id]);
    if (!answer) {
        return res.status(404).json({ error: 'Answer not found' });
    }
    if (answer.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can edit only your own answer' });
    }

    await db.run('UPDATE answers SET text = ? WHERE id = ?', [text, id]);
    const updated = await db.get(
        'SELECT id, question_id AS questionId, user_id AS userId, text, created_at AS createdAt, likes FROM answers WHERE id = ?',
        [id]
    );
    const likedRow = await db.get('SELECT id FROM answer_likes WHERE user_id = ? AND answer_id = ?', [req.user.id, id]);
    res.json({ answer: { ...updated, author: 'Anonymous', likedByUser: Boolean(likedRow) } });
});

app.post('/api/answers/:id/like', requireUser, async(req, res) => {
    const { id } = req.params;
    const answer = await db.get('SELECT * FROM answers WHERE id = ?', [id]);
    if (!answer) {
        return res.status(404).json({ error: 'Answer not found' });
    }

    const result = await db.run('INSERT OR IGNORE INTO answer_likes (user_id, answer_id) VALUES (?, ?)', [req.user.id, id]);
    if (result.changes > 0) {
        await db.run('UPDATE answers SET likes = likes + 1 WHERE id = ?', [id]);
    }

    const updated = await db.get('SELECT id, question_id AS questionId, likes FROM answers WHERE id = ?', [id]);
    res.json({ ok: true, answer: { ...updated, likedByUser: true } });
});

app.delete('/api/answers/:id/like', requireUser, async(req, res) => {
    const { id } = req.params;
    const answer = await db.get('SELECT * FROM answers WHERE id = ?', [id]);
    if (!answer) {
        return res.status(404).json({ error: 'Answer not found' });
    }

    const result = await db.run('DELETE FROM answer_likes WHERE user_id = ? AND answer_id = ?', [req.user.id, id]);
    if (result.changes > 0) {
        await db.run('UPDATE answers SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = ?', [id]);
    }

    const updated = await db.get('SELECT id, question_id AS questionId, likes FROM answers WHERE id = ?', [id]);
    res.json({ ok: true, answer: { ...updated, likedByUser: false } });
});

app.delete('/api/answers/:id', requireUser, async(req, res) => {
    const { id } = req.params;
    const answer = await db.get('SELECT * FROM answers WHERE id = ?', [id]);
    if (!answer) {
        return res.status(404).json({ error: 'Answer not found' });
    }
    if (answer.user_id !== req.user.id) {
        return res.status(403).json({ error: 'You can delete only your own answer' });
    }

    await db.run('DELETE FROM answers WHERE id = ?', [id]);
    await db.run('UPDATE questions SET answers = CASE WHEN answers > 0 THEN answers - 1 ELSE 0 END WHERE id = ?', [answer.question_id]);
    res.json({ ok: true, questionId: answer.question_id });
});

app.get('/api/bookmarks', requireUser, async(req, res) => {
    const bookmarks = await db.all(
        `SELECT q.id, q.user_id AS userId, q.subject, q.title, q.details, q.created_at AS createdAt, q.likes, q.answers, 'Anonymous' AS author
         FROM bookmarks b
         JOIN questions q ON b.question_id = q.id
         JOIN users u ON q.user_id = u.id
         WHERE b.user_id = ?
         ORDER BY q.created_at DESC`,
        [req.user.id]
    );
    res.json({ bookmarks });
});

app.post('/api/bookmarks', requireUser, async(req, res) => {
    const { questionId } = req.body;
    if (!questionId) {
        return res.status(400).json({ error: 'Question ID required' });
    }

    await db.run('INSERT OR IGNORE INTO bookmarks (user_id, question_id) VALUES (?, ?)', [req.user.id, questionId]);
    res.json({ ok: true });
});

app.delete('/api/bookmarks/:questionId', requireUser, async(req, res) => {
    const { questionId } = req.params;
    await db.run('DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?', [req.user.id, questionId]);
    res.json({ ok: true });
});

app.get('/api/leaderboard', async(req, res) => {
    const leaderboard = await db.all('SELECT id, name, points, role FROM users ORDER BY points DESC LIMIT 10');
    res.json({ leaderboard });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`DoubtHub backend running on http://localhost:${PORT}`);
});
