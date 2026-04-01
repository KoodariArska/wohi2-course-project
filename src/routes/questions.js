const express = require("express");
const router = express.Router();

const questions = require("../data/questions");

// GET /api/questions
// List all questions / ones with certain keyword
router.get("/", (req, res) => {
    const {keyword} = req.query;
    if(!keyword) {
        return res.json(questions);
    }

    const filteredQuestions = questions.filter(q=>
        q.keywords.includes(keyword)
    );

    res.json(filteredQuestions);
});

// GET /api/questions/:qId
// Show a specific question
router.get("/:qId", (req, res) => {
    const qId = Number(req.params.qId);

    const question = questions.find((q) => q.id === qId);

    if (!question) {
        return res.status(404).json({ message: "Question not found" });
    }

    res.json(question);
});

// POST /api/questions
// Create a new question
router.post("/", (req, res) => {
    const { question, answer, keywords } = req.body;

    if (!question || !answer) {
        return res.status(400).json({
            message: "Question and answer are required"
        });
    }
    const maxId = Math.max(...questions.map(p => p.id), 0);

    const newQuestion = {
        id: questions.length ? maxId + 1 : 1,
        question, answer,
        keywords: Array.isArray(keywords) ? keywords : []
    };
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
});

// PUT /api/questions/:qId
// Edit a question
router.put("/:qId", (req, res) => {
  const qId = Number(req.params.qId);
  const { question, answer, keywords } = req.body;

  const editedQuestion = questions.find((q) => q.id === qId);

  if (!editedQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!question || !answer) {
    return res.json({
      message: "Question and answer are required"
    });
  }

  editedQuestion.question = question;
  editedQuestion.answer = answer;
  editedQuestion.keywords = Array.isArray(keywords) ? keywords : [];

  res.json(editedQuestion);
});

// DELETE /api/questions/:qId
// Delete a question
router.delete("/:qId", (req, res) => {
    const qId = Number(req.params.qId);

    const questionIndex = questions.findIndex((q) => q.id === qId);

    if (questionIndex === -1) {
        return res.status(404).json({ message: "Question not found" });
    }

    const deletedQuestion = questions.splice(questionIndex, 1);

    res.json({
        message: "Question deleted successfully",
        question: deletedQuestion[0]
    });
});


module.exports = router;
