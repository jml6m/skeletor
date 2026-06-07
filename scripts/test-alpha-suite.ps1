#requires -Version 5.1
<#
  IMPORTANT FOR GIT BASH / MINGW64 / WSL USERS:
    Do NOT run this file directly with bash.
    Use one of these instead:

      powershell.exe -ExecutionPolicy Bypass -File "path\to\test-alpha-suite.ps1" -Automated -TestRun "my-run-1"

    or (if you have PowerShell 7+ installed as pwsh):

      pwsh -ExecutionPolicy Bypass -File "path\to\test-alpha-suite.ps1" -Automated

.SYNOPSIS
    Test suite for the alpha version of @jml6m/skeletor on npm.

.DESCRIPTION
    Creates sandbox directories and runs various `skeletor new` commands
    against different templates.

    Default mode (Manual): The script will guide you and let you interact
    with the real interactive prompts (clack) as if you were creating a
    real project. This is the recommended way to experience the alpha UX.

    Automated / Headless mode: Pass -Automated (or -Headless). The script
    will supply --yes plus all required flags so no prompts are shown.
    Useful for quick smoke tests of every template + flag combination.

.PARAMETER Mode
    "Manual" (default) or "Automated" / "Headless".

.PARAMETER SandboxRoot
    Base directory where sub-sandboxes will be created.
    Defaults to C:\Users\brzt3\workspaces\skeletor-alpha-sandbox

.PARAMETER UseAlpha
    If true (default after publish), uses npx @jml6m/skeletor@alpha.
    Set to $false to test against local `node src/index.js` instead.

.PARAMETER TestRun
    A unique identifier for this test run (e.g. "my-experiment-1").
    If omitted, a timestamped name like "run-20240607-143022" is generated automatically.
    All generated sandboxes for this run will live under <SandboxRoot>/<TestRun>/.
    This prevents overwriting results from previous executions.

.EXAMPLE
    # From Git Bash / MSYS / any shell (recommended):
    powershell.exe -ExecutionPolicy Bypass -File ../skeletor/scripts/test-alpha-suite.ps1 -Automated

    # With a custom run name (prevents overwriting previous runs):
    powershell.exe -ExecutionPolicy Bypass -File ../skeletor/scripts/test-alpha-suite.ps1 -Automated -TestRun "my-experiment-2024-06-07"

    # Timestamped run name (PowerShell syntax):
    powershell.exe -ExecutionPolicy Bypass -File ../skeletor/scripts/test-alpha-suite.ps1 -Automated -TestRun "my-test-$(Get-Date -Format yyyyMMdd-HHmmss)"

    # Fully manual / interactive (you answer the clack prompts):
    .\scripts\test-alpha-suite.ps1 -TestRun "interactive-1"
#>

param(
    [ValidateSet("Manual", "Automated", "Headless")]
    [string]$Mode = "Manual",

    [switch]$Automated,
    [switch]$Headless,

    [string]$SandboxRoot = "C:\Users\brzt3\workspaces\skeletor-alpha-sandbox",

    [bool]$UseAlpha = $true,

    [string]$TestRun = ""
)

# Support convenient switch flags like -Automated and -Headless
if ($Automated) { $Mode = "Automated" }
if ($Headless)   { $Mode = "Headless" }

