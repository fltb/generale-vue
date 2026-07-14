#!/usr/bin/env bash
# Check: exported types/consts in packages/types/src/game/bomberman/index.ts
# that are never imported by any other file. Cross-file dead code detection.

set -euo pipefail
cd "$(dirname "$0")/../.."

file="packages/types/src/game/bomberman/index.ts"

# Extract all `export type FooBar` or `export const foo` names
exports=$(grep -oP 'export (type|interface|enum|const|function) \K\w+' "$file" | sort -u)

dead=()
for name in $exports; do
  # Search for imports of this name outside the defining file
  count=$(grep -r "$name" packages/ --include="*.ts" --include="*.tsx" | grep -v "$file" | grep -v node_modules | grep -v __tests__ | grep -v ".d.ts" | wc -l)
  if [ "$count" -eq 0 ]; then
    dead+=("$name")
  fi
done

if [ ${#dead[@]} -gt 0 ]; then
  echo "❌ Unused exports in $file (never imported anywhere):"
  for d in "${dead[@]}"; do echo "  - $d"; done
  echo ""
  echo "Remove them or add @deprecated comment if planned for future use."
  exit 1
fi

echo "✓ All exports in bomberman types are used"
