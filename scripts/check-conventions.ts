#!/usr/bin/env bun
/**
 * Convention checks — automated enforcement of project standards.
 * Run: bun run scripts/check-conventions.ts
 * CI: called after bun run test in .github/workflows/ci.yml
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const NC = "\x1b[0m";

let failed = 0;

function log(prefix: string, color: string, msg: string) {
  console.log(`${color}${prefix}${NC} ${msg}`);
}

// ─── Helpers ───

function walkFiles(dir: string, ext: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  for (const e of entries) {
    const parent = "parentPath" in e ? (e as unknown as { parentPath: string }).parentPath : dir;
    const full = join(parent, e.name);
    if (e.isFile() && e.name.endsWith(ext) && !e.name.includes(".test.") && !full.includes("__tests__")) {
      result.push(full);
    }
  }
  return result;
}

function readLines(file: string): string[] {
  return readFileSync(file, "utf-8").split("\n");
}

// ─── Checks ───

// 1. Empty handlers (hard fail)
{
  const violations: string[] = [];
  for (const f of walkFiles(join(ROOT, "packages/backend/src/games"), ".ts")) {
    for (const [i, line] of readLines(f).entries()) {
      if (line.includes("() => {}")) violations.push(`${f}:${i + 1}`);
    }
  }
  if (violations.length > 0) {
    log("✗", RED, `${violations.length} empty handler(s):`);
    for (const v of violations) log("", RED, v);
    failed++;
  } else {
    log("✓", GREEN, "empty handlers");
  }
}

// 2. Import paths (hard fail: bomberman only)
{
  const violations: string[] = [];
  for (const dir of ["packages/backend/src/games/bomberman", "packages/frontend/src/routes/games/bomberman"]) {
    for (const f of [...walkFiles(join(ROOT, dir), ".ts"), ...walkFiles(join(ROOT, dir), ".tsx")]) {
      for (const [i, line] of readLines(f).entries()) {
        if (line.includes("@generale/types/dist")) violations.push(`${f}:${i + 1}`);
      }
    }
  }
  if (violations.length > 0) {
    log("✗", RED, `${violations.length} forbidden import(s):`);
    for (const v of violations) log("", RED, v);
    failed++;
  } else {
    log("✓", GREEN, "import paths");
  }
}

// 3. Unused exports in bomberman types (hard fail)
{
  const typeFile = join(ROOT, "packages/types/src/game/bomberman/index.ts");
  const content = readFileSync(typeFile, "utf-8");
  const exportRe = /^export (?:type|interface|enum|const|function) (\w+)/gm;
  const names: string[] = [];
  let m;
  while ((m = exportRe.exec(content)) !== null) {
    if (m[1]) names.push(m[1]);
  }
  const dead: string[] = [];
  for (const name of names) {
    let found = false;
    for (const f of [...walkFiles(join(ROOT, "packages"), ".ts"), ...walkFiles(join(ROOT, "packages"), ".tsx")]) {
      if (f === typeFile) continue;
      if (readFileSync(f, "utf-8").includes(name)) { found = true; break; }
    }
    if (!found) dead.push(`"${name}" — never imported`);
  }
  if (dead.length > 0) {
    log("✗", RED, `${dead.length} unused export(s):`);
    for (const d of dead) log("", RED, d);
    failed++;
  } else {
    log("✓", GREEN, "unused exports");
  }
}

// 4. DaisyUI outside ~/ui (warning only)
{
  // Only match actual DaisyUI component patterns (word-modifier), not Tailwind utilities
  const daisyRe = /\b(?:btn|badge|card|modal|alert|select|input|table|tooltip|menu|navbar|divider|collapse|dropdown|toggle|textarea|kbd)-(?:primary|secondary|accent|info|success|warning|error|ghost|outline|sm|md|lg|xs|xl|bordered|circle|square|block|wide|link|glass|neutral|dash|soft|active|body|title|actions)/;
  let bomb = 0;
  let other = 0;
  for (const f of walkFiles(join(ROOT, "packages/frontend/src/routes"), ".tsx")) {
    for (const line of readLines(f)) {
      if (daisyRe.test(line)) {
        if (f.includes("/bomberman/")) bomb++;
        else other++;
      }
    }
  }
  log("⚠", YELLOW, `daisyui: bomberman=${bomb}, rest=${other} (pre-existing, info only)`);
}

// 5. IIFE in JSX (React-ism — hard fail)
{
  // {(() => ...)()} inside JSX is a React pattern; Solid uses <Show>/<Switch> or compute before return
  const iifeRe = /\{\(\(\s*\)\s*=>/;
  const violations: string[] = [];
  for (const f of walkFiles(join(ROOT, "packages/frontend/src"), ".tsx")) {
    for (const [i, line] of readLines(f).entries()) {
      // Skip comment lines
      if (line.trimStart().startsWith("//")) continue;
      if (iifeRe.test(line)) violations.push(`${f}:${i + 1}`);
    }
  }
  if (violations.length > 0) {
    log("✗", RED, `${violations.length} IIFE-in-JSX (use <Show> or extract logic before return):`);
    for (const v of violations) log("", RED, v);
    failed++;
  } else {
    log("✓", GREEN, "IIFE in JSX");
  }
}

// 6. Hardcoded English strings (warning only)
{
  const hits: string[] = [];
  for (const f of walkFiles(join(ROOT, "packages/frontend/src/routes/games/bomberman"), ".tsx")) {
    for (const [i, line] of readLines(f).entries()) {
      if (line.includes("t(") || line.includes("${") || line.includes("//") || line.includes("import ")) continue;
      const m = line.match(/>([A-Z][a-z]+(?:\s+[a-z]{2,})+)/);
      if (m && m[1]) hits.push(`${f}:${i + 1}: "${m[1]}"`);
      if (hits.length >= 20) break;
    }
  }
  if (hits.length > 0) {
    log("⚠", YELLOW, `${hits.length} potential hardcoded English string(s):`);
    for (const h of hits) log("", YELLOW, h);
  } else {
    log("✓", GREEN, "i18n strings");
  }
}

// ─── Result ───
if (failed > 0) {
  console.error(`\n${RED}${failed} check(s) FAILED.${NC}`);
  process.exit(1);
}
console.log(`\n${GREEN}All convention checks passed${NC}`);
process.exit(0);
