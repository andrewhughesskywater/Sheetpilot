/**
 * Modern Material Design 3 Segmented Button Navigation
 * Using Radix UI for better accessibility and modern styling
 */

import * as Toolbar from '@radix-ui/react-toolbar';
import './ModernSegmentedNavigation.css';

interface ModernSegmentedNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

const navigationItems = [
  { label: 'Home', index: 0 },
  { label: 'Timesheet', index: 1 },
  { label: 'Archive', index: 2 },
  { label: 'Help', index: 3 }
];

export default function ModernSegmentedNavigation({ 
  activeTab, 
  onTabChange 
}: ModernSegmentedNavigationProps) {
  return (
    <div className="modern-segmented-container">
      <Toolbar.Root className="modern-segmented-toolbar" aria-label="Navigation">
        <Toolbar.ToggleGroup 
          type="single" 
          value={activeTab.toString()}
          onValueChange={(value) => {
            if (value) {
              onTabChange(parseInt(value, 10));
            }
          }}
          className="modern-segmented-group"
        >
          {navigationItems.map((item) => (
            <Toolbar.ToggleItem
              key={item.index}
              value={item.index.toString()}
              className="modern-segmented-item"
              aria-label={item.label}
            >
              <span className="modern-segmented-label md-typescale-label-large">
                {item.label}
              </span>
              <span className="modern-segmented-indicator" />
            </Toolbar.ToggleItem>
          ))}
        </Toolbar.ToggleGroup>
      </Toolbar.Root>
    </div>
  );
}
