
const fs = require("fs");
let c = fs.readFileSync("server.js", "utf8");
const old_line = 'const JWT_SECRET = process.env.JWT_SECRET || "s6-lol-admin-secret-key-2026";';
const new_line = 'const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET missing in .env");
  process.exit(1);
}';
c = c.replace(old_line, new_line);
fs.writeFileSync("server.js", c);
console.log("JWT_FIXED");

