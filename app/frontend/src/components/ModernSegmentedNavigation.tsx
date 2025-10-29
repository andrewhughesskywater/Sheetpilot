/**
 * Modern Material Design 3 Segmented Button Navigation
 * Shape-morphing button group where selected button pops out
 */

import { ToggleButtonGroup, ToggleButton } from '@mui/material';
import './ModernSegmentedNavigation.css';

interface ModernSegmentedNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

const navigationItems = [
  { label: 'Timesheet', index: 0 },
  { label: 'Archive', index: 1 },
  { label: 'Help', index: 2 }
];

export default function ModernSegmentedNavigation({ 
  activeTab, 
  onTabChange 
}: ModernSegmentedNavigationProps) {
  return (
    <div className="modern-segmented-container">
      <ToggleButtonGroup
        value={activeTab}
        exclusive
        onChange={(_event, newValue) => {
          if (newValue !== null) {
            onTabChange(newValue);
          }
        }}
        aria-label="Navigation"
        className="modern-segmented-group"
      >
        {navigationItems.map((item, index) => (
          <ToggleButton
            key={item.index}
            value={item.index}
            aria-label={item.label}
            className="modern-segmented-button"
            data-position={
              index === 0 ? 'first' : 
              index === navigationItems.length - 1 ? 'last' : 
              'middle'
            }
          >
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
