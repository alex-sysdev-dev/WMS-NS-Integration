# =============================================================================
# One-shot installer for the WMS_Build agent guardrails.
#
# The Cowork device bridge cannot write into .claude/, so the five hard-layer
# files land here first. Run this once to move them into place.
#
#   cd C:\Users\AlexAguilar\WMS_Build
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\docs\agent-guardrails-setup\install-guardrails.ps1
#
# Safe to re-run. Existing files are backed up to *.bak before being replaced.
# settings.local.json is never touched.
# =============================================================================

$ErrorActionPreference = 'Stop'

$setupRoot   = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $setupRoot)
$source      = Join-Path $setupRoot 'claude'
$target      = Join-Path $projectRoot '.claude'

Write-Output "Project root : $projectRoot"
Write-Output "Installing to: $target"
Write-Output ""

if (-not (Test-Path $source)) { throw "Source folder missing: $source" }

$files = @(
    'settings.json',
    'hooks\guardrails.ps1',
    'agents\netsuite-analyst.md',
    'agents\wms-implementer.md',
    'agents\doc-writer.md',
    'skills\led-connection\SKILL.md',
    'skills\wms-context\SKILL.md'
)

foreach ($rel in $files) {
    $src = Join-Path $source $rel
    $dst = Join-Path $target $rel
    if (-not (Test-Path $src)) { Write-Output "SKIP    $rel (not staged)"; continue }

    $dstDir = Split-Path -Parent $dst
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }

    if (Test-Path $dst) {
        Copy-Item $dst "$dst.bak" -Force
        Copy-Item $src $dst -Force
        Write-Output "REPLACE $rel (previous version saved as $rel.bak)"
    } else {
        Copy-Item $src $dst -Force
        Write-Output "INSTALL $rel"
    }
}

Write-Output ""
Write-Output "Verifying the hook blocks a NetSuite write..."
$hook = Join-Path $target 'hooks\guardrails.ps1'
$probe = '{"tool_name":"mcp__NetSuite__ns_createRecord","tool_input":{}}'
$probe | powershell -NoProfile -ExecutionPolicy Bypass -File $hook
if ($LASTEXITCODE -eq 2) {
    Write-Output "OK: hook returned exit 2 (blocked)."
} else {
    Write-Output "PROBLEM: hook returned exit $LASTEXITCODE, expected 2. The guardrail is NOT enforcing."
}

Write-Output ""
Write-Output "Verifying a normal call is allowed..."
$probe2 = '{"tool_name":"Read","tool_input":{"file_path":"app/page.tsx"}}'
$probe2 | powershell -NoProfile -ExecutionPolicy Bypass -File $hook
if ($LASTEXITCODE -eq 0) {
    Write-Output "OK: hook returned exit 0 (allowed)."
} else {
    Write-Output "PROBLEM: hook returned exit $LASTEXITCODE on a safe call, expected 0."
}

Write-Output ""
Write-Output "Done. Restart Claude Code in this project so it reloads settings.json and the agents."
