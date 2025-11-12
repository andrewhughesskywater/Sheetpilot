# SheetPilot User Guide

**Version:** 1.3.6  
**Last Updated:** November 12, 2025

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Main Features](#main-features)
4. [Timesheet Tab](#timesheet-tab)
5. [Archive Tab](#archive-tab)
6. [Settings Tab](#settings-tab)
7. [Workflows & Best Practices](#workflows--best-practices)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Troubleshooting](#troubleshooting)
10. [Security & Privacy](#security--privacy)
11. [Support & Resources](#support--resources)

---

## Introduction

SheetPilot is a comprehensive desktop application designed to streamline timesheet management and automate submission to SmartSheet. Built with Electron, SheetPilot provides a modern, efficient interface for tracking time entries with features like smart data entry, validation, and secure credential storage.

### What SheetPilot Does

- **Track Time:** Enter and manage daily time entries in an intuitive spreadsheet interface
- **Validate Data:** Real-time validation ensures accurate data before submission
- **Automate Submission:** Automatically submit timesheet entries to SmartSheet
- **Store Securely:** Encrypted local storage for credentials and timesheet data
- **Archive History:** View all previously submitted timesheet entries

---

## Getting Started

### First-Time Setup

1. **Launch SheetPilot**
   - Open the application from your desktop or start menu
   - Wait for the application to check for updates

2. **Log In**
   - The login dialog will appear automatically
   - Admin users must set the `SHEETPILOT_ADMIN_PASSWORD` environment variable
   - Regular users will create their own credentials

3. **Start Using SheetPilot**
   - Navigate to the **Timesheet** tab
   - Begin entering your time entries

---

## Main Features

### Core Capabilities

#### 1. Secure Credential Storage

- SmartSheet credentials are encrypted using a machine-specific master key
- All credential data is stored locally on your device
- No credentials are transmitted to external servers (except during SmartSheet authentication)
- Update credentials anytime from the Settings tab

#### 2. Timesheet Management

- Spreadsheet-style grid interface powered by Handsontable
- Real-time data validation with visual feedback
- Smart date suggestions based on weekday patterns
- Spell-checking for task descriptions
- Macro support for frequently-used entries
- Auto-save to local SQLite database
- Keyboard shortcuts for efficient data entry

#### 3. SmartSheet Integration

- One-click submission to SmartSheet
- Automatic validation before submission
- Progress tracking during submission
- Detailed error reporting
- Prevents duplicate submissions
- Headless or visible browser mode

#### 4. Submission Archive

- View all previously submitted timesheet entries
- Search and filter archived data
- Export capabilities (future enhancement)
- Submission timestamp tracking

#### 5. Performance Optimized

- Fast startup time
- Responsive UI with non-blocking operations
- Efficient batch database operations
- Minimal memory footprint

#### 6. Local Data Storage

- SQLite database for all timesheet data
- Local backup in localStorage
- No cloud dependencies
- Full offline access to data

#### 7. Automatic Updates

- Built-in auto-update system
- Download progress indication
- Seamless installation process
- Update notifications

---

## Timesheet Tab

The Timesheet tab is where you enter, edit, and submit your time entries.

### Grid Interface

The timesheet uses a spreadsheet-style grid with the following columns:

| Column | Description | Format | Required |
|--------|-------------|--------|----------|
| **Date** | Work date | MM/DD/YYYY | Yes |
| **Time In** | Start time | HH:MM (24-hour) | Yes |
| **Time Out** | End time | HH:MM (24-hour) | Yes |
| **Hours** | Duration (auto-calculated) | Decimal | Yes |
| **Project** | Project code | Dropdown | Yes |
| **Tool** | Tool name (project-specific) | Dropdown | Conditional |
| **Detail Charge Code** | Charge code (tool-specific) | Dropdown | Conditional |
| **Task Description** | Description of work | Text | Yes |

### Entering Data

#### Manual Entry

1. Click on a cell to select it
2. Type your data
3. Press **Enter** or **Tab** to move to the next cell
4. Data is automatically saved to the local database

#### Using Macros

1. Press **Ctrl+Shift+M** to open the Macro Manager
2. Create macros for frequently-used entries
3. Apply macros to quickly populate rows
4. Macros can include all fields except the date

#### Smart Date Suggestions

- SheetPilot detects weekday patterns in your entries
- When adding new rows, it suggests the next logical work date
- Automatically skips weekends if you consistently work weekdays
- Visible as placeholder text in empty date cells

#### Time Input

- Enter times in 24-hour format (e.g., 08:00, 17:30)
- SheetPilot automatically formats and validates time entries
- Hours are calculated automatically based on Time In and Time Out
- Red highlighting indicates invalid time entries

#### Project Selection

- Click the dropdown arrow or type to filter projects
- Some projects require tool selection
- Tool options change based on the selected project
- Charge codes appear based on the selected tool

### Data Validation

SheetPilot validates your data in real-time:

#### Visual Feedback

- **Red highlight:** Invalid or missing data
- **Normal appearance:** Valid data
- **Validation errors:** Displayed at the bottom of the grid

#### Validation Rules

- **Date:** Must be a valid date in MM/DD/YYYY format
- **Time In/Out:** Must be valid times; Time Out must be after Time In
- **Hours:** Must be positive and match Time In/Out difference
- **Project:** Must be a valid project from the dropdown
- **Tool:** Required for certain projects
- **Charge Code:** Required for certain tools
- **Task Description:** Cannot be empty
- **Overlap:** Prevents time entries that overlap with existing entries

### Submitting Your Timesheet

1. **Review Your Entries**
   - Ensure all rows have valid data (no red highlights)
   - Check that hours total correctly
   - Verify project codes and descriptions are accurate

2. **Click Submit Timesheet**
   - Located at the bottom of the Timesheet tab
   - Button changes color based on validation status:
     - **Green (Ready):** All entries valid, ready to submit
     - **Yellow (Warning):** Some entries may have issues
     - **Gray (Neutral):** No entries or processing

3. **Monitor Progress**
   - A progress bar appears showing submission status
   - Individual entry results are logged
   - Errors are displayed if any entries fail

4. **Verify Submission**
   - Navigate to the **Archive** tab
   - Confirm your entries appear with submission timestamps
   - Check SmartSheet directly if needed

### Spell-Checking

- Task descriptions have built-in spell-checking
- Misspelled words are underlined in red
- Right-click misspelled words for suggestions (browser-dependent)
- Helps maintain professional, accurate descriptions

### Available Shortcuts

See [Keyboard Shortcuts](#keyboard-shortcuts) section for a complete list.

---

## Archive Tab

The Archive tab displays all timesheet entries that have been submitted to SmartSheet.

### Features

#### View Submitted Entries

- Displays all historical timesheet entries
- Shows submission timestamps
- Read-only grid interface
- Same columns as the Timesheet tab

#### Search and Filter

- Scroll through historical data
- Sort by clicking column headers
- Find specific entries quickly

#### Export (Future Enhancement)

- CSV export functionality planned
- Will allow external analysis
- Backup capabilities

### Understanding the Archive

- **Automatic Updates:** Archive refreshes when you navigate to the tab
- **Submission Status:** Only successfully submitted entries appear
- **No Editing:** Archive entries cannot be modified (edit in SmartSheet if needed)
- **Local Storage:** All archive data is stored in your local SQLite database

---

## Settings Tab

The Settings tab provides access to application configuration, credential management, and support tools.

### Available Options

#### 1. Export Logs

- Downloads application logs for troubleshooting
- Includes error messages and diagnostic information
- Exports the latest log file as a text file
- Useful when requesting technical support

#### 2. Update Credentials

- Add or update your SmartSheet credentials
- Email field auto-completes @skywatertechnology.com domain
- Password is encrypted before storage
- Updates take effect immediately
- Required if you change your SmartSheet password

#### 3. User Guide

- Opens the in-application user manual
- Comprehensive documentation of all features
- Includes troubleshooting tips
- Searchable by section

#### 4. Application Settings

##### Browser Settings

- **Headless Mode:** Run browser automation without visible windows
  - **Enabled (default):** Browser runs in the background during submission
  - **Disabled:** Browser window is visible during submission (useful for troubleshooting)
  - Changes take effect on next timesheet submission

#### 5. About SheetPilot

- Displays application version
- Shows creator information
- Provides application description

#### 6. Logout

- Logs out of the current session
- Returns to the login screen
- Does not delete stored credentials or data

#### 7. Admin Tools (Admin Users Only)

⚠️ **Warning:** Admin users cannot submit timesheet entries to SmartSheet

Available admin operations:

##### Clear All Credentials

- Permanently deletes all stored credentials
- Users must re-enter credentials to submit timesheets
- Cannot be undone
- Use when troubleshooting credential issues

##### Rebuild Database

- **DESTRUCTIVE OPERATION**
- Permanently deletes ALL timesheet entries and credentials
- Resets database to a clean state
- Cannot be undone
- Use only for critical database corruption issues
- Create backups before using this feature

---

## Workflows & Best Practices

### Daily Workflow

#### Morning Routine

1. Open SheetPilot
2. Navigate to the Timesheet tab
3. Review any existing entries from previous days
4. Prepare to log time as you work

#### Throughout the Day

1. Log time entries as you complete tasks
2. Use descriptive task descriptions
3. Ensure accurate project codes
4. Verify time durations

#### End of Day

1. Review all entries for accuracy
2. Fix any validation errors (red highlights)
3. SheetPilot auto-saves your work
4. Close the application when finished

### Weekly Submission Process

#### Recommended Schedule

- Submit timesheets weekly (typically Friday afternoon or Monday morning)
- Check with your supervisor for specific submission deadlines
- Review the entire week before submitting

#### Submission Steps

1. **Review All Entries**
   - Open the Timesheet tab
   - Scroll through the week's entries
   - Verify all dates, times, projects, and descriptions
   - Check that hours total correctly (typically 40 hours/week)

2. **Fix Validation Errors**
   - Look for red highlights indicating errors
   - Review validation error messages at the bottom
   - Correct any missing or invalid data

3. **Submit**
   - Click the "Submit Timesheet" button
   - Wait for the progress bar to complete
   - Review any error messages if entries fail

4. **Verify**
   - Navigate to the Archive tab
   - Confirm all entries appear with timestamps
   - Optionally check SmartSheet directly

### Best Practices

#### Data Entry Tips

- ✅ Log time entries daily to avoid forgetting tasks
- ✅ Use clear, descriptive task descriptions
- ✅ Be specific with project codes
- ✅ Round times to appropriate increments
- ✅ Double-check dates and times before submitting

#### Organization

- ✅ Create macros for repetitive entries
- ✅ Organize your timesheet chronologically
- ✅ Review and correct entries before end of day
- ✅ Keep project codes consistent

#### Security

- ✅ Update credentials immediately if your password changes
- ✅ Log out when leaving your computer unattended
- ✅ Keep your operating system and security software updated
- ✅ Never share your SmartSheet credentials

#### Problem Resolution

- ✅ Enable visible browser mode if submissions fail
- ✅ Export logs when reporting issues
- ✅ Check validation errors before submitting
- ✅ Verify internet connectivity for submissions

---

## Keyboard Shortcuts

SheetPilot includes numerous keyboard shortcuts for efficient data entry.

### General Navigation

| Shortcut | Action |
|----------|--------|
| **Tab** | Move to next cell (right) |
| **Shift+Tab** | Move to previous cell (left) |
| **Enter** | Move to next row (down) |
| **Shift+Enter** | Move to previous row (up) |
| **Arrow Keys** | Navigate between cells |
| **Home** | Jump to first cell in row |
| **End** | Jump to last cell in row |
| **Page Up** | Scroll up one page |
| **Page Down** | Scroll down one page |

### Editing

| Shortcut | Action |
|----------|--------|
| **F2** | Enter edit mode on selected cell |
| **Delete** | Clear selected cell(s) |
| **Backspace** | Clear cell and enter edit mode |
| **Escape** | Cancel editing |
| **Ctrl+C** | Copy selected cell(s) |
| **Ctrl+V** | Paste into selected cell(s) |
| **Ctrl+X** | Cut selected cell(s) |
| **Ctrl+Z** | Undo last change |
| **Ctrl+Y** | Redo last undone change |

### Selection

| Shortcut | Action |
|----------|--------|
| **Ctrl+A** | Select all cells |
| **Shift+Arrow Keys** | Extend selection |
| **Ctrl+Space** | Select entire column |
| **Shift+Space** | Select entire row |

### Data Entry Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+Shift+M** | Open Macro Manager |
| **Alt+Down** | Open dropdown (Project, Tool, Charge Code) |

### Application

| Shortcut | Action |
|----------|--------|
| **Ctrl+S** | Manual save (auto-save is enabled) |
| **Ctrl+R** | Refresh current tab |
| **Ctrl+Q** | Quit application |

---

## Troubleshooting

### Authentication Issues

#### Invalid Credentials Error

**Symptoms:**

- Cannot log in
- Submission fails with authentication error
- "Invalid credentials" message

**Solutions:**

1. Verify your SmartSheet email and password are correct
2. Navigate to Settings → Update Credentials
3. Re-enter your email and password
4. Ensure your SmartSheet account is active
5. Contact IT if password reset is needed

#### Connection Timeout

**Symptoms:**

- Submission hangs or times out
- Cannot connect to SmartSheet
- Network-related error messages

**Solutions:**

1. Check your internet connection
2. Verify SmartSheet website is accessible in a browser
3. Check for firewall or antivirus blocking (see [Antivirus Compatibility](#antivirus-compatibility))
4. Wait a few minutes and try again
5. Contact IT if issue persists

### Submission Issues

#### Some Entries Failed to Submit

**Symptoms:**

- Progress bar shows partial success
- Error messages in submission log
- Not all entries appear in Archive

**Solutions:**

1. Check validation errors at bottom of Timesheet tab
2. Common causes:
   - Missing required fields (project, description)
   - Invalid time format
   - Time overlap with existing entries
   - Date out of acceptable range
3. Fix highlighted errors (red cells)
4. Click Submit again (only failed entries will resubmit)

#### No Entries to Submit

**Symptoms:**

- Submit button is disabled or shows "No entries"
- Nothing happens when clicking Submit

**Solutions:**

1. Ensure you have timesheet entries in the Timesheet tab
2. Check that entries have not already been submitted
3. Verify entries have valid data (no red highlights)
4. Refresh the Timesheet tab (Ctrl+R)

#### Browser Automation Fails

**Symptoms:**

- Browser opens but doesn't navigate
- Submission fails during browser automation
- Timeout during form filling

**Solutions:**

1. Navigate to Settings → Application Settings
2. Disable Headless Mode to see what the browser is doing
3. Check for SmartSheet website changes
4. Ensure SmartSheet is accessible
5. Export logs and contact support if issue persists

### Application Issues

#### Application Won't Start

**Symptoms:**

- Application doesn't launch
- Crash on startup
- Blank/white screen

**Solutions:**

1. Restart your computer
2. Check Task Manager for hung SheetPilot processes
3. End any hung processes
4. Try launching again
5. Reinstall SheetPilot if issue persists
6. Contact IT for assistance

#### Data Not Loading

**Symptoms:**

- Empty grid on Timesheet tab
- Archive tab shows no data
- "Error loading data" message

**Solutions:**

1. Check database file integrity
2. Navigate to Settings → Export Logs to check for errors
3. Refresh the tab (Ctrl+R)
4. Restart SheetPilot
5. If admin: consider Rebuild Database (DESTRUCTIVE)

#### Performance Issues

**Symptoms:**

- Slow response times
- Lag when typing
- Application freezes

**Solutions:**

1. Close other applications to free memory
2. Restart SheetPilot
3. Restart your computer
4. Check for excessive log files
5. Contact IT if issue persists

### Validation Errors

#### Red Highlighted Cells

**Symptoms:**

- Cells appear with red background
- Validation error messages at bottom

**Solutions:**

1. Read the validation error message
2. Common validation errors:
   - **Invalid date:** Use MM/DD/YYYY format
   - **Invalid time:** Use HH:MM 24-hour format (e.g., 17:30, not 5:30 PM)
   - **Time Out before Time In:** Ensure end time is after start time
   - **Missing project:** Select a project from dropdown
   - **Missing tool:** Some projects require tool selection
   - **Missing charge code:** Some tools require charge code
   - **Empty description:** Add a task description
   - **Time overlap:** Entry overlaps with another entry
3. Correct the highlighted cell
4. Validation updates in real-time

### Antivirus Compatibility

SheetPilot uses browser automation (Playwright) which some antivirus software may flag as suspicious behavior.

#### Known Issues

- **Sophos Antivirus:** May block browser automation
- **Enterprise Antivirus Solutions:** May quarantine SheetPilot components

#### Solutions

1. Add SheetPilot to antivirus exceptions/exclusions
2. Contact IT to whitelist SheetPilot
3. Reference internal security review documentation
4. See [docs/SOPHOS_CONFIGURATION.md](../docs/SOPHOS_CONFIGURATION.md) for details

### Getting Additional Help

If you continue to experience issues after trying these solutions:

#### Steps to Get Support

1. **Export Logs**
   - Navigate to Settings → Export Logs
   - Save the log file
   - Provide logs to IT when reporting issues

2. **Document the Issue**
   - Note the exact error message
   - Document steps to reproduce
   - Take screenshots if applicable
   - Note when the issue started

3. **Contact Support**
   - Contact your system administrator
   - Provide exported logs
   - Describe troubleshooting steps already attempted

4. **Check Resources**
   - Review this User Guide
   - Check Settings → User Guide for in-app documentation
   - Verify SmartSheet permissions with your supervisor

---

## Security & Privacy

SheetPilot is designed with security and privacy as core priorities.

### Data Security Measures

#### Local Data Storage

- **All timesheet data and credentials are stored locally on your device**
- Uses SQLite database for reliable, fast storage
- No data transmitted to external servers (except SmartSheet during submission)
- Data remains on your machine even when offline
- Full control over your data

#### Encrypted Credentials

- SmartSheet credentials are encrypted before storage
- Encryption uses AES-256 with machine-specific master key
- Master key derived from system identifiers
- Password never stored in plain text
- Decryption only possible on your machine

#### Secure Communication

- All communication with SmartSheet uses HTTPS encryption
- Credentials only transmitted during authentication
- No man-in-the-middle vulnerability
- Secure TLS protocol for all network requests

#### No Data Collection

- SheetPilot does not collect usage analytics
- No telemetry or tracking
- No personal information transmitted to external services
- Logs are stored locally only
- Your privacy is protected

### Privacy Best Practices

#### Credential Management

- ✅ Update credentials immediately if your SmartSheet password changes
- ✅ Never share your SmartSheet credentials with others
- ✅ Use a strong, unique password for SmartSheet
- ✅ Change credentials periodically as per company policy

#### Device Security

- ✅ Ensure your device is secured with a strong password
- ✅ Enable screen lock when away from device
- ✅ Keep antivirus and security software up to date
- ✅ Lock computer when leaving desk

#### Data Management

- ✅ Consider regular backups of timesheet data
- ✅ Export logs only when needed for troubleshooting
- ✅ Be cautious when using SheetPilot on shared computers
- ✅ Log out when using SheetPilot on public/shared devices

#### Application Updates

- ✅ Allow SheetPilot to install updates automatically
- ✅ Updates include security patches
- ✅ Review update notifications
- ✅ Restart application after updates

### Security Warnings

#### ⚠️ Important Security Notes

##### Credentials

- Never share your SmartSheet credentials with others
- Never write passwords on paper or store unencrypted
- Use company-approved password management if available

##### Keep Your Device Secure

- Keep operating system and security software updated
- Enable automatic security updates
- Use company-provided antivirus software

##### Public Computers

- Avoid using SheetPilot on public or shared computers
- If necessary, log out and close application when finished
- Do not save credentials on shared machines

##### Suspicious Activity

- Report any suspicious behavior immediately
- Contact IT if credentials may have been compromised
- Change SmartSheet password if security is suspected

### Compliance

SheetPilot complies with organizational security requirements:

- Local-only data storage
- Encrypted credential storage
- Secure communication protocols
- No external data transmission (except SmartSheet)
- Regular security updates

For specific security questions or concerns, contact your IT security team.

---

## Support & Resources

### Getting Help

#### In-Application Resources

##### User Guide (Settings → User Guide)

- Comprehensive documentation of all features
- Troubleshooting tips
- Best practices
- Always available within the application

##### Application Logs (Settings → Export Logs)

- Detailed error information
- Diagnostic data for troubleshooting
- Essential when reporting issues
- Includes timestamps and error stack traces

#### External Resources

##### System Administrator

- Primary point of contact for technical issues
- Can assist with:
  - Installation and setup
  - Credential issues
  - Database problems
  - Antivirus configuration
  - Network/connectivity issues

##### SmartSheet Support

- For SmartSheet-specific issues
- Account access problems
- SmartSheet website issues
- Form submission problems on SmartSheet side

##### IT Security Team

- Security-related concerns
- Antivirus exceptions/whitelisting
- Credential compromise
- Security policy questions

### Frequently Asked Questions

#### Q: How often should I submit my timesheet?

**A:** Most organizations require weekly submissions. Check with your supervisor or HR department for specific requirements. SheetPilot supports submitting as often as needed without restrictions.

#### Q: Can I edit entries after they've been submitted?

**A:** Once entries are submitted to SmartSheet, you cannot edit them through SheetPilot. You would need to make changes directly in SmartSheet or contact your timesheet administrator. The Archive tab is read-only.

#### Q: What happens if my internet connection is lost during submission?

**A:** SheetPilot will display an error message for entries that failed to submit. Check your connection and try submitting again. The application tracks which entries were successful, so you won't create duplicates by resubmitting.

#### Q: Can I use SheetPilot on multiple devices?

**A:** SheetPilot stores data locally on each device. You'll need to install the application and configure credentials separately on each device. Data does not sync between devices automatically. Consider exporting and importing data if needed (future enhancement).

#### Q: Why can't admin users submit timesheets?

**A:** Admin users are designed for system administration tasks only. This prevents admin credentials from being used for regular timesheet submission and maintains separation of duties. Regular users should be used for timesheet submission.

#### Q: How do I know if my timesheet was successfully submitted?

**A:** After clicking Submit, monitor the progress bar. Successful submissions will appear in the Archive tab with a submission timestamp. You can also verify directly in SmartSheet.

#### Q: What do I do if the browser automation fails?

**A:** Try disabling Headless Mode in Settings → Application Settings. This allows you to see the browser during automation and identify where the process is failing. Export logs and contact your system administrator with details.

#### Q: How secure are my credentials?

**A:** Very secure. Credentials are encrypted with AES-256 encryption using a machine-specific master key. They are stored locally only and never transmitted except during SmartSheet authentication over HTTPS.

#### Q: Can I export my timesheet data for backup?

**A:** CSV export functionality is planned for a future release. Currently, all data is stored in a local SQLite database. Contact your system administrator for database backup options.

#### Q: Why do I see red highlights on some cells?

**A:** Red highlights indicate validation errors. Read the error message at the bottom of the Timesheet tab and correct the invalid data. Common issues include missing required fields, invalid date/time formats, or time overlaps.

#### Q: What should I do if SheetPilot won't start?

**A:**

1. Restart your computer
2. Check Task Manager for hung processes
3. Try reinstalling SheetPilot
4. Contact your system administrator
5. Check antivirus logs for blocked components

#### Q: How do I update SheetPilot?

**A:** SheetPilot includes automatic update functionality. When an update is available, you'll see a notification. The application will download and install updates automatically. Simply restart when prompted.

#### Q: Can I customize the project codes or tools?

**A:** Project codes, tools, and charge codes are configured at the application level and cannot be customized by individual users. Contact your administrator if project codes need to be added or modified.

### Application Information

**Application:** SheetPilot  
**Version:** 1.3.6  
**Platform:** Electron Desktop Application  
**Database:** SQLite (Local Storage)  
**Integration:** SmartSheet (via Playwright Browser Automation)  
**Creator:** Andrew Hughes  
**Purpose:** Automate timesheet data entry into SmartSheet web forms

### Technical Details

**Built With:**

- Frontend: React + TypeScript + Vite
- Backend: Electron + Node.js
- Database: SQLite (better-sqlite3)
- Automation: Playwright
- Grid: Handsontable 16.1.1
- Design: Material Design 3
- Updates: electron-updater

**System Requirements:**

- Windows 10 or later
- 4GB RAM minimum
- 500MB disk space
- Internet connection (for SmartSheet submission)

### Documentation

- **User Guide:** This document
- **Developer Wiki:** [docs/DEVELOPER_WIKI.md](./DEVELOPER_WIKI.md)
- **Architecture:** [docs/ARCHITECTURE_DOCS.md](./ARCHITECTURE_DOCS.md)
- **Changelog:** [docs/CHANGELOG.md](./CHANGELOG.md)
- **Sophos Configuration:** [docs/SOPHOS_CONFIGURATION.md](./SOPHOS_CONFIGURATION.md) (if applicable)

### Contact Information

For assistance with SheetPilot:

1. Review this User Guide
2. Check the in-application User Guide (Settings → User Guide)
3. Export logs (Settings → Export Logs)
4. Contact your system administrator with exported logs and error details

---

## Appendix

### Date Format Reference

SheetPilot accepts dates in the following format:

- **Display Format:** MM/DD/YYYY
- **Examples:** 01/15/2025, 12/31/2024, 11/12/2025
- **Entry:** Type numbers with slashes
- **Validation:** Must be a valid calendar date

### Time Format Reference

SheetPilot uses 24-hour time format:

- **Format:** HH:MM
- **Examples:** 08:00 (8:00 AM), 17:30 (5:30 PM), 00:00 (midnight), 23:59 (11:59 PM)
- **Entry:** Type numbers with colon separator
- **Validation:** Time Out must be after Time In

### Project Code Reference

Project codes are predefined in the application. Common project categories:

- Engineering projects
- Manufacturing operations
- Administrative tasks
- Tool-specific projects
- General overhead

Consult your supervisor for appropriate project codes for your work.

### Validation Error Reference

Common validation errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid date | Incorrect date format or invalid date | Use MM/DD/YYYY format |
| Invalid time | Incorrect time format | Use HH:MM 24-hour format |
| Time Out before Time In | End time earlier than start time | Correct time order |
| Missing project | No project selected | Select from dropdown |
| Missing tool | Tool required for project | Select appropriate tool |
| Missing charge code | Charge code required for tool | Select from dropdown |
| Empty description | Task description is blank | Add description |
| Time overlap | Entry overlaps existing entry | Adjust times to avoid overlap |
| Invalid hours | Hours don't match time difference | Check Time In and Time Out |

### Macro Reference

Macros allow you to save frequently-used timesheet entries for quick reuse.

#### Creating a Macro

1. Press Ctrl+Shift+M to open Macro Manager
2. Click "Add Macro"
3. Fill in:
   - Project
   - Tool (if applicable)
   - Charge Code (if applicable)
   - Task Description
4. Give your macro a name
5. Click Save

#### Using a Macro

1. Select a row in the Timesheet
2. Open Macro Manager (Ctrl+Shift+M)
3. Click on a saved macro
4. Fields are populated (except date)
5. Add date and times manually

#### Managing Macros

- Edit macros by clicking Edit button
- Delete unused macros
- Macros are stored locally per device

---

## End of User Guide

For the latest version of this guide, check the docs folder in the SheetPilot installation directory or access the in-application User Guide from the Settings tab.

Last Updated: November 12, 2025 | Version 1.3.6
