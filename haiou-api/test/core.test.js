const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-that-is-longer-than-thirty-two-characters";

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; }
  };
}

test("admin middleware rejects a valid user token", () => {
  const authMiddleware = require("../middleware/auth");
  const token = jwt.sign({ id: 10, type: "user" }, process.env.JWT_SECRET, { algorithm: "HS256" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("admin middleware accepts an administrator token", () => {
  const authMiddleware = require("../middleware/auth");
  const token = jwt.sign({ id: 1, type: "admin" }, process.env.JWT_SECRET, { algorithm: "HS256" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.admin.type, "admin");
});

test("user middleware rejects an administrator token", () => {
  const userAuth = require("../middleware/userAuth");
  const token = jwt.sign({ id: 1, type: "admin" }, process.env.JWT_SECRET, { algorithm: "HS256" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  userAuth(req, res, () => assert.fail("next should not be called"));
  assert.equal(res.statusCode, 403);
});

test("Beijing date conversion handles UTC day boundary", () => {
  const { toBeijing } = require("../services/espnSchedule");
  assert.deepEqual(toBeijing("2026-07-09T16:30:00Z"), ["2026-07-10", "00:30"]);
});

test("ESPN event normalization uses homeAway rather than array order", () => {
  const { normalizeEvent } = require("../services/espnSchedule");
  const event = {
    id: "match-1",
    date: "2026-07-10T12:00:00Z",
    status: { type: { name: "STATUS_SCHEDULED", description: "Scheduled", detail: "" } },
    competitions: [{
      venue: { fullName: "Test Stadium" },
      competitors: [
        { homeAway: "away", score: "1", team: { displayName: "England" } },
        { homeAway: "home", score: "2", team: { displayName: "Portugal" } }
      ]
    }]
  };
  const result = normalizeEvent(event, "soccer", "世界杯");
  assert.equal(result.home, "葡萄牙");
  assert.equal(result.away, "英格兰");
  assert.equal(result.venue, "Test Stadium");
});

test("image signature detection recognizes supported formats", () => {
  const { detectImageExt } = require("../services/imageStorage");
  assert.equal(detectImageExt(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "jpg");
  assert.equal(detectImageExt(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
  assert.equal(detectImageExt(Buffer.from("RIFFxxxxWEBP", "ascii")), "webp");
});
