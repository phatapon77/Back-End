const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 1. เชื่อมต่อ Database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// เช็คการเชื่อมต่อ
db.getConnection()
    .then(conn => {
        console.log('✅ Database Connected Successfully!');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Database Connection Failed:', err);
    });

// Middleware เช็ค Token
const isAuth = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) return res.status(401).json({ message: 'Not authenticated.' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authenticated.' });
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decodedToken.userId;
        next();
    } catch (err) {
        return res.status(500).json({ message: 'Token invalid' });
    }
};

// ================= ROUTES =================

// 1. Register (สมัครสมาชิก)
app.post('/auth/register', async (req, res) => {
    const { username, password, fullname, address, phone, email } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        // บันทึกลงตารางจริง tbl_customers
        await db.execute(
            'INSERT INTO tbl_customers (username, password, fullname, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, fullname, address, phone, email]
        );
        res.status(201).json({ message: 'User registered!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Register failed', error: err.message });
    }
});

// 2. Login (เข้าสู่ระบบ)
app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // เช็คจากตารางจริง tbl_customers
        const [rows] = await db.execute('SELECT * FROM tbl_customers WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ message: 'User not found' });

        const user = rows[0];
        const isEqual = await bcrypt.compare(password, user.password);
        if (!isEqual) return res.status(401).json({ message: 'Wrong password' });

        const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token: token, userId: user.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed', error: err.message });
    }
});

// 3. Get Customers (ดูลูกค้า)
app.get('/customers', isAuth, async (req, res) => {
    try {
        // ดึงข้อมูลจาก View (v_customers) ตามรูปที่คุณส่งมา
        const [customers] = await db.execute('SELECT * FROM v_customers'); 
        res.status(200).json(customers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching customers' });
    }
});

// 4. Get Menus (ดูเมนู)
app.get('/menus', async (req, res) => {
    try {
        // ดึงข้อมูลจาก View (v_menus)
        const [menus] = await db.execute('SELECT * FROM v_menus');
        res.status(200).json(menus);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching menus' });
    }
});

// 5. Order (สั่งอาหาร)
app.post('/orders', isAuth, async (req, res) => {
    const { restaurant_id, menu_id, quantity } = req.body;
    const customer_id = req.userId;
    try {
        // เช็คราคาจากเมนู
        const [menuRows] = await db.execute('SELECT price FROM tbl_menus WHERE id = ?', [menu_id]);
        if (menuRows.length === 0) return res.status(404).json({ message: 'Menu not found' });

        const price = parseFloat(menuRows[0].price);
        const total_price = price * quantity;

        // บันทึกลงตารางจริง tbl_orders
        await db.execute(
            'INSERT INTO tbl_orders (customer_id, restaurant_id, menu_id, quantity, total_amount, order_status) VALUES (?, ?, ?, ?, ?, ?)',
            [customer_id, restaurant_id, menu_id, quantity, total_price, 'Pending']
        );
        res.status(201).json({ message: 'Order placed!', total_amount: total_price });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Order failed', error: err.message });
    }
});

// 6. Summary (ดูยอดรวม)
app.get('/orders/summary', isAuth, async (req, res) => {
    const customer_id = req.userId;
    try {
        // ดึงประวัติจาก View (v_orders)
        const [results] = await db.execute('SELECT * FROM v_orders WHERE customer_id = ?', [customer_id]);
        res.status(200).json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching summary' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});