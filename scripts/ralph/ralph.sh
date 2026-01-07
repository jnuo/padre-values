#!/bin/bash
set -e

MAX_ITERATIONS=${1:-15}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting Ralph for ViziAI"
echo "Max iterations: $MAX_ITERATIONS"
echo ""

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "═══════════════════════════════════════"
  echo "═══ Iteration $i of $MAX_ITERATIONS ═══"
  echo "═══════════════════════════════════════"

  OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" \
    | claude --dangerously-skip-permissions 2>&1 \
    | tee /dev/stderr) || true

  if echo "$OUTPUT" | grep -q "<promise>PHASE1_COMPLETE</promise>"; then
    echo ""
    echo "✅ Phase 1 complete!"
    echo "📋 Next steps:"
    echo "   1. Test the dashboard at localhost:3000"
    echo "   2. Verify your father's data appears from Supabase"
    echo "   3. Set up Google OAuth (we'll do this together)"
    echo "   4. Run ralph.sh again for Phase 2"
    exit 0
  fi

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "✅ All stories complete!"
    exit 0
  fi

  echo ""
  echo "⏳ Sleeping 2s before next iteration..."
  sleep 2
done

echo ""
echo "⚠️ Max iterations ($MAX_ITERATIONS) reached"
exit 1
