/**
 * Material Design 3 Segmented Button Navigation
 * Following M3 guidelines: https://m3.material.io/components/button-groups/guidelines
 */

import './SegmentedNavigation.css';

interface SegmentedNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

const navigationItems = [
  { label: 'Home', index: 0 },
  { label: 'Timesheet', index: 1 },
  { label: 'Archive', index: 2 },
  { label: 'Help', index: 3 }
];

export default function SegmentedNavigation({ 
  activeTab, 
  onTabChange 
}: SegmentedNavigationProps) {
  return (
    <div className="md-segmented-button-container">
      <div className="md-segmented-button-group" role="group" aria-label="Navigation">
        {navigationItems.map((item) => (
          <button
            key={item.index}
            className={`md-segmented-button ${activeTab === item.index ? 'md-segmented-button--selected' : ''}`}
            onClick={() => onTabChange(item.index)}
            aria-current={activeTab === item.index ? 'page' : undefined}
            type="button"
          >
            {/* State layer for hover/focus/press effects */}
            <span className="md-segmented-button__state-layer"></span>
            
            {/* Label */}
            <span className="md-segmented-button__label md-typescale-label-large">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

