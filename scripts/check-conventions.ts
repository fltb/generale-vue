#!/usr/bin/env bun
/**
 * Convention checks — automated enforcement of project standards.
 * Run: bun run scripts/check-conventions.ts
 * CI: called after bun run test in .github/workflows/ci.yml
 *
 * Checks that FAIL (exit 1):
 *  1. Empty handlers: no () => {} in game domain handlers
 *  2. Import paths: no @generale/types/dist/* in bomberman
 *  3. Unused exports: no exported types never imported cross-file
 *
 * Checks that WARN (exit 0):
 *  4. DaisyUI outside ~/ui/: tracks raw class usage
 *  5. Hardcoded English strings: heuristic i18n scan
 */

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Script directory is scripts/, project root is one level up
const ROOT = resolve(import.meta.dir, "..");
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const NC = "\x1b[0m";

let failed = 0;

function check(name: string, fn: () => string[]): void {
  console.log(`--- ${name} ---`);
  const violations = fn();
  if (violations.length > 0) {
    console.log(`${RED}✗ ${violations.length} violation(s):${NC}`);
    for (const v of violations) console.log(`  ${v}`);
    failed++;
  } else {
    console.log(`${GREEN}✓ pass${NC}`);
  }
  console.log();
}

function warn(name: string, fn: () => string[]): void {
  console.log(`--- ${name} (warning) ---`);
  const hits = fn();
  if (hits.length > 0) {
    console.log(`${YELLOW}⚠ ${hits.length} issue(s):${NC}`);
    for (const h of hits) console.log(`  ${h}`);
  } else {
    console.log(`${GREEN}✓ clean${NC}`);
  }
  console.log();
}

// ─── 1. Empty handlers ───

function walkFiles(dir: string, ext: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(ext) && !e.name.includes(".test.") && !e.path.includes("__tests__"))
    .map((e) => resolve(e.path, e.name));
}

check("empty handlers", () => {
  const violations: string[] = [];
  for (const f of walkFiles(ROOT + "/packages/backend/src/games", ".ts")) {
    const lines = readFileSync(f, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("() => {}")) {
        violations.push(`${f}:${i + 1}`);
      }
    }
  }
  return violations;
});

// ─── 2. Import paths ───

check("import paths (bomberman)", () => {
  const violations: string[] = [];
  for (const dir of ["packages/backend/src/games/bomberman", "packages/frontend/src/routes/games/bomberman"]) {
    for (const f of walkFiles(ROOT + "/" + dir, ".ts")) {
      const lines = readFileSync(f, "utf-8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('@generale/types/dist')) {
          violations.push(`${f}:${i + 1}`);
        }
      }
    }
  }
  // Also check frontend .tsx files
  for (const f of walkFiles(ROOT + "/packages/frontend/src/routes/games/bomberman", ".tsx")) {
    const lines = readFileSync(f, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@generale/types/dist')) {
        violations.push(`${f}:${i + 1}`);
      }
    }
  }
  return violations;
});

// ─── 3. Unused exports ───

check("unused exports (bomberman types)", () => {
  const typeFile = ROOT + "/packages/types/src/game/bomberman/index.ts";
  const content = readFileSync(typeFile, "utf-8");
  const exportRe = /^export (?:type|interface|enum|const|function) (\w+)/gm;
  const exports: string[] = [];
  let m;
  while ((m = exportRe.exec(content)) !== null) {
    if (m[1]) exports.push(m[1]);
  }
  const dead: string[] = [];
  for (const name of exports) {
    let found = false;
    for (const f of walkFiles(ROOT + "/packages", ".ts")) {
      if (f === typeFile) continue;
      if (readFileSync(f, "utf-8").includes(name)) { found = true; break; }
    }
    if (!found) {
      for (const f of walkFiles(ROOT + "/packages", ".tsx")) {
        if (readFileSync(f, "utf-8").includes(name)) { found = true; break; }
      }
    }
    if (!found) dead.push(`"${name}" — never imported`);
  }
  return dead;
});

// ─── 4. DaisyUI (warning) ───

warn("daisyui outside ~/ui", () => {
  const patterns = /\b(?:btn|badge|card|modal|alert|select|input|table|tooltip|menu|navbar|divider|collapse|dropdown|toggle|textarea|kbd)\b(?:-|$)/;
  let bombCount = 0;
  let otherCount = 0;
  for (const f of walkFiles(ROOT + "/packages/frontend/src/routes/games/bomberman", ".tsx")) {
    const lines = readFileSync(f, "utf-8").split("\n");
    for (const line of lines) {
      if (/class="[^"]*"/.test(line) && patterns.test(line)) bombCount++;
    }
  }
  for (const f of walkFiles(ROOT + "/packages/frontend/src/routes", ".tsx")) {
    if (f.includes("bomberman")) continue;
    const lines = readFileSync(f, "utf-8").split("\n");
    for (const line of lines) {
      if (/class="[^"]*"/.test(line) && patterns.test(line)) otherCount++;
    }
  }
  if (bombCount > 0 || otherCount > 0) {
    return [`bomberman=${bombCount} violations, rest-of-project=${otherCount} (pre-existing)`];
  }
  return [];
});

// ─── 5. Hardcoded English (warning) ───

warn("hardcoded English strings (bomberman)", () => {
  const hits: string[] = [];
  for (const f of walkFiles(ROOT + "/packages/frontend/src/routes/games/bomberman", ".tsx")) {
    const lines = readFileSync(f, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip lines with i18n calls, variables, comments
      if (line.includes("t(") || line.includes("${") || line.includes("//") || line.includes("import ")) continue;
      // Match English-looking text in JSX: >Capitalized lowercase<
      const m = line.match(/>([A-Z][a-z]+(?:\s+[a-z]{2,})+)/);
      if (m && m[1] && m[1].length > 3) {
        hits.push(`${f}:${i + 1}: "${m[1]}"`);
        if (hits.length >= 20) break;
      }
    }
  }
  return hits;
});

// ─── Result ───

if (failed > 0) {
  console.log(`${RED}${failed} check(s) FAILED. Fix violations above.${NC}`);
  process.exit(1);
}

console.log(`${GREEN}All convention checks passed${NC}`);
process.exit(0);
