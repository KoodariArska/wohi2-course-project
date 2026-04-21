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
  };
}

// GET /api/questions
// List all questions / ones with certain keyword
router.get("/", async (req, res) => {
    const { keyword } = req.query;

    const where = keyword
        ? { keywords: { some: { name: keyword } } }
        : {};

    const questions = await prisma.question.findMany({
        where,
        include: { keywords: true },
        orderBy: { id: "asc" },
    });

    res.json(questions.map(formatQuestion));
});


// GET /api/questions/:qId
// Show a specific question
router.get("/:qId", async (req, res) => {
    const qId = Number(req.params.qId);
    const question = await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true },
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
        include: { keywords: true },
    });
    res.json(formatQuestion(updatedQuestion));
});


// DELETE /api/questions/:qId
// Delete a question
router.delete("/:qId", isOwner, async (req, res) => {
    const qId = Number(req.params.qId);

    const question = await prisma.question.findUnique({
        where: { id: qId },
        include: { keywords: true },
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


module.exports = router;
