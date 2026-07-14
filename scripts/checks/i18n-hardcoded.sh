#!/usr/bin/env bash
# Check: potential hardcoded English strings in JSX text content.
# HEURISTIC — review output manually. Does NOT block CI.
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "Checking bomberman for hardcoded English strings..."
# Match JSX text content that looks like English labels (capitalized word + lowercase)
hits=$(grep -Pn '>[A-Z][a-z]+([[:space:]]+[a-z]{2,})+' packages/frontend/src/routes/games/bomberman/ --include="*.tsx" -r 2>/dev/null | grep -v __tests__ | grep -v "// " | grep -v "t(" | grep -v '${' | grep -v formatKey | grep -v "import " | grep -v "export " | head -20 || true)
if [ -n "$hits" ]; then
  echo "WARNING: potential hardcoded English strings (review manually):"
  echo "$hits"
  echo "  If intentional, ignore. Otherwise replace with t('bomberman.xxx')"
else
  echo "OK: no obvious hardcoded English strings found"
fi
