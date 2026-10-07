require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');

const app = express();
app.use(express.urlencoded({ extended: true }));

// Cấu hình View Engine
app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');

// Xử lý biến môi trường và thuật toán (MSSV: 23IT089)
const MSSV = process.env.MSSV; 
const FULLNAME = process.env.FULLNAME;
const last3MSSV = MSSV.slice(-3); // Lấy "089"
const VAT_RATE = parseInt(MSSV.slice(-1)) + 4; // 9 + 4 = 13(%)

// 1. Kết nối đa luồng (Read và Write độc lập)
const readConn = mongoose.createConnection(process.env.MONGO_URI_READ);
const writeConn = mongoose.createConnection(process.env.MONGO_URI_WRITE);

const bookSchema = new mongoose.Schema({
    maSP: String,
    tenSach: String,
    giaGoc: Number,
    giaSauThue: Number
});

// Gắn Model vào luồng kết nối tương ứng
const BookRead = readConn.model('Book', bookSchema);
const BookWrite = writeConn.model('Book', bookSchema);

// Route Luồng Đọc: Xem danh sách
app.get('/', async (req, res) => {
    const books = await BookRead.find().lean();
    res.render('home', { books, FULLNAME, MSSV, VAT_RATE });
});

// Route Luồng Ghi: Thêm sách mới
app.post('/add', async (req, res) => {
    const { maSP, tenSach, giaGoc } = req.body;

    // Bộ lọc: Bắt buộc mã SP phải bắt đầu bằng 089
    if (!maSP.startsWith(last3MSSV)) {
        return res.status(400).send(`Lỗi: Mã sản phẩm phải bắt đầu bằng ${last3MSSV}`);
    }

    // Tính thuế động trước khi lưu xuống DB
    const giaSauThue = parseFloat(giaGoc) * (1 + VAT_RATE / 100);

    const newBook = new BookWrite({ maSP, tenSach, giaGoc, giaSauThue });
    await newBook.save();
    
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại cổng ${PORT}`));