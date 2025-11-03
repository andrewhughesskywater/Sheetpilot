# Fix Desktop Shortcut Icon
# This script updates the Sheetpilot desktop shortcut to use the custom icon

$ShortcutPath = "$env:PUBLIC\Desktop\Sheetpilot.lnk"
$UserShortcutPath = "$env:USERPROFILE\Desktop\Sheetpilot.lnk"
$AppPath = "$env:LOCALAPPDATA\Programs\sheetpilot\sheetpilot.exe"

# Find the correct shortcut
$Shortcut = $null
if (Test-Path $ShortcutPath) {
    $Shortcut = $ShortcutPath
} elseif (Test-Path $UserShortcutPath) {
    $Shortcut = $UserShortcutPath
} else {
    Write-Output "No desktop shortcut found"
    exit 0
}

# Create WScript.Shell object
$WScriptShell = New-Object -ComObject WScript.Shell
$ShortcutObj = $WScriptShell.CreateShortcut($Shortcut)

# Check if icon needs updating
$CurrentIcon = $ShortcutObj.IconLocation
if ($CurrentIcon -eq "$AppPath,0") {
    Write-Output "Shortcut icon already correct"
    exit 0
}

# Update the shortcut to point to the exe with the icon
$ShortcutObj.TargetPath = $AppPath
$ShortcutObj.IconLocation = "$AppPath,0"
$ShortcutObj.WorkingDirectory = "$env:LOCALAPPDATA\Programs\sheetpilot"
$ShortcutObj.Save()

Write-Output "Desktop shortcut icon updated"

