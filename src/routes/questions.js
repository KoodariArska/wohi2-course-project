const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");
const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

// Apply authentication to ALL routes in this router
router.use(authenticate);

function formatQuestion(question) {
  return {
    ...question,
    keywords: question.keywords.map((k) => k.name),
    userName: question.user ? question.user.name : null,
    likeCount: question._count?.likes ?? 0,
    liked: question.likes ? question.likes.length > 0 : false,
    user: undefined,
    _count: undefined,
    likes: undefined
  };
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
router.post("/", async (req, res) => {
    const { title, answer, keywords } = req.body;

    if (!title || !answer) {
        return res.status(400).json({ msg: 
        "title and answer are mandatory" });
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];

    const newQuestion = await prisma.question.create({
        data: {
        title, answer,
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
router.put("/:qId", isOwner, async (req, res) => {
    const qId = Number(req.params.qId);
    const { title, answer, keywords } = req.body;
    const existingQuestion = await prisma.question.findUnique({ where: { id: qId } });
    if (!existingQuestion) {
        return res.status(404).json({ message: "Question not found" });
    }

    if (!title || !answer) {
        return res.status(400).json({ msg: "title and answer are mandatory" });
    }

    const keywordsArray = Array.isArray(keywords) ? keywords : [];
    const updatedQuestion = await prisma.question.update({
        where: { id: qId },
        data: {
        title, answer,
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


module.exports = router;
