// Serves the Blacksteel Pirates game to family devices. No dependencies: plain Node.
//
// Listens on 127.0.0.1:4320 by default, so it is never exposed to the home network by accident.
// On Mouse, set HOST to Mouse's Tailscale address so phones on the tailnet can reach it:
//   HOST=<mouse-tailscale-ip> node server.js
// Living Town uses port 4310; this game uses 4320, so the two never collide.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 4320;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon"
};

// Only the game itself is served: no dotfiles, no voice cache, no server or deploy files.
function allowed(rel) {
  const parts = rel.split(path.sep);
  if (parts.some(p => p.startsWith("."))) return false;
  if (parts[0] === "deploy" || rel === "server.js" || /\.(command|sh)$/.test(rel)) return false;
  if (parts[0] === "voices" && parts[1] === "cache") return false;
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname); }
  catch (e) { res.writeHead(400).end(); return; }
  if (urlPath.endsWith("/")) urlPath += "index.html";
  const file = path.resolve(ROOT, "." + urlPath);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || path.isAbsolute(rel) || !allowed(rel)) { res.writeHead(404).end("Not found"); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404).end("Not found"); return; }
    const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    // Voice files are large and never change once made; the rest can change between visits.
    const cache = file.includes(path.sep + "voices" + path.sep) && file.endsWith(".mp3") ? "public, max-age=86400" : "no-cache";
    res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Cache-Control": cache });
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Blacksteel Pirates running at http://${HOST}:${PORT}`);
});
