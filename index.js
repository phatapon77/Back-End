require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const verifyToken = require('./middleware/auth'); // ✅ ตรวจสอบ middleware

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// DB Pool
// =====================
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT), // ต้องเป็นตัวเลข
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// =====================
// Secret Key JWT
// =====================
const SECRET_KEY = process.env.JWT_SECRET;

// =====================
// Route หลัก
// =====================
app.get('/', (req, res) => {
  res.send('🚀 API Server is running! Welcome to Node.js + MySQL + JWT backend.');
});

// =====================
// Test DB
// =====================
app.get('/ping', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    res.json({ status: 'ok', time: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// =====================
// LOGIN
// =====================
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM tbl_users WHERE username = ?', [username]);
    if (rows.length === 0)
      return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: 'Invalid password' });

    const token = jwt.sign(
      {
        id: user.id,
        firstname: user.firstname,
        fullname: user.fullname,
        lastname: user.lastname,
        username: user.username,
      },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// =====================
// CRUD Users
// =====================

// GET all users
app.get('/users', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, firstname, fullname, lastname, username, status FROM tbl_users');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET user by id
app.get('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id, firstname, fullname, lastname, username, status FROM tbl_users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// POST new user
app.post('/users', async (req, res) => {
  const { firstname, fullname, lastname, username, password, status } = req.body;

  try {
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO tbl_users (firstname, fullname, lastname, username, password, status) VALUES (?, ?, ?, ?, ?, ?)',
      [firstname, fullname, lastname, username, hashedPassword, status]
    );

    res.json({ id: result.insertId, firstname, fullname, lastname, username, status });
  } catch (err) {
    console.error('❌ Insert Error:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// PUT update user
app.put('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { firstname, fullname, lastname, username, password, status } = req.body;

  try {
    let query = 'UPDATE tbl_users SET firstname = ?, fullname = ?, lastname = ?, username = ?, status = ?';
    const params = [firstname, fullname, lastname, username, status];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(query, params);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('❌ Update Error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE user
app.delete('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM tbl_users WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('❌ Delete Error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// =====================
// Start Server
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
