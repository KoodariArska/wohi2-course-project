const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const multer = require("multer");
const path = require('path');

// Apply authentication to ALL routes in this router
router.use(authenticate);

const storage = multer.diskStorage({
    destination: path.join(__dirname, "..", "..", "public", "uploads"),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError ||
        err?.message === "Only image files are allowed") {
        return res.status(400).json({ msg: err.message });
    }
    next(err);
});

function formatQuestion(question) {
    return {
        ...question,
        keywords: question.keywords.map((k) => k.name),
        userName: question.user ? question.user.name : null,
        likeCount: question._count?.likes ?? 0,
        liked: question.likes ? question.likes.length > 0 : false,
        solved: question.attempts ? question.attempts.length > 0 && question.attempts[0].correct : false,
        user: undefined,
        _count: undefined,
        likes: undefined,
        attempts: undefined,
    };
};

function parseKeywords(keywords) {
  if (Array.isArray(keywords)) return keywords;
  if (typeof keywords === "string") {
    return keywords.split(",").map((k) => k.trim()).filter(Boolean);
  }
  return [];
}

// GET /api/questions, with optional ?keyword=business, pagination with ?page=1&limit=5
// List all questions / ones with certain keyword
router.get("/", async (req, res) => {
    const { keyword } = req.query;

    const where = keyword ? 
    { keywords: { some: { name: keyword } } } : {};
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
    const skip = (page - 1) * limit;

    const [filteredQuestions, total] = await Promise.all([prisma.question.findMany({
        where,
        include: { 
            keywords: true, 
            user: true, 
            attempts: {where: { userId: req.user.userId }, take: 1 },
            likes: {where: { userId: req.user.userId }, take: 1 },
            _count: { select: { likes: true } }
        },
        orderBy: { id: "asc" },
        skip,
        take: limit
    }), prisma.question.count({ where })]);

    res.json({
        data: filteredQuestions.map(formatQuestion),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    })
});


// GET /api/questions/:qId
// Show a specific question
router.get("/:qId", async (req, res) => {
    const qId = Number(req.params.qId);
    const question = await prisma.question.findUnique({
        where: { id: qId },
        include: { 
            keywords: true, 
            user: true,
            attempts: {where: { userId: req.user.userId }, take: 1 },
            likes: {where: { userId: req.user.userId }, take: 1 },
            _count: { select: { likes: true } }
        },
    });

    if (!question) {
        return res.status(404).json({ 
            message: "Question not found" 
        });
    }

    res.json(formatQuestion(question));
});


// POST /api/questions
// Create a new question
router.post("/", upload.single("image"), async (req, res) => {
    const { title, answer, keywords } = req.body;

    if (!title || !answer) {
        return res.status(400).json({ msg: 
        "Question and answer are mandatory" });
    }

    const keywordsArray = parseKeywords(keywords);
    const imageURL = req.file ? `/uploads/${req.file.filename}` : null;
    const newQuestion = await prisma.question.create({
        data: {
        title, answer, imageURL,
        userId: req.user.userId,
        keywords: {
            connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw }, create: { name: kw },
            })), },
        },
        include: { keywords: true },
    });

    res.status(201).json(formatQuestion(newQuestion));
});


// PUT /api/questions/:qId
// Edit a question
router.put("/:qId", upload.single("image"), isOwner, async (req, res) => {
    const qId = Number(req.params.qId);
    const { title, answer, keywords } = req.body;
    const existingQuestion = await prisma.question.findUnique({ where: { id: qId } });
    if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
    }

    if (!title || !answer) {
        return res.status(400).json({ msg: "Question and answer are mandatory" });
    }

    const imageURL = req.file ? `/uploads/${req.file.filename}` : null;
    const keywordsArray = parseKeywords(keywords);
    const updatedQuestion = await prisma.question.update({
        where: { id: qId },
        data: {
        title, answer, imageURL,
        keywords: {
            set: [],
            connectOrCreate: keywordsArray.map((kw) => ({
            where: { name: kw },
            create: { name: kw },
            })),
        },
        },
        include: { keywords: true, user: true },
    });
    res.json(formatQuestion(updatedQuestion));
});


// DELETE /api/questions/:qId
// Delete a question
router.delete("/:qId", isOwner, async (req, res) => {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true, user: true },
    });

    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    await prisma.attempt.deleteMany({ where: { qId } });
    await prisma.question.delete({ where: { id: qId } });

    res.json({
        message: "Question deleted successfully",
        question: formatQuestion(question),
    });
});


// POST /api/questions/:qId/like
// Like a question (idempotent)
router.post("/:qId/like", async (req, res) => {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({ where: { id: qId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const like = await prisma.like.upsert({
        where: { userId_qId: { userId: req.user.userId, qId } },
        update: {},
        create: { userId: req.user.userId, qId },
    });

    const likeCount = await prisma.like.count({ where: { qId } });

    res.status(201).json({
        id: like.id,
        qId,
        liked: true,
        likeCount,
        createdAt: like.createdAt,
    });
});


// DELETE /api/questions/:qId/like
// Delete a like (idempotent)
router.delete("/:qId/like", async (req, res) => {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({ where: { id: qId } });
    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const like = await prisma.like.deleteMany({
        where: { userId: req.user.userId, qId }
    });

    const likeCount = await prisma.like.count({ where: { qId } });

    res.json({
        qId,
        liked: false,
        likeCount,
    });
});


// POST /api/questions/:qId/play
// solve a question
router.post("/:qId/play", async (req, res) => {
    const qId = Number(req.params.qId);
    const { answer } = req.body;

    const question = await prisma.question.findUnique({ where: { id: qId } });

    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    const isCorrect = question.answer.trim().toLowerCase() === answer.trim().toLowerCase();

    const attempt = await prisma.attempt.upsert({
        where: { userId_qId: { userId: req.user.userId, qId } },
        update: {
            correct: isCorrect,
            submittedAnswer: answer,
            createdAt: new Date()
        },
        create: {
            userId: req.user.userId, 
            qId, 
            correct: isCorrect,
            submittedAnswer: answer
        },
    });
    
    res.status(201).json({
        id: attempt.id,
        correct: attempt.correct,
        submittedAnswer: answer,
        correctAnswer: question.answer,
        createdAt: attempt.createdAt
    });
});


module.exports = router;
