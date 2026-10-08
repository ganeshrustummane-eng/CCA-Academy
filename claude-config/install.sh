#!/usr/bin/env bash
# Installs the project's Claude Code agents, skills and rules into .claude/ (run from anywhere).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$here/../.claude"
mkdir -p "$dest"
cp -R "$here/agents" "$here/skills" "$here/rules" "$dest/"
echo "Installed agents, skills and rules into $dest"
