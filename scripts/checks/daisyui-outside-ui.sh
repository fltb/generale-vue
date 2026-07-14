#!/usr/bin/env bash
# Check: DaisyUI/Tailwind component classes only in ~/ui/ primitives.
# WARNING-only for now — pre-existing violations need a refactor task.

set -euo pipefail
cd "$(dirname "$0")/../.."

PATTERN='class="[^"]*\(btn\|badge\|card\|modal\|alert\|select\|input\|table\|tooltip\|menu\|navbar\|divider\|collapse\|dropdown\|toggle\|textarea\|kbd\)'

bombCount=$(grep -rn "$PATTERN" packages/frontend/src/routes/games/bomberman/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | wc -l)
otherCount=$(grep -rn "$PATTERN" packages/frontend/src/routes/ --include="*.tsx" --include="*.ts" | grep -v "__tests__" | grep -v bomberman | wc -l)

echo "DaisyUI outside ~/ui/: bomberman=$bombCount, rest-of-project=$otherCount (pre-existing)"

if [ "$bombCount" -gt 0 ]; then
  echo "⚠️  $bombCount DaisyUI classes in bomberman — should use ~/ui primitives (future task)"
fi

# TODO: flip to exit 1 after refactoring bomberman to use ~/ui primitives
exit 0
