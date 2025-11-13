// server.js
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt'); //เพิ่ม bcrypt
const jwt = require('jsonwebtoken'); // สำหรับสร้าง token
const verifyToken = require('./middleware/auth'); // middleware ตรวจสอบ token (เราจะสร้างไฟล์นี้)
const SECRET_KEY = process.env.JWT_SECRET; // อ่านค่า secret จาก .env

const app = express();

app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ทดสอบ DB
app.get('/ping', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    res.json({ status: 'ok', time: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET users (protected)
app.get('/users', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, firstname, fullname, lastname FROM tbl_users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET user by id (protected)
app.get('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT id, firstname, fullname, lastname FROM tbl_users WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});


//POST: เพิ่มผู้ใช้ใหม่ พร้อม hash password
app.post('/users', async (req, res) => {
  const { firstname, fullname, lastname, password } = req.body;

  try {
    if (!password) return res.status(400).json({ error: 'Password is required' });

    // เข้ารหัส password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO tbl_users (firstname, fullname, lastname, password) VALUES (?, ?, ?, ?)',
      [firstname, fullname, lastname, hashedPassword]
    );

    res.json({ id: result.insertId, firstname, fullname, lastname });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// PUT: อัปเดตข้อมูลผู้ใช้ + เปลี่ยนรหัสผ่านถ้ามีส่งมา
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { firstname, fullname, lastname, password } = req.body;

  try {
    let query = 'UPDATE tbl_users SET firstname = ?, fullname = ?, lastname = ?';
    const params = [firstname, fullname, lastname];

    // ถ้ามี password ใหม่ให้ hash แล้วอัปเดตด้วย
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE user
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM tbl_users WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});
// POST: เข้าสู่ระบบ (Login)
app.post('/login', async (req, res) => {
  const { username, password } = req.body; // ใช้ fullname เป็น username ก็ได้ ถ้าชื่อใน DB คือ fullname

  try {
    const [rows] = await db.query('SELECT * FROM tbl_users WHERE fullname = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid password' });

    // สร้าง JWT token
    const token = jwt.sign(
      { id: user.id, fullname: user.fullname, lastname: user.lastname },
      SECRET_KEY,
      { expiresIn: '1h' } // อายุ token 1 ชั่วโมง
    );

    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));