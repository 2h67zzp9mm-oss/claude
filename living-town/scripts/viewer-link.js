"use strict";
/**
 * Prints the visitor window's link, creating the secret token if needed.
 *
 *   npm run viewer-link          show the link (creates it the first time)
 *   npm run viewer-link -- --new make a new link; the old one stops working
 *
 * Restart the server afterwards so it picks up a new token.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { newToken, readToken } = require("../lib/viewer");

const file = path.join(__dirname, "..", "viewer-token");
let token = readToken(file, {});
if (!token || process.argv.includes("--new")) {
  token = newToken();
  fs.writeFileSync(file, `${token}\n`, { mode: 0o600 });
  console.log(token ? "Made a new visitor link. Restart the server to use it." : "");
}

let host = "<this machine's Tailscale name>";
for (const cli of ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"]) {
  try {
    const status = JSON.parse(execFileSync(cli, ["status", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    if (status.Self?.DNSName) { host = status.Self.DNSName.replace(/\.$/, ""); break; }
  } catch {}
}
console.log(`Visitor link: https://${host}/v/${token}/`);
