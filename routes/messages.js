const express = require("express");
const router = express.Router();
const Message = require("../schemas/messages");
const User = require("../schemas/users");
const { checkLogin } = require("../utils/authHandler.js.js");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1_000_000_000) + ext);
    }
});
const upload = multer({ storage });

// GET / - lấy message cuối cùng của mỗi cuộc trò chuyện
router.get("/", checkLogin, async (req, res) => {
    const userId = req.userId;
    const messages = await Message.find({
        $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: -1 });

    const seen = new Set();
    const result = [];
    for (const msg of messages) {
        const partnerId = msg.from.toString() === userId ? msg.to.toString() : msg.from.toString();
        if (!seen.has(partnerId)) {
            seen.add(partnerId);
            result.push(msg);
        }
    }
    res.json(result);
});

// GET /:userID - lấy toàn bộ tin nhắn giữa user hiện tại và userID
router.get("/:userID", checkLogin, async (req, res) => {
    const userId = req.userId;
    const { userID } = req.params;
    const messages = await Message.find({
        $or: [
            { from: userId, to: userID },
            { from: userID, to: userId }
        ]
    }).sort({ createdAt: 1 });
    res.json(messages);
});

// POST / - gửi tin nhắn (text hoặc file)
router.post("/", checkLogin, upload.single("file"), async (req, res) => {
    const { to, text } = req.body;
    if (!mongoose.Types.ObjectId.isValid(to)) {
        return res.status(400).json({ message: "to không hợp lệ" });
    }
    const toUser = await User.findById(to);
    if (!toUser) {
        return res.status(404).json({ message: "người nhận không tồn tại" });
    }
    let messageContent;
    if (req.file) {
        messageContent = { type: "file", text: req.file.path };
    } else {
        messageContent = { type: "text", text };
    }
    const message = await Message.create({ from: req.userId, to, messageContent });
    res.status(201).json(message);
});

module.exports = router;
