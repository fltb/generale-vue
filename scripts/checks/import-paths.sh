#!/usr/bin/env bash
# Check: no imports from @generale/types/dist/* in bomberman code.
# Use the barrel export @generale/types instead.
# (pre-existing violations in generale/shared files are warnings only)

set -euo pipefail
cd "$(dirname "$0")/../.."

# Bomberman-specific — hard fail
bombViolations=$(grep -rn "from.*@generale/types/dist" packages/backend/src/games/bomberman/ packages/frontend/src/routes/games/bomberman/ --include="*.ts" --include="*.tsx" | grep -v "__tests__" || true)

if [ -n "$bombViolations" ]; then
  echo "❌ Forbidden import paths in bomberman — use '@generale/types' not '@generale/types/dist/*':"
  echo "$bombViolations"
  exit 1
fi

# Project-wide — warning only (pre-existing in generale)
allViolations=$(grep -rn "from.*@generale/types/dist" packages/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v __tests__ | grep -v bomberman | wc -l)

if [ "$allViolations" -gt 0 ]; then
  echo "⚠️  $allViolations uses of @generale/types/dist/* elsewhere (pre-existing, not blocking):"
  echo "   Fix when touching those files."
fi

echo "✓ Bomberman import paths clean"
