import { type ReactElement } from 'react';
import { Button } from '@mui/material';
import { Save as SaveIcon, Cloud as CloudIcon, Error as ErrorIcon } from '@mui/icons-material';
import type { SaveStatus } from './timesheet.persistence';
import './SaveStatusButton.css';

interface SaveStatusButtonProps {
  status: SaveStatus;
  onClick: () => void;
  disabled?: boolean;
}

interface ButtonConfig {
  label: string;
  icon: ReactElement;
  className: string;
  ariaLabel: string;
}

export default function SaveStatusButton({ status, onClick, disabled }: SaveStatusButtonProps) {
  const getButtonConfig = (): ButtonConfig => {
    switch (status) {
      case 'local':
        return {
          label: 'Saved Locally',
          icon: <SaveIcon />,
          className: 'save-status-local',
          ariaLabel: 'Changes saved to local cache only. Click to save to database.'
        };
      case 'database':
        return {
          label: 'Saved to Database',
          icon: <CloudIcon />,
          className: 'save-status-database',
          ariaLabel: 'All changes saved to database'
        };
      case 'error':
        return {
          label: 'Save Error',
          icon: <ErrorIcon />,
          className: 'save-status-error',
          ariaLabel: 'Error saving to database. Click to retry.'
        };
    }
  };

  const config = getButtonConfig();

  return (
    <Button
      variant="contained"
      size="large"
      className={`save-status-button ${config.className}`}
      startIcon={config.icon}
      onClick={onClick}
      disabled={disabled}
      aria-label={config.ariaLabel}
      title={config.ariaLabel}
    >
      {config.label}
    </Button>
  );
}

