const express = require("express");
const app = express();
const prisma = require("./lib/prisma");
const questionsRouter = require("./routes/questions");
const authRouter = require("./routes/auth");

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use("/api/questions", questionsRouter);
app.use("/api/auth", authRouter);

app.use((req, res) => {
  res.status(404).json({ msg: "Not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
