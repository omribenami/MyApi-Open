#!/usr/bin/env python3
"""
Send progress report for MyApi Tier 2/3 implementation
Runs at 8 AM (with voice) and 6 PM (text only)
"""

import os
import json
import subprocess
import re
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
STATUS_FILE = PROJECT_DIR / "PROJECT_STATUS.md"

def get_phase_status():
    """Extract phase status from PROJECT_STATUS.md"""
    with open(STATUS_FILE) as f:
        content = f.read()
    
    # Extract status table
    match = re.search(r'\| Phase.*?\n\|---.*?\n(.*?)\n---', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return "Unable to read phase status"

def get_recent_commits():
    """Get commits from last 24 hours"""
    os.chdir(PROJECT_DIR)
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "--since=24 hours ago", "--grep=^phase"],
            capture_output=True, text=True
        )
        commits = result.stdout.strip().split('\n')[:10]
        return '\n'.join(commits) if commits[0] else "No recent phase commits"
    except:
        return "Error reading commits"

def get_overall_progress():
    """Get overall progress percentage"""
    with open(STATUS_FILE) as f:
        for line in f:
            if "Overall Progress:" in line:
                return line.strip()
    return "Unknown"

def generate_report():
    """Generate progress report"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M %Z")
    
    report = f"""🚀 **MyApi Tier 2/3 Implementation - Progress Report**

**Time:** {timestamp}

**Current Status:**
{get_overall_progress()}

**Phase Breakdown:**
```
{get_phase_status()}
```

**Recent Commits (Last 24h):**
```
{get_recent_commits()}
```

**Next Action:** Check PROJECT_STATUS.md for detailed breakdown
"""
    return report

def send_report(include_voice=False):
    """Send report via message tool"""
    report = generate_report()
    hour = datetime.now().hour
    
    # This would integrate with OpenClaw's message tool
    # For now, just print it
    print(report)
    
    if include_voice and hour == 8:
        print("\n🔊 [Voice message would be sent here]")
        print("Text truncated to 1500 chars for TTS:")
        print(report[:1500])

if __name__ == "__main__":
    import sys
    
    hour = datetime.now().hour
    include_voice = hour == 8  # 8 AM = include voice
    
    if hour in [8, 18]:  # 8 AM or 6 PM
        send_report(include_voice=include_voice)
    else:
        print(f"Not scheduled time (current hour: {hour}). Use --force to send anyway.")
        if "--force" in sys.argv:
            send_report(include_voice=include_voice)
