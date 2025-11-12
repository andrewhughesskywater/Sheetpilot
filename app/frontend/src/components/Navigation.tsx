/**
 * Navigation Component
 * Simple MUI Tabs-based navigation
 */

import React from 'react';
import { Tabs, Tab, Box } from '@mui/material';
import { Schedule as ScheduleIcon, Archive as ArchiveIcon, Settings as SettingsIcon } from '@mui/icons-material';

interface NavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    onTabChange(newValue);
  };

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs 
        value={activeTab} 
        onChange={handleChange} 
        centered
        aria-label="navigation tabs"
      >
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

