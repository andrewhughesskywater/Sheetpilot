# Development smoke test to verify single initialization and absence of CSP warnings
# PowerShell version for Windows

param(
    [int]$WaitSeconds = 10
)

Write-Host "🚀 Starting development smoke test..." -ForegroundColor Cyan
Write-Host ""

# Temporary log file
$LogFile = [System.IO.Path]::GetTempFileName()

try {
    # Change to project root
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $ProjectRoot = Split-Path -Parent $ScriptDir
    Set-Location $ProjectRoot

    # Check if node_modules exists
    if (!(Test-Path "node_modules")) {
        Write-Host "❌ node_modules not found. Please run 'npm install' first." -ForegroundColor Red
        exit 1
    }

    # Kill any existing dev servers on port 5173
    $ProcessOnPort = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
    if ($ProcessOnPort) {
        Write-Host "⚠️  Killing existing process on port 5173..." -ForegroundColor Yellow
        $ProcessOnPort | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 2
    }

    Write-Host "📦 Starting dev server..." -ForegroundColor Cyan

    # Start dev server in background
    $DevProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -NoNewWindow -PassThru -RedirectStandardOutput $LogFile -RedirectStandardError $LogFile

    Write-Host "⏳ Waiting for dev server to start ($($WaitSeconds) seconds)..." -ForegroundColor Cyan
    Start-Sleep -Seconds $WaitSeconds

    # Check if process is still running
    if ($DevProcess.HasExited) {
        Write-Host "❌ Dev server failed to start" -ForegroundColor Red
        Get-Content $LogFile
        exit 1
    }

    Write-Host "✅ Dev server started successfully (PID: $($DevProcess.Id))" -ForegroundColor Green
    Write-Host ""

    # Wait a bit more for logs to accumulate
    Start-Sleep -Seconds 3

    # Analyze logs
    Write-Host "🔍 Analyzing console output..." -ForegroundColor Cyan
    Write-Host ""

    $LogContent = Get-Content $LogFile -Raw

    # Count initialization occurrences
    $InitCount = ([regex]::Matches($LogContent, "init:1")).Count
    $InitSkipped = ([regex]::Matches($LogContent, "init:skipped")).Count

    # Count CSP warnings
    $CspWarningCount = ([regex]::Matches($LogContent, "Insecure Content-Security-Policy")).Count

    # Count React StrictMode renders
    $AppRenderCount = ([regex]::Matches($LogContent, "\[App\] render")).Count
    $AppContentRenderCount = ([regex]::Matches($LogContent, "\[AppContent\] render")).Count

    # Report results
    Write-Host "📊 Results:" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    $Failed = $false

    # Check initialization count (should be exactly 1)
    if ($InitCount -eq 1) {
        Write-Host "✅ Initialization count: $InitCount (expected: 1)" -ForegroundColor Green
    } else {
        Write-Host "❌ Initialization count: $InitCount (expected: 1)" -ForegroundColor Red
        $Failed = $true
    }

    # Check CSP warnings (should be 0)
    if ($CspWarningCount -eq 0) {
        Write-Host "✅ CSP warnings: $CspWarningCount (expected: 0)" -ForegroundColor Green
    } else {
        Write-Host "❌ CSP warnings: $CspWarningCount (expected: 0)" -ForegroundColor Red
        Write-Host "   Found CSP warnings in console output" -ForegroundColor Yellow
        $Failed = $true
    }

    # Check App render count
    if ($AppRenderCount -ge 1 -and $AppRenderCount -le 4) {
        Write-Host "✅ App renders: $AppRenderCount (acceptable: 1-4 for StrictMode)" -ForegroundColor Green
    } elseif ($AppRenderCount -eq 0) {
        Write-Host "⚠️  App renders: $AppRenderCount (logs may not have appeared yet)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ App renders: $AppRenderCount (acceptable: 1-4, excessive re-renders detected)" -ForegroundColor Red
        $Failed = $true
    }

    # Check AppContent render count
    if ($AppContentRenderCount -ge 1 -and $AppContentRenderCount -le 4) {
        Write-Host "✅ AppContent renders: $AppContentRenderCount (acceptable: 1-4 for StrictMode)" -ForegroundColor Green
    } elseif ($AppContentRenderCount -eq 0) {
        Write-Host "⚠️  AppContent renders: $AppContentRenderCount (logs may not have appeared yet)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ AppContent renders: $AppContentRenderCount (acceptable: 1-4, excessive re-renders detected)" -ForegroundColor Red
        $Failed = $true
    }

    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""

    # Final result
    if (!$Failed) {
        Write-Host "✅ All smoke tests PASSED" -ForegroundColor Green
        Write-Host ""
        Write-Host "Summary:"
        Write-Host "  - Single initialization verified"
        Write-Host "  - No CSP warnings detected"
        Write-Host "  - Render counts are within acceptable range"
        exit 0
    } else {
        Write-Host "❌ Smoke tests FAILED" -ForegroundColor Red
        Write-Host ""
        Write-Host "Issues found:"
        if ($InitCount -ne 1) { Write-Host "  - Multiple initializations detected" }
        if ($CspWarningCount -ne 0) { Write-Host "  - CSP warnings present" }
        if ($AppRenderCount -gt 4) { Write-Host "  - Excessive App re-renders" }
        if ($AppContentRenderCount -gt 4) { Write-Host "  - Excessive AppContent re-renders" }
        Write-Host ""
        Write-Host "Review the log file for details:"
        Write-Host "  $LogFile"
        exit 1
    }
}
finally {
    # Cleanup
    Write-Host "🧹 Cleaning up..." -ForegroundColor Cyan
    if ($DevProcess -and !$DevProcess.HasExited) {
        Stop-Process -Id $DevProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    
    # Clean up log file
    if (Test-Path $LogFile) {
        Remove-Item $LogFile -Force -ErrorAction SilentlyContinue
    }
}

