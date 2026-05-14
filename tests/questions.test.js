const { resetDb, registerAndLogin, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

describe("question tests", () => {
    it("returns 401 without a token", async () => {
        const res = await request(app).get("/api/questions");
        expect(res.status).toBe(401);
    });

    it("returns 404 for unknown question", async () => {
        const token = await registerAndLogin();
        const res = await request(app).get("/api/questions/99999")
        .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.message).toBe("Question not found");
    });

    it("returns 200 for existing questions", async () => {
        const token = await registerAndLogin();
        const res = await request(app).get("/api/questions")
        .set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    it("returns 400 for invalid question body", async () => {
        const token = await registerAndLogin();
        const res = await request(app).post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "" });
        expect(res.status).toBe(400);
    });

    it("returns 201 for valid question creation", async () => {
        const token = await registerAndLogin();
        const res = await request(app).post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "What is the capital of France?", answer: "Paris" });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe("What is the capital of France?");
        expect(res.body.answer).toBe("Paris");
    });

    it("returns 403 for unauthorized question editing", async () => {
        const token = await registerAndLogin();
        const res = await request(app).post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "What is the capital of France?", answer: "Paris" });
        
        const token2 = await registerAndLogin("other@test.io", "B");
        const res2 = await request(app).put(`/api/questions/${res.body.id}`)
            .set("Authorization", `Bearer ${token2}`)
            .send({ title: "Edited title", answer: "Edited answer" });
        
        expect(res2.status).toBe(403);
        expect(res2.body.message).toBe("You can only modify your own questions");
    });

    it("returns 201 for valid playing attempt", async () => {
        const token = await registerAndLogin();

        const res = await request(app).post("/api/questions")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "What is the capital of France?", answer: "Paris" });
        
        expect(res.status).toBe(201);
        
        const attemptRes = await request(app).post(`/api/questions/${res.body.id}/play`)
            .set("Authorization", `Bearer ${token}`)
            .send({ answer: "Paris" });
        
        expect(attemptRes.status).toBe(201);
    });
});
