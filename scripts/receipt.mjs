#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function sh(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}
function safeRead(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}
function sentinel(p, re) {
  const txt = safeRead(p);
  if (!txt) return "";
  const m = txt.match(re);
  return m ? m[0] : "";
}

const branch = sh("git rev-parse --abbrev-ref HEAD");
const commit = sh("git rev-parse --short HEAD");
const diffstat = sh("git diff --staged --name-status || true") || sh("git diff --name-status || true");

// Common sentinels to prove key files contain the expected markers (if present)
const sentinels = [
  ["src/utils/sanitizeHTML.ts", /(textFilter|class="emoji"|allowedAttributes[^]*span)/],
  ["src/components/list.astro", /(hasNewer|hasOlder|beforeCursor|afterCursor)/],
  [".github/workflows/ci.yml", /(OFFLINE_BUILD|test:canary)/],
  [".github/workflows/lighthouse.yml", /(OFFLINE_BUILD|autorun)/],
].map(([p, re]) => [p, sentinel(p, re)]);

console.log(JSON.stringify({
  receipt: { branch, commit, diffstat },
  sentinels
}, null, 2));
