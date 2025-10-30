require('dotenv').config(); // โหลดค่าจาก .env

const express = require('express');
const mysql = require('mysql2/promise');
const app = express();

app.use(express.json());

// ใช้ค่าจาก .env
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Route ทดสอบการเชื่อมต่อ
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users3');
    res.json(rows);
  } catch (err) {
    console.error('Query failed:', err); // 👈 ตรงนี้สำคัญ
    res.status(500).json({ error: 'Query failed' });
  }
});


// ✅ แก้ชื่อ table ให้เหมือนกันทุกส่วน (ใช้ tbl_users3)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users3');
    res.json(rows);
  } catch (err) {
    console.error('Query failed:', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET /users/:id - ดึงข้อมูลผู้ใช้ตาม id
app.get('/users/:id', async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM tbl_users3 WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Get user by ID failed:', err);
    next(err);
  }
});

// POST /users - เพิ่มผู้ใช้ใหม่
app.post('/users', async (req, res) => {
  const { fristname, fullname, lastname, username, password, status } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO tbl_users3 (fristname, fullname, lastname, username, password, status) VALUES (?, ?, ?, ?, ?, ?)',
      [fristname, fullname, lastname, username, password, status]
    );
    res.json({ id: result.insertId, fristname, fullname, lastname, username, status });
  } catch (err) {
    console.error('Insert failed:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// PUT /users/:id - แก้ไขข้อมูลผู้ใช้
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { fristname, fullname, lastname } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE tbl_users3 SET fristname = ?, fullname = ?, lastname = ? WHERE id = ?',
      [fristname, fullname, lastname, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update failed:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /users/:id - ลบผู้ใช้
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM tbl_users3 WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
