/**
 * @fileoverview About Body Component
 *
 * Displays application branding, version, and author information.
 * Used in both splash screen and settings about dialog.
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import logoImage from "@/assets/images/logo.svg";
import { APP_VERSION } from "@sheetpilot/shared";

/**
 * About dialog content component
 *
 * Displays application branding, version, and author information.
 * Used in both splash screen and settings about dialog.
 *
 * @returns About content with logo, version, and description
 */
export function AboutBody() {
  return (
    <Box className="about-dialog-content">
      <img
        src={logoImage}
        alt="SheetPilot Logo"
        className="about-dialog-logo"
      />
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Version {APP_VERSION}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Created by Andrew Hughes
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        className="about-dialog-description"
      >
        Automate timesheet data entry into web forms
      </Typography>
    </Box>
  );
}
