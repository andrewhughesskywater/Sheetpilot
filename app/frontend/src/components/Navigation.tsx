/**
 * @fileoverview Navigation Component
 *
 * Tab-based navigation bar using Material-UI Tabs.
 * Provides access to Timesheet, Archive, and Settings pages.
 */

import ArchiveIcon from '@mui/icons-material/Archive';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import React from 'react';

interface NavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

/**
 * Navigation tabs component
 *
 * @param props - Component props
 * @param props.activeTab - Currently active tab index (0-2)
 * @param props.onTabChange - Callback fired when tab changes
 * @returns Navigation tab bar
 */
export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onTabChange(newValue);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs value={activeTab} onChange={handleChange} centered aria-label="navigation tabs">
        <Tab
          icon={<ScheduleIcon />}
          label="Timesheet"
          iconPosition="start"
          id="nav-tab-0"
          aria-controls="nav-tabpanel-0"
        />
        <Tab
          icon={<ArchiveIcon />}
          label="Archive"
          iconPosition="start"
          id="nav-tab-1"
          aria-controls="nav-tabpanel-1"
        />
        <Tab
          icon={<SettingsIcon />}
          label="Settings"
          iconPosition="start"
          id="nav-tab-2"
          aria-controls="nav-tabpanel-2"
        />
      </Tabs>
    </Box>
  );
}
