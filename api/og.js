const { readFileSync } = require("fs");
const { join } = require("path");

module.exports = function handler(req, res) {
  const a = readFileSync(join(__dirname, "og-a.txt"), "utf8");
  const b = readFileSync(join(__dirname, "og-b.txt"), "utf8");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");
  res.status(200).send(Buffer.from(a + b, "base64"));
};
