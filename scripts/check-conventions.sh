#!/usr/bin/env bash
# Master convention check — runs all individual checks.
# Add to CI as a single step. Fails if any check fails.
# Warnings (exit 0) for checks that need human review.

set -euo pipefail
DIR="$(dirname "$0")"
cd "$DIR/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

failed=0

run_check() {
  local name="$1"
  local script="$DIR/checks/$name.sh"
  echo "--- $name ---"
  if bash "$script"; then
    echo -e "${GREEN}✓ $name passed${NC}"
  else
    echo -e "${RED}✗ $name FAILED${NC}"
    failed=1
  fi
  echo ""
}

run_check "empty-handlers"
run_check "import-paths"
run_check "daisyui-outside-ui"
run_check "unused-exports"

# i18n check is a warning only — it has false positives
echo "--- i18n-hardcoded (warning) ---"
bash "$DIR/checks/i18n-hardcoded.sh" || true
echo ""

if [ $failed -eq 1 ]; then
  echo -e "${RED}Some convention checks FAILED. Fix violations above.${NC}"
  exit 1
fi

echo -e "${GREEN}All convention checks passed${NC}"
