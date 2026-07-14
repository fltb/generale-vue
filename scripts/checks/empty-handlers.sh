#!/usr/bin/env bash
# Check: no empty domain handlers or callbacks — () => {} is always a bug.
# This scans only backend game/service code, not test files.

set -euo pipefail
cd "$(dirname "$0")/../.."

violations=$(grep -rn "() => {}" packages/backend/src/games/ --include="*.ts" | grep -v "__tests__" || true)

if [ -n "$violations" ]; then
  echo "❌ Empty handlers found — these are bugs (likely unimplemented features):"
  echo "$violations"
  exit 1
fi

echo "✓ No empty handlers found"
