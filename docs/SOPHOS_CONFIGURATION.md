# Sophos Antivirus Configuration for Sheetpilot

## Issue

Sophos may flag Sheetpilot as malicious due to browser automation features.

## Solution: Add Exclusions

### Path Exclusions

1. Navigate to Sophos Central > Global Settings > Exclusions
2. Add the following paths:
   - `C:\Users\*\AppData\Local\Programs\Sheetpilot\**`
   - `C:\Users\*\AppData\Roaming\SheetPilot\**`

### Process Exclusions

1. Add exclusion for: `Sheetpilot.exe`
2. Scope: All scanning (on-access, on-demand)

### Verification

After adding exclusions, reinstall or run Sheetpilot. Monitor Sophos Events log to confirm no further detections.

## Alternative: Submit False Positive Report

If exclusions are not feasible, submit a false positive report to Sophos:

1. Visit: <https://support.sophos.com/support/s/filesubmission>
2. Provide the following information:
   - **Application**: Sheetpilot.exe
   - **Developer**: SheetPilot Team
   - **Purpose**: Business timesheet management and data entry automation
   - **Detection**: "Lockdown" behavioral prevention
   - **Justification**: Legitimate Electron-based business application using Playwright for SmartSheet integration

3. **Files to submit**: Built executable from `build/Sheetpilot Setup 1.0.0.exe`

## Technical Details

Sheetpilot is a legitimate business application that:

- Manages timesheet data entry and reporting
- Uses Playwright for automated form filling on SmartSheet
- Operates within standard business software parameters
- Does not perform malicious activities

The "Lockdown" detection is a false positive triggered by:

- Browser automation behavior patterns
- Network file operations (now disabled by default)
- Unsigned executable status

## Contact Information

For questions about this configuration, contact your IT administrator or the SheetPilot development team.
