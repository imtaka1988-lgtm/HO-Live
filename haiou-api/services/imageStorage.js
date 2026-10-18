const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_ROOT = path.resolve(__dirname, "..", "..", "haiou-live", "uploads");
const ALLOWED_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function detectImageExt(buffer) {
  if (!Buffer.isBuffer(buffer)) return "";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return "png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "";
}

function parseDataImage(value, maxBytes) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("请上传 jpg、png 或 webp 图片");

  const ext = ALLOWED_MIME[match[1]];
  const base64 = match[2].replace(/\s+/g, "");
  const maxBase64Length = Math.ceil(maxBytes / 3) * 4 + 8;
  if (base64.length > maxBase64Length) throw new Error("图片文件过大");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("图片内容为空");
  if (buffer.length > maxBytes) throw new Error("图片文件过大");
  const detected = detectImageExt(buffer);
  if (!detected || detected !== ext) throw new Error("图片格式与文件内容不一致");
  return { ext, buffer };
}

function safeSegment(value) {
  return String(value || "file").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "file";
}

async function saveDataImage({ value, dirName, prefix, maxBytes }) {
  const parsed = parseDataImage(value, maxBytes);
  const safeDir = safeSegment(dirName);
  const uploadDir = path.join(UPLOAD_ROOT, safeDir);
  await fs.mkdir(uploadDir, { recursive: true });

  const filename = `${safeSegment(prefix)}_${crypto.randomUUID()}.${parsed.ext}`;
  const fullPath = path.join(uploadDir, filename);
  await fs.writeFile(fullPath, parsed.buffer, { flag: "wx", mode: 0o640 });
  return `/uploads/${safeDir}/${filename}`;
}

async function removeUploadedFile(publicPath) {
  const value = String(publicPath || "");
  if (!value.startsWith("/uploads/")) return;
  const relative = value.slice("/uploads/".length);
  const fullPath = path.resolve(UPLOAD_ROOT, relative);
  if (fullPath !== UPLOAD_ROOT && !fullPath.startsWith(UPLOAD_ROOT + path.sep)) return;
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== "ENOENT") console.warn("[upload cleanup]", err.message);
  }
}

module.exports = { saveDataImage, removeUploadedFile, detectImageExt };
