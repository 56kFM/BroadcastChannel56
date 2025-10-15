#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore","pipe","inherit"] }).toString().trim();
const out = `site-${sha}.zip`;
execSync(`git archive -o ${out} HEAD`, { stdio: "inherit" });
if (fs.existsSync(out)) {
  console.log(`Snapshot written: ${out}`);
} else {
  console.error("snapshot failed: no archive produced");
  process.exit(1);
}
