#!/usr/bin/env node
import fs from "node:fs";

function have(p){ try { fs.accessSync(p); return true; } catch { return false; } }
function read(p){ try { return fs.readFileSync(p,"utf8"); } catch { return ""; } }
function ok(re, s){ return re.test(s); }

const problems = [];

// a) sanitizer allows span[class] and wraps emoji
if (have("src/utils/sanitizeHTML.ts")) {
  const t = read("src/utils/sanitizeHTML.ts");
  if (!ok(/\bspan\b/i, t) || !ok(/allowedAttributes[^]*span[^]*class/i, t)) {
    problems.push("sanitizeHTML.ts: span[class] not allowed");
  }
  if (!ok(/textFilter[^]*class="emoji"/i, t)) {
    problems.push("sanitizeHTML.ts: emoji wrapper not present");
  }
}

// b) list.astro has hasNewer/hasOlder guards or currentId cursors
if (have("src/components/list.astro")) {
  const t = read("src/components/list.astro");
  if (!ok(/hasNewer|hasOlder/i, t)) {
    problems.push("list.astro: missing hasNewer/hasOlder usage");
  }
}

// c) workflows use offline build
if (have(".github/workflows/ci.yml")) {
  const t = read(".github/workflows/ci.yml");
  if (!ok(/OFFLINE_BUILD:\s*'true'/, t)) {
    problems.push("ci.yml: OFFLINE_BUILD env not set on build/canary steps");
  }
}
if (have(".github/workflows/lighthouse.yml")) {
  const t = read(".github/workflows/lighthouse.yml");
  if (!ok(/OFFLINE_BUILD:\s*'true'/, t)) {
    problems.push("lighthouse.yml: OFFLINE_BUILD env not set");
  }
}

// d) package.json has esbuild (canaries)
if (have("package.json")) {
  try {
    const pkg = JSON.parse(read("package.json"));
    const dev = (pkg.devDependencies || {});
    if (!("esbuild" in dev)) {
      problems.push("package.json: devDependencies.esbuild missing");
    }
  } catch {
    problems.push("package.json: invalid JSON");
  }
}

// e) pages use limit/navigateFrom
if (have("src/pages/index.astro")) {
  const t = read("src/pages/index.astro");
  if (!ok(/getChannelInfo\([^)]*\{\s*[^}]*limit:\s*1/i, t)) {
    problems.push("index.astro: getChannelInfo({ limit: 1 }) not found");
  }
}
if (have("src/pages/after/[cursor].astro")) {
  const t = read("src/pages/after/[cursor].astro");
  if (!ok(/navigateFrom:\s*cursor/i, t) || !ok(/direction:\s*['"]newer['"]/i, t)) {
    problems.push("after/[cursor].astro: navigateFrom/direction:'newer' missing");
  }
}
if (have("src/pages/before/[cursor].astro")) {
  const t = read("src/pages/before/[cursor].astro");
  if (!ok(/navigateFrom:\s*cursor/i, t) || !ok(/direction:\s*['"]older['"]/i, t)) {
    problems.push("before/[cursor].astro: navigateFrom/direction:'older' missing");
  }
}

if (problems.length) {
  console.error(JSON.stringify({ ok:false, problems }, null, 2));
  process.exit(1);
} else {
  console.log(JSON.stringify({ ok:true, message:"doctor clean" }, null, 2));
}
