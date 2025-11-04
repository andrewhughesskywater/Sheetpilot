/**
 * SheetPilot Navigation Component
 * Beautiful animated navigation with aviation/semiconductor theming
 */

import { useState } from 'react';
import { Clock, Archive, HelpCircle, Plane } from 'lucide-react';
import './SheetPilotNavigation.css';

interface SheetPilotNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
  onLogoClick?: () => void;
}

const navigationItems = [
  { label: 'Timesheet', icon: Clock, index: 0 },
  { label: 'Archive', icon: Archive, index: 1 },
  { label: 'Help', icon: HelpCircle, index: 2 }
];

export default function SheetPilotNavigation({ 
  activeTab, 
  onTabChange,
  onLogoClick
}: SheetPilotNavigationProps) {
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);

  return (
    <div className="sheetpilot-container">
      {/* Animated Circuit Board Background */}
      <div className="circuit-background">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="2" fill="#0EA5E9" />
              <circle cx="90" cy="10" r="2" fill="#0EA5E9" />
              <circle cx="50" cy="50" r="2" fill="#8B5CF6" />
              <circle cx="10" cy="90" r="2" fill="#0EA5E9" />
              <circle cx="90" cy="90" r="2" fill="#0EA5E9" />
              <line x1="10" y1="10" x2="50" y2="50" stroke="#0EA5E9" strokeWidth="1" />
              <line x1="90" y1="10" x2="50" y2="50" stroke="#0EA5E9" strokeWidth="1" />
              <line x1="50" y1="50" x2="10" y2="90" stroke="#8B5CF6" strokeWidth="1" />
              <line x1="50" y1="50" x2="90" y2="90" stroke="#8B5CF6" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit)" />
        </svg>
      </div>

      {/* Top Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-content">
          {/* Logo Area */}
          <div 
            className="logo-section"
            onClick={onLogoClick}
            style={{ cursor: onLogoClick ? 'pointer' : 'default' }}
            role={onLogoClick ? 'button' : undefined}
            tabIndex={onLogoClick ? 0 : undefined}
            onKeyDown={onLogoClick ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onLogoClick();
              }
            } : undefined}
            aria-label={onLogoClick ? 'About SheetPilot' : undefined}
          >
            <div className="logo-icon">
              <Plane size={28} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="app-title">SheetPilot</h1>
              <p className="app-subtitle">by SkyWater Technology</p>
            </div>
          </div>

          {/* Hero Title in Header */}
          <div className="header-hero">
            <h2 className="header-hero-title">Navigate Your Time</h2>
            <p className="header-hero-description">
              SheetPilot — Precision timesheet management for SkyWater Technology
            </p>
          </div>
        </div>
      </nav>

      {/* Navigation Section */}
      <div className="hero-section">
        {/* Floating Orbs Background */}
        <div className="floating-orb-1" />
        <div className="floating-orb-2" />

        {/* Modern Segmented Navigation */}
        <div className="segmented-nav-wrapper">
          <div className="segmented-nav-container">
            {/* Animated background pill */}
            <div
              className="animated-pill"
              style={{
                left: `calc(6px + ${activeTab * (100 / navigationItems.length)}%)`,
                width: `calc(${100 / navigationItems.length}% - 6px)`
              }}
            />

            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.index;
              const isHovered = hoveredTab === item.index;

              return (
                <button
                  key={item.index}
                  onClick={() => onTabChange(item.index)}
                  onMouseEnter={() => setHoveredTab(item.index)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={`nav-button ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                >
                  <Icon
                    size={26}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`nav-button-icon ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

