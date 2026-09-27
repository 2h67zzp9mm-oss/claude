"use strict";
/**
 * The visitor window: a read-only view of the town for family who aren't on
 * the tailnet (published with Tailscale Funnel).
 *
 * It runs as its own HTTP server on its own port, so none of the main
 * server's routes exist here: no accounts, no /api, no commands. Everything
 * lives under a secret path, /v/<token>/, and anything else is a 404. The
 * WebSocket only ever sends; a visitor socket that sends anything is closed.
 * What it sends is decided by the caller (see visitorResident in server.js),
 * which leaves out ages, birthdays, histories, memories and relationships.
 */

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const { WebSocketServer } = require("ws");

const MAX_VISITORS = 12;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;

function newToken() { return crypto.randomBytes(24).toString("base64url"); }

/** The token from the environment, or from the given file; null means the window is off. */
function readToken(file, env = process.env) {
  // A token in the environment (even an empty one) wins over the file.
  const fromEnv = env.LIVING_TOWN_VIEWER_TOKEN;
  const candidate = String(fromEnv !== undefined ? fromEnv : fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "").trim();
  return TOKEN_PATTERN.test(candidate) ? candidate : null;
}

function sameToken(given, token) {
  const a = Buffer.from(String(given)), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function startViewer({ port, host = "127.0.0.1", token, publicDir, sharedDir, headers, fullState, log = console }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(headers);
  app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  const indexHtml = fs.readFileSync(path.join(publicDir, "index.html"), "utf8").replace("<html", '<html data-viewer="1"');

  const secret = express.Router();
  secret.get("/", (req, res) => {
    // Relative asset paths need the trailing slash.
    if (!req.originalUrl.split("?")[0].endsWith("/")) return res.redirect(301, `${req.baseUrl}/`);
    res.type("html").send(indexHtml);
  });
  secret.use("/shared", express.static(sharedDir, { index: false }));
  secret.use(express.static(publicDir, { index: false }));
  app.use("/v/:token", (req, res, next) => (sameToken(req.params.token, token) ? secret(req, res, next) : next()));
  app.use((req, res) => res.status(404).type("text").send("Not found"));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://visitor");
    const match = url.pathname.match(/^\/v\/([^/]+)\/ws$/);
    let origin = true;
    if (req.headers.origin) { try { origin = new URL(req.headers.origin).host === req.headers.host; } catch { origin = false; } }
    if (!match || !sameToken(match[1], token) || !origin || wss.clients.size >= MAX_VISITORS) {
      socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, ws => {
      ws.isAlive = true;
      ws.on("pong", () => { ws.isAlive = true; });
      // Read-only: any message at all ends the visit.
      ws.on("message", () => ws.close(1008, "read-only"));
      ws.send(JSON.stringify({ type: "hello", me: null, initialized: true, visitor: true }));
      ws.send(fullState());
    });
  });
  const health = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);
  server.listen(port, host, () => log.log(`Visitor window on http://${host}:${port}/v/…/ (read-only)`));
  server.on("error", err => log.error(`Visitor window could not start: ${err.message}`));

  return {
    broadcast(payload) { wss.clients.forEach(ws => { if (ws.readyState === 1) ws.send(payload); }); },
    get visitors() { return wss.clients.size; },
    close() { clearInterval(health); wss.clients.forEach(ws => ws.terminate()); server.close(); }
  };
}

module.exports = { startViewer, readToken, newToken, sameToken, TOKEN_PATTERN };
