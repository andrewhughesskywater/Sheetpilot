import {
  Assignment as AssignmentIcon,
  Help as HelpIcon,
  House as HouseIcon,
  Storage as StorageIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon
} from '@mui/icons-material';
import { useTheme } from '../hooks/useTheme';

interface SidebarNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
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
  const { effectiveTheme, toggleTheme } = useTheme();

  return (
    <div className="sidebar">
      {/* Logo Button */}
      <div className="sidebar__add-button">
        <button className="add-button" onClick={onLogoClick}>
          <img 
            src="/transparent-logo.png" 
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

      {/* Bottom Section with Theme Toggle */}
      <div className="sidebar__bottom">
        <div className="theme-toggle">
          <button
            className={`theme-toggle__button ${effectiveTheme === 'light' ? 'theme-toggle__button--active' : ''}`}
            onClick={() => toggleTheme()}
            aria-label="Light mode"
          >
            <LightModeIcon />
          </button>
          <button
            className={`theme-toggle__button ${effectiveTheme === 'dark' ? 'theme-toggle__button--active' : ''}`}
            onClick={() => toggleTheme()}
            aria-label="Dark mode"
          >
            <DarkModeIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