if (-not $TestRun) {
    $TestRun = "run-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

$ErrorActionPreference = "Stop"

$manual = ($Mode -eq "Manual")
$headless = ($Mode -eq "Automated" -or $Mode -eq "Headless")

if ($UseAlpha) {
    $skeletorCmd = "npx @jml6m/skeletor@alpha"
} else {
    $skeletorRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
    $skeletorCmd = "node `"$skeletorRoot\src\index.js`""
}

$EffectiveRoot = Join-Path $SandboxRoot $TestRun

Write-Host "=== Skeletor Alpha Test Suite ===" -ForegroundColor Cyan
Write-Host "Mode: $Mode (interactive prompts: $manual)" -ForegroundColor Yellow
Write-Host "Command: $skeletorCmd" -ForegroundColor Yellow
Write-Host "TestRun: $TestRun" -ForegroundColor Yellow
Write-Host "Sandboxes will be created under: $EffectiveRoot" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path $EffectiveRoot)) {
    New-Item -ItemType Directory -Path $EffectiveRoot -Force | Out-Null
}

$templates = @(
    "javascript",
    "typescript",
    "python",
    "go",
    "rust",
    "java",
    "csharp"
)

function New-Sandbox($name) {
    $dir = Join-Path $EffectiveRoot $name
    if (Test-Path $dir) {
        Write-Host "Removing previous $name..." -ForegroundColor DarkGray
        Remove-Item -Recurse -Force $dir
    }
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    return $dir
}

function Run-Command($cmd, $workDir) {
    Write-Host "`n>>> $cmd" -ForegroundColor Green
    if ($manual) {
        Write-Host "   (You will now interact with the prompts. This is intentional for manual mode.)" -ForegroundColor Magenta
        Read-Host "   Press ENTER to launch the command in $workDir"
    }
    Push-Location $workDir
    try {
        Invoke-Expression $cmd
    } finally {
        Pop-Location
    }
    if ($manual) {
        Read-Host "   Command finished. Press ENTER to continue to next..."
    }
}

# === MANUAL / INTERACTIVE RUNS ===
if ($manual) {
    Write-Host "`n--- MANUAL MODE: You will drive the interactive experience ---" -ForegroundColor Cyan

    foreach ($t in $templates) {
        $sb = New-Sandbox "manual-$t"
        $cmd = "$skeletorCmd new `"manual-$t`" --template $t"
        Run-Command $cmd $sb
    }

    # One with --no-git and custom owner/desc (still interactive for other prompts)
    $sb = New-Sandbox "manual-no-git"
    $cmd = "$skeletorCmd new `"manual-no-git`" --no-git"
    Run-Command $cmd $sb

    Write-Host "`nManual mode complete. You drove the prompts yourself." -ForegroundColor Green
}

# === AUTOMATED / HEADLESS RUNS ===
if ($headless) {
    Write-Host "`n--- AUTOMATED / HEADLESS MODE ---" -ForegroundColor Cyan

    foreach ($t in $templates) {
        $sb = New-Sandbox "auto-$t"
        $cmd = "$skeletorCmd new `"auto-$t`" --yes --template $t --owner `"alpha-tester`" --description `"Automated headless test for $t template`" --no-git"
        Run-Command $cmd $sb
    }

    # Extra variation: with git
    $sb = New-Sandbox "auto-with-git"
    $cmd = "$skeletorCmd new `"auto-with-git`" --yes --template typescript --owner `"alpha-tester`" --description `"Headless with git init`""
    Run-Command $cmd $sb

    # One using default (no --template) but --yes (should pick first available)
    $sb = New-Sandbox "auto-default-yes"
    $cmd = "$skeletorCmd new `"auto-default-yes`" --yes --owner `"alpha-tester`" --description `"Headless default template pick`" --no-git"
    Run-Command $cmd $sb

    Write-Host "`nAutomated mode complete. All commands ran with --yes and explicit flags (no interactive prompts)." -ForegroundColor Green
}

Write-Host "`n=== All requested iterations executed ===" -ForegroundColor Cyan
Write-Host "Test run ID: $TestRun" -ForegroundColor Yellow
Write-Host "Sandboxes are under: $EffectiveRoot" -ForegroundColor Yellow
Write-Host "Next step: run the verify script" -ForegroundColor Yellow
Write-Host "Example (from PowerShell):" -ForegroundColor Yellow
Write-Host "  .\scripts\verify-alpha-suite.ps1 -SandboxRoot `"$EffectiveRoot`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "Tip: If you ran this from Git Bash, next time use:" -ForegroundColor DarkGray
Write-Host "  powershell.exe -ExecutionPolicy Bypass -File <path-to-script> -Automated -TestRun `"$TestRun`"" -ForegroundColor DarkGray
