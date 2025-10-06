import {
  Assignment as AssignmentIcon,
  Help as HelpIcon,
  House as HouseIcon,
  Storage as StorageIcon
} from '@mui/icons-material';

interface SidebarNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
  onSignOut?: () => void;
  onLogoClick?: () => void;
}

const navigationItems = [
  {
    label: 'Dashboard',
    icon: <HouseIcon />,
    index: 0
  },
  {
    label: 'Timesheet',
    icon: <AssignmentIcon />,
    index: 1
  },
  {
    label: 'Archive',
    icon: <StorageIcon />,
    index: 2
  },
  {
    label: 'Help',
    icon: <HelpIcon />,
    index: 3
  }
];

export default function SidebarNavigation({ 
  activeTab, 
  onTabChange, 
  onLogoClick
}: SidebarNavigationProps) {

  return (
    <div className="sidebar">
      {/* Logo Button */}
      <div className="sidebar__add-button">
        <button className="add-button" onClick={onLogoClick}>
          <img 
            src="/transparent-logo-no-text.svg?v=2" 
            alt="SheetPilot" 
            className="logo-icon"
          />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <button
            key={item.index}
            className={`nav-button ${activeTab === item.index ? 'nav-button--active' : ''}`}
            onClick={() => onTabChange(item.index)}
          >
            {item.icon}
          </button>
        ))}
      </nav>

    </div>
  );
}

