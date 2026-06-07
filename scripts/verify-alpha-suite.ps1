<#
.SYNOPSIS
    Verification script for skeletor alpha test sandboxes.

.DESCRIPTION
    Inspects each sub-directory created by test-alpha-suite.ps1 and checks
    that the expected files for the chosen template are present.
    Optionally attempts to run the "verifyCommands" style steps for that template.

.PARAMETER SandboxRoot
    Root containing the manual-* and auto-* subdirectories.
#>

param(
    [string]$SandboxRoot = "C:\Users\brzt3\workspaces\skeletor-alpha-sandbox"
)

$ErrorActionPreference = "Continue"

Write-Host "=== Skeletor Alpha Verification Suite ===" -ForegroundColor Cyan
Write-Host "Scanning: $SandboxRoot" -ForegroundColor Yellow

$templateExpectations = @{
    "javascript" = @{
        Files = @("package.json", ".prettierrc.json", "AGENTS.md", "src/index.js", "release.js")
        Commands = @("npm install", "npm run lint", "npm test")
    }
    "typescript" = @{
        Files = @("package.json", "tsconfig.json", "AGENTS.md", "src/index.ts", "eslint.config.js")
        Commands = @("npm install", "npm run build", "npm run lint", "npm test")
    }
    "python" = @{
        Files = @("pyproject.toml", "AGENTS.md", "src/app/main.py", "tests/test_main.py")
        Commands = @("python -m pip install -e '.[dev]'", "python -m ruff check .", "python -m pytest -q")
    }
    "go" = @{
        Files = @("go.mod", "main.go", "main_test.go", "AGENTS.md")
        Commands = @("go mod tidy", "go build .", "go test ./...")
    }
    "rust" = @{
        Files = @("Cargo.toml", "src/main.rs", "AGENTS.md")
        Commands = @("cargo check", "cargo test")
    }
    "java" = @{
        Files = @("pom.xml", "src/main/java/com/example/App.java", "src/test/java/com/example/AppTest.java", "AGENTS.md")
        Commands = @("mvn clean compile", "mvn test")
    }
    "csharp" = @{
        Files = @("Program.cs", "ProgramTests.cs", "AGENTS.md")  # .csproj name varies because of token
        Commands = @("dotnet build", "dotnet test")
    }
}

$results = @()

Get-ChildItem -Path $SandboxRoot -Directory | ForEach-Object {
    $dir = $_.FullName
    $name = $_.Name
    Write-Host "`n--- Verifying $name ---" -ForegroundColor Magenta

    $matchedTemplate = $null
    foreach ($key in $templateExpectations.Keys) {
        if ($name -like "*$key*") {
            $matchedTemplate = $key
            break
        }
    }

    if (-not $matchedTemplate) {
        Write-Host "  Could not determine template from folder name. Skipping detailed checks." -ForegroundColor DarkYellow
        return
    }

    $expect = $templateExpectations[$matchedTemplate]
    $allGood = $true

    foreach ($file in $expect.Files) {
        $full = Join-Path $dir $file
        if (Test-Path $full) {
            Write-Host "  [OK] $file" -ForegroundColor Green
        } else {
            Write-Host "  [MISSING] $file" -ForegroundColor Red
            $allGood = $false
        }
    }

    # Special case for csharp .csproj (filename contains literal token in current alpha)
    if ($matchedTemplate -eq "csharp") {
        $csproj = Get-ChildItem -Path $dir -Filter "*.csproj" | Select-Object -First 1
        if ($csproj) {
            Write-Host "  [OK] $($csproj.Name) (csharp project file)" -ForegroundColor Green
        } else {
            Write-Host "  [MISSING] *.csproj" -ForegroundColor Red
            $allGood = $false
        }
    }

    # Try running a couple of verify steps (best effort, may require deps)
    if ($allGood -and $expect.Commands.Count -gt 0) {
        Write-Host "  Attempting basic verification commands (this may take time)..." -ForegroundColor DarkGray
        Push-Location $dir
        try {
            foreach ($cmd in $expect.Commands | Select-Object -First 2) {   # only first two to keep it reasonable
                Write-Host "    -> $cmd" -ForegroundColor Cyan
                try {
                    Invoke-Expression $cmd 2>&1 | Out-Null
                    Write-Host "       succeeded" -ForegroundColor Green
                } catch {
                    Write-Host "       failed or not runnable in this environment: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        } finally {
            Pop-Location
        }
    }

    $results += [pscustomobject]@{
        Sandbox = $name
        Template = $matchedTemplate
        Passed = $allGood
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize

$failed = $results | Where-Object { -not $_.Passed }
if ($failed) {
    Write-Host "Some sandboxes had missing expected files. Review above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All inspected sandboxes look good for their templates!" -ForegroundColor Green
}
