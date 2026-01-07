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

  # Check for checkpoint (needs user approval)
  if echo "$OUTPUT" | grep -q "CHECKPOINT:"; then
    echo ""
    echo "⏸️  Checkpoint reached!"
    echo "📋 Ralph is waiting for your approval."
    echo "   Review the changes, test them, then run ralph.sh again to continue."
    exit 0
  fi

  # Check for blocked (needs user input)
  if echo "$OUTPUT" | grep -q "BLOCKED:"; then
    echo ""
    echo "🚫 Ralph is blocked and needs your help!"
    echo "   Check the output above for details."
    exit 1
  fi

  # Check for all tasks complete
  if echo "$OUTPUT" | grep -q "ALL_TASKS_COMPLETE"; then
    echo ""
    echo "✅ All tasks complete!"
    exit 0
  fi

  # Check for error
  if echo "$OUTPUT" | grep -q "ERROR:"; then
    echo ""
    echo "❌ Ralph encountered an error!"
    echo "   Check the output above for details."
    exit 1
  fi

  echo ""
  echo "⏳ Sleeping 2s before next iteration..."
  sleep 2
done

echo ""
echo "⚠️ Max iterations ($MAX_ITERATIONS) reached"
exit 1
