# Enterprise Certificate Installation Script
# Install the self-signed certificate on user machines
# Run this with Administrator privileges

param(
    [Parameter(Mandatory=$true)]
    [string]$CertPath
)

# Check if running as Administrator
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $CertPath)) {
    Write-Host "ERROR: Certificate file not found: $CertPath" -ForegroundColor Red
    exit 1
}

Write-Host "Installing Sheetpilot certificate..." -ForegroundColor Cyan

try {
    # Import certificate to Trusted Root Certification Authorities (machine-wide)
    Import-Certificate -FilePath $CertPath -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
    
    Write-Host "Certificate installed successfully!" -ForegroundColor Green
    Write-Host "Sheetpilot executables signed with this certificate will now be trusted." -ForegroundColor White
    
    # Display installed certificate
    $cert = Get-PfxCertificate -FilePath $CertPath
    Write-Host "`nCertificate Details:" -ForegroundColor Cyan
    Write-Host "Subject: $($cert.Subject)" -ForegroundColor White
    Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor White
    Write-Host "Valid Until: $($cert.NotAfter)" -ForegroundColor White
    
} catch {
    Write-Host "ERROR: Failed to install certificate" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`nNOTE: This only trusts the certificate on THIS machine." -ForegroundColor Yellow
Write-Host "Deploy via Group Policy for enterprise-wide trust." -ForegroundColor Yellow

