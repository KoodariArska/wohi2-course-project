const bcrypt = require("bcrypt");
const { resetDb, request, app, prisma } = require("./helpers");

beforeEach(resetDb);

describe("auth tests", () => {
    it("registers, hashes the password, returns a token", async () => {
        const res = await request(app).post("/api/auth/register")
            .send({ email: "a@test.io", password: "pw12345", name: "A" });
        
        expect(res.status).toBe(201);
        expect(res.body.token).toEqual(expect.any(String));

        const user = await prisma.user.findUnique({ where: { email: "a@test.io" } });
        expect(user.password).not.toBe("pw12345");                          // not plain
        expect(await bcrypt.compare("pw12345", user.password)).toBe(true);  // valid hash
    });

    it("does not allow duplicate email registration", async () => {
        await request(app).post("/api/auth/register")
            .send({ email: "a@test.io", password: "pw12345", name: "A" });

        const res = await request(app).post("/api/auth/register")
            .send({ email: "a@test.io", password: "12345", name: "B" });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe("Email already registered");
    });

    it("doesn't log in with wrong email or password", async () => {
        await request(app).post("/api/auth/register")
            .send({ email: "a@test.io", password: "pw12345", name: "A" });
        
        const wrong_email = await request(app).post("/api/auth/login")
            .send({ email: "wrong", password: "pw12345" });
        
        expect(wrong_email.status).toBe(401);
        expect(wrong_email.body.message).toBe("Invalid credentials");
        
        const wrong_password = await request(app).post("/api/auth/login")
            .send({ email: "a@test.io", password: "wrong" });
        
        expect(wrong_password.status).toBe(401);
        expect(wrong_password.body.message).toBe("Invalid credentials");
    });
});
