# =============================================================================
# LED Connection / WMS_Build agent guardrails - PreToolUse hook
# -----------------------------------------------------------------------------
# Reads the Claude Code PreToolUse payload on stdin. Exit 0 allows the call.
# Exit 2 blocks it and returns the stderr text to the model as the reason.
#
# This is the enforcement layer. CLAUDE.md is the explanation layer.
# Rules here must stay in sync with docs/agent-guardrails.md.
# =============================================================================

$ErrorActionPreference = 'Stop'

function Deny($reason) {
    [Console]::Error.WriteLine("BLOCKED by WMS_Build guardrails: $reason")
    exit 2
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
} catch {
    # Never fail closed on a malformed payload; that would wedge every session.
    exit 0
}

$tool = [string]$payload.tool_name
$input_ = $payload.tool_input | ConvertTo-Json -Depth 20 -Compress
if ($null -eq $input_) { $input_ = '' }

$path = ''
if ($payload.tool_input.file_path)  { $path = [string]$payload.tool_input.file_path }
elseif ($payload.tool_input.path)   { $path = [string]$payload.tool_input.path }
$pathN = $path -replace '\\', '/'

$cmd = ''
if ($payload.tool_input.command) { $cmd = [string]$payload.tool_input.command }

# --- 1. NetSuite record writes -------------------------------------------------
# Matched on the bare tool name so it holds no matter what the MCP server is
# named in a given session (it has been a UUID, claude_ai_NetSuite, and NetSuite).
if ($tool -match '(?i)ns_(create|update|delete|upsert)Record') {
    Deny "NetSuite writes are disabled for agents. Not production, not sandbox. This is the current standing rule. Stop here and hand the write to Alex to do by hand. Do not propose a workaround."
}

# --- 2. DML through SuiteQL ----------------------------------------------------
if ($tool -match '(?i)(runCustomSuiteQL|runSavedSearch|suiteql)') {
    if ($input_ -match '(?is)\b(insert\s+into|update\s+\w+\s+set|delete\s+from|merge\s+into|truncate\s+table|drop\s+(table|view)|alter\s+(table|session))\b') {
        Deny "SuiteQL is SELECT-only. DML detected in the query. Reading is unrestricted; no agent writes to NetSuite by any route."
    }
}

# --- 3. Secrets ----------------------------------------------------------------
if ($tool -match '(?i)^(Read|Write|Edit|NotebookEdit)$') {
    if (($pathN -match '(?i)(^|/)\.env(\.|$)' -and $pathN -notmatch '(?i)\.env\.example$') -or $pathN -match '(?i)\.pem$') {
        Deny "Secret file access is blocked ($path). Use .env.example for shape. Never read, print, or edit real credentials."
    }
}
if ($input_ -match '(?i)NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|ANTHROPIC|API_KEY)') {
    Deny "A server-only secret is being given a NEXT_PUBLIC_ prefix. Next.js inlines those into the browser bundle. Refused."
}
if ($cmd -match '(?i)(type|cat|Get-Content|gc)\s+.*\.env') {
    Deny "Printing .env contents is blocked."
}

# --- 4. Second datastore -------------------------------------------------------
# Supabase has been removed from this project in full. These rules now exist to
# stop it being recreated, not to contain something still in the tree.
if ($tool -match '(?i)^(Write|Edit|NotebookEdit)$' -and $pathN -match '(?i)(^|/)supabase/migrations/') {
    Deny "New Supabase migrations are blocked. NetSuite is the only datastore for this project. If state has nowhere to live in NetSuite, propose a NetSuite custom record and raise the exception to Alex."
}
if ($cmd -match '(?i)supabase\s+(db\s+push|migration\s+new|start)') {
    Deny "Supabase CLI schema commands are blocked. Supabase is legacy scaffolding, not the database."
}

# --- 5. Fabricated / seeded data ----------------------------------------------
if ($tool -match '(?i)^(Write|Edit)$' -and $input_ -match '(?i)(pg_cron|faker|seed_orders|generate_series\s*\(|Math\.random\(\)\s*\*\s*\d+)') {
    Deny "Looks like fabricated or simulated data. No sample rows, seeded values, or invented KPI numbers anywhere in this repo. An empty page and a working page must never look the same."
}

# --- 6. Vocabulary -------------------------------------------------------------
# "outtake" is legacy finance vocabulary that exists only in NetSuite metadata.
if ($tool -match '(?i)^(Write|Edit)$' -and $pathN -match '(?i)(^|/)(app|components|public)/') {
    $stripped = $input_ -replace '(?i)custentity_ledreadyforouttake', '' -replace '(?i)Pending Outtakes', ''
    if ($stripped -match '(?i)outtake') {
        Deny "The word 'outtake' cannot appear in UI copy. Say 'shipping'. Only the literal NetSuite identifiers custentity_ledreadyforouttake and the 'Pending Outtakes' saved search name are allowed, and not in user-facing text."
    }
}

# --- 7. Destructive shell / git ------------------------------------------------
if ($cmd -match '(?i)git\s+push\s+.*(--force|-f)\b') {
    Deny "Force push is blocked."
}
if ($cmd -match '(?i)git\s+(reset\s+--hard|clean\s+-[a-z]*f|filter-branch|rebase\s+-i)') {
    Deny "Destructive git history operations are blocked. Commit or stash instead."
}
if ($cmd -match '(?i)(rm\s+-rf\s+[/~]|Remove-Item\s+.*-Recurse.*-Force\s+["'']?[A-Za-z]:\\Users)') {
    Deny "Recursive force delete outside a scratch directory is blocked."
}

exit 0
