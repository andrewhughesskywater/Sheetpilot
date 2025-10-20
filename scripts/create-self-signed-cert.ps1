# Self-Signed Certificate Creation Script for Sheetpilot
# Creates a self-signed code signing certificate for development/internal use

param(
    [Parameter(Mandatory=$false)]
    [string]$CertName = "Sheetpilot Development Certificate",
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "certs"
)

Write-Host "Creating self-signed code signing certificate..." -ForegroundColor Cyan

# Create output directory
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

# Generate certificate
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$CertName" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(3) `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

Write-Host "Certificate created successfully!" -ForegroundColor Green
Write-Host "Thumbprint: $($cert.Thumbprint)" -ForegroundColor White

# Export certificate to PFX (for electron-builder)
$pfxPassword = Read-Host "Enter password for PFX file" -AsSecureString
$pfxPath = Join-Path $OutputPath "sheetpilot-cert.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pfxPassword | Out-Null
Write-Host "PFX exported to: $pfxPath" -ForegroundColor Green

# Export certificate to CER (for distribution to trusted machines)
$cerPath = Join-Path $OutputPath "sheetpilot-cert.cer"
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "Public certificate exported to: $cerPath" -ForegroundColor Green

# Display certificate info
Write-Host "`nCertificate Details:" -ForegroundColor Cyan
Get-ChildItem "Cert:\CurrentUser\My\$($cert.Thumbprint)" | Format-List Subject, Thumbprint, NotBefore, NotAfter

Write-Host "`n" + ("=" * 80) -ForegroundColor Yellow
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ("=" * 80) -ForegroundColor Yellow
Write-Host "`n1. Set environment variable for electron-builder:" -ForegroundColor White
Write-Host "   `$env:CERT_PASSWORD = 'your_password_here'" -ForegroundColor Cyan
Write-Host "`n2. Update package.json with certificate path" -ForegroundColor White
Write-Host "`n3. For INTERNAL USE ONLY - distribute $cerPath to all user machines" -ForegroundColor White
Write-Host "   Users must install it to 'Trusted Root Certification Authorities'" -ForegroundColor Yellow
Write-Host "`n4. Build the application:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Cyan
Write-Host "`n" + ("=" * 80) -ForegroundColor Yellow

Write-Host "`nIMPORTANT WARNINGS:" -ForegroundColor Red
Write-Host "- Self-signed certificates do NOT eliminate SmartScreen warnings" -ForegroundColor Yellow
Write-Host "- Self-signed certificates do NOT reduce AV false positives" -ForegroundColor Yellow
Write-Host "- Users will still see 'Unknown Publisher' unless certificate is installed" -ForegroundColor Yellow
Write-Host "- This is ONLY suitable for internal/enterprise deployment" -ForegroundColor Yellow

