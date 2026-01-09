/**
 * @fileoverview Settings helper components and utility functions
 */

import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { type FeatureCardProps, type SettingsCardsGridProps } from './SettingsTypes';

export function FeatureCard({ title, className, onActivate }: FeatureCardProps) {
  return (
    <Box
      className={className ? `settings-feature-card ${className}` : 'settings-feature-card'}
      onClick={onActivate}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onActivate()}
    >
      <Typography variant="h6" component="h2" className="settings-feature-card-title">
        {title}
      </Typography>
    </Box>
  );
}

export function SettingsHeader() {
  return (
    <Box className="settings-section-header">
      <Box className="settings-section-icon">
        <SettingsIcon sx={{ fontSize: 48 }} />
      </Box>
      <Typography variant="h4" component="h1" className="settings-section-title">
        Settings
      </Typography>
      <Typography variant="body1" className="settings-section-subtitle">
        Configure application settings, manage credentials, and access support tools. SheetPilot ensures accurate
        logging of every minute, designed specifically for SkyWater Technology&apos;s manufacturing excellence
        standards.
      </Typography>
    </Box>
  );
}

export function SettingsCardsGrid({
  isAdmin,
  onOpenLogs,
  onOpenUpdateCredentials,
  onOpenUserGuide,
  onOpenSettings,
  onOpenAbout,
  onLogout,
  onOpenAdminTools,
}: SettingsCardsGridProps) {
  return (
    <Box className="settings-cards-grid">
      <FeatureCard title="Export Logs" onActivate={onOpenLogs} />
      <FeatureCard title="Update Credentials" onActivate={onOpenUpdateCredentials} />
      <FeatureCard title="User Guide" onActivate={onOpenUserGuide} />
      <FeatureCard title="Application Settings" onActivate={onOpenSettings} />
      <FeatureCard title="About SheetPilot" onActivate={onOpenAbout} />
      <FeatureCard title="Logout" className="settings-feature-card-warning" onActivate={onLogout} />

      {isAdmin && (
        <FeatureCard title="Admin Tools" className="settings-feature-card-admin" onActivate={onOpenAdminTools} />
      )}
    </Box>
  );
}
