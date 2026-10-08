# Installs the project's Claude Code agents, skills and rules into .claude/ (run from cca-academy/).
# Usage: powershell -File claude-config\install.ps1
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root ".claude"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
foreach ($d in "agents", "skills", "rules") {
  Copy-Item -Recurse -Force (Join-Path $PSScriptRoot $d) $dest
}
Write-Host "Installed agents, skills and rules into $dest"
