// Serves the Blacksteel Pirates game to family devices. No dependencies: plain Node.
//
// Listens on 127.0.0.1:4320 by default, so it is never exposed to the home network by accident.
// On Mouse, set HOST to Mouse's Tailscale address so phones on the tailnet can reach it:
//   HOST=<mouse-tailscale-ip> node server.js
// Living Town uses port 4310; this game uses 4320, so the two never collide.
//
// Entry code (optional): Set BLACKSTEEL_CODE to require a code to access the game.
// Example: BLACKSTEEL_CODE=pirate1234 node server.js
// The code is not bypassable from the client; failed attempts trigger rate limiting.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 4320;
const ROOT = __dirname;
const ENTRY_CODE = process.env.BLACKSTEEL_CODE || null;

// Rate limiting: track failed attempts per IP
const rateLimitMap = new Map(); // IP -> { attempts: number, lockedUntil: timestamp }
const RATE_LIMIT_ATTEMPTS = 8;
const RATE_LIMIT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Session tokens: track authenticated visitors
const sessionTokens = new Set(); // Set of valid session tokens
const sessionsByIP = new Map(); // IP -> token (for invalidating on code change)

function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getClientIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const entry = rateLimitMap.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil && Date.now() < entry.lockedUntil) return true;
  if (Date.now() > entry.lockedUntil) {
    rateLimitMap.delete(ip);
    return false;
  }
  return false;
}

function recordFailedAttempt(ip) {
  let entry = rateLimitMap.get(ip) || { attempts: 0, lockedUntil: null };
  entry.attempts++;
  if (entry.attempts >= RATE_LIMIT_ATTEMPTS) {
    entry.lockedUntil = Date.now() + RATE_LIMIT_LOCKOUT_MS;
  }
  rateLimitMap.set(ip, entry);
}

function recordSuccessfulAuth(ip) {
  const token = generateSessionToken();
  sessionTokens.add(token);
  const oldToken = sessionsByIP.get(ip);
  if (oldToken) sessionTokens.delete(oldToken);
  sessionsByIP.set(ip, token);
  rateLimitMap.delete(ip);
  return token;
}

function isValidSession(ip, token) {
  if (!token || !sessionTokens.has(token)) return false;
  return sessionsByIP.get(ip) === token;
}

function invalidateAllSessions() {
  sessionTokens.clear();
  sessionsByIP.clear();
}

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

const entryHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blacksteel Pirates</title>
  <style>
    body { font-family: Georgia, serif; background: linear-gradient(135deg, #1a1a1a, #2d2d2d); color: #ddd; margin: 0; padding: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .entry-panel { background: rgba(0,0,0,0.7); border: 2px solid #8b7355; border-radius: 8px; padding: 40px; max-width: 400px; box-shadow: 0 0 30px rgba(0,0,0,0.8); }
    .entry-panel h1 { margin: 0 0 10px; font-size: 28px; color: #d4a574; text-align: center; }
    .entry-panel p { margin: 0 0 20px; text-align: center; font-size: 14px; color: #aaa; }
    .entry-form { display: flex; flex-direction: column; gap: 12px; }
    input[type="password"] { padding: 12px; background: #111; border: 1px solid #666; color: #ddd; font-size: 16px; border-radius: 4px; }
    input[type="password"]:focus { outline: none; border-color: #d4a574; background: #1a1a1a; }
    button { padding: 12px; background: #8b7355; color: #f5f5dc; border: none; font-size: 16px; font-weight: bold; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #9d8566; }
    button:active { background: #7a6348; }
    .error { color: #e85d5d; font-size: 14px; text-align: center; margin-top: 10px; min-height: 20px; }
  </style>
</head>
<body>
  <div class="entry-panel">
    <h1>The Blacksteel Pirates</h1>
    <p>Enter the access code</p>
    <form class="entry-form" onsubmit="handleSubmit(event)">
      <input type="password" id="code" placeholder="Access code" autocomplete="off" required autofocus>
      <button type="submit">Enter</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  <script>
    async function handleSubmit(e) {
      e.preventDefault();
      const code = document.getElementById("code").value;
      const errorDiv = document.getElementById("error");
      errorDiv.textContent = "";
      try {
        const res = await fetch("/check-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include"
        });
        const data = await res.json();
        if (res.ok) {
          window.location.href = "/";
        } else {
          errorDiv.textContent = data.message || "Invalid code";
        }
      } catch (err) {
        errorDiv.textContent = "Error checking code";
      }
      document.getElementById("code").value = "";
    }
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const clientIP = getClientIP(req);

  // Handle code checking
  if (req.method === "POST" && req.url === "/check-code") {
    if (isRateLimited(clientIP)) {
      res.writeHead(429, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Too many attempts. Try again in 15 minutes." }));
      return;
    }

    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { code } = JSON.parse(body);
        if (code === ENTRY_CODE) {
          const token = recordSuccessfulAuth(clientIP);
          const cookie = `blacksteel-session=${token}; Path=/; Max-Age=${24*60*60}; HttpOnly; SameSite=Lax`;
          res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": cookie });
          res.end(JSON.stringify({ ok: true }));
        } else {
          recordFailedAttempt(clientIP);
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ message: "Invalid code" }));
        }
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Invalid request" }));
      }
    });
    return;
  }

  // Check authentication if entry code is set
  if (ENTRY_CODE) {
    const sessionToken = req.headers.cookie?.split("; ").find(c => c.startsWith("blacksteel-session="))?.split("=")[1];
    const isAuthenticated = isValidSession(clientIP, sessionToken);

    if (!isAuthenticated) {
      // Not authenticated: show entry page for root and /entry, block everything else
      if (req.url === "/" || req.url === "/entry" || req.url === "") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(entryHTML);
        return;
      } else {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Access denied. Please enter the access code.");
        return;
      }
    }
  }

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
