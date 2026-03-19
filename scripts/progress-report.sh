#!/bin/bash

# MyApi Tier 2/3 Implementation Progress Report
# Runs at 8 AM and 6 PM to report status

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATUS_FILE="$PROJECT_DIR/PROJECT_STATUS.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M %Z')
HOUR=$(date '+%H')

# Extract current phase status from PROJECT_STATUS.md
get_phase_status() {
  grep -A 5 "^| [0-9] |" "$STATUS_FILE" | head -20
}

# Count commits in last 24 hours
get_recent_commits() {
  cd "$PROJECT_DIR"
  git log --oneline --since="24 hours ago" --grep="^phase" | head -20
}

# Get current overall progress
get_overall_progress() {
  grep "Overall Progress:" "$STATUS_FILE" | tail -1
}

# Generate report
generate_report() {
  cat <<EOF
🚀 **MyApi Tier 2/3 Implementation - Progress Report**

**Time:** $TIMESTAMP

**Current Status:**
$(get_overall_progress)

**Phase Breakdown:**
\`\`\`
$(get_phase_status)
\`\`\`

**Recent Commits (Last 24h):**
\`\`\`
$(get_recent_commits || echo "No recent phase commits")
\`\`\`

**Next Action:** Check PROJECT_STATUS.md for detailed breakdown
EOF
}

# Main
REPORT=$(generate_report)

# Send report based on time
if [ "$HOUR" = "08" ]; then
  # 8 AM: Send text + voice
  echo "📨 Sending 8 AM progress report (text + voice)..."
  # Text version would be sent via message tool here
  echo "$REPORT"
elif [ "$HOUR" = "18" ]; then
  # 6 PM: Send text only
  echo "📨 Sending 6 PM progress report (text)..."
  echo "$REPORT"
else
  echo "⏭️  Not scheduled time (Hour: $HOUR). No report sent."
fi
