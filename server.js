require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { engine } = require('express-handlebars');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Cấu hình View Engine Handlebars
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');

// Xử lý biến môi trường và thuật toán (MSSV: 23IT089)
const MSSV = process.env.MSSV; 
const FULLNAME = process.env.FULLNAME;
const last3MSSV = MSSV.slice(-3); 
const VAT_RATE = parseInt(MSSV.slice(-1)) + 4; 

// 1. Kiến trúc Stateless Session lưu trực tiếp xuống MongoDB Atlas
app.use(session({
    secret: 'cloud-session-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URI_SESSION 
    })
}));

// 2. Kết nối đa luồng (Read và Write độc lập)
const readConn = mongoose.createConnection(process.env.MONGO_URI_READ);
const writeConn = mongoose.createConnection(process.env.MONGO_URI_WRITE);

const bookSchema = new mongoose.Schema({
    maSP: String,
    tenSach: String,
    giaGoc: Number,
    giaSauThue: Number
});

const BookRead = readConn.model('Book', bookSchema);
const BookWrite = writeConn.model('Book', bookSchema);

// Route Luồng Đọc: Xem danh sách & đếm lượt truy cập (kiểm tra session)
app.get('/', async (req, res) => {
    req.session.views = (req.session.views || 0) + 1;
    const books = await BookRead.find().lean();
    res.render('home', { 
        books, 
        FULLNAME, 
        MSSV, 
        VAT_RATE, 
        views: req.session.views 
    });
});

// Route Luồng Ghi: Thêm sách mới
app.post('/add', async (req, res) => {
    const { maSP, tenSach, giaGoc } = req.body;

    if (!maSP.startsWith(last3MSSV)) {
        return res.status(400).send(`Lỗi: Mã sản phẩm bắt buộc phải có tiền tố ${last3MSSV}`);
    }

    const giaSauThue = parseFloat(giaGoc) * (1 + VAT_RATE / 100);

    const newBook = new BookWrite({ maSP, tenSach, giaGoc, giaSauThue });
    await newBook.save();
    
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));