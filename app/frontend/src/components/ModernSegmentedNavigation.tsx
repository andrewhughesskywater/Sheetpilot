/**
 * Beautiful Segmented Navigation
 * Animated navigation bar with icons and smooth transitions
 */

import { useState } from 'react';
import { Clock, Archive, HelpCircle } from 'lucide-react';

interface ModernSegmentedNavigationProps {
  activeTab: number;
  onTabChange: (tabIndex: number) => void;
}

const navigationItems = [
  { label: 'Timesheet', icon: Clock, index: 0 },
  { label: 'Archive', icon: Archive, index: 1 },
  { label: 'Help', icon: HelpCircle, index: 2 }
];

export default function ModernSegmentedNavigation({ 
  activeTab, 
  onTabChange 
}: ModernSegmentedNavigationProps) {
  const [hoveredTab, setHoveredTab] = useState<number | null>(null);

  return (
    <>
      {/* Centering wrapper */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%'
      }}>
        <div style={{
          position: 'relative',
          display: 'inline-flex',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '16px',
          padding: '6px',
          gap: '4px',
          boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Animated background pill */}
          <div
            style={{
              position: 'absolute',
              top: '6px',
              bottom: '6px',
              left: `calc(6px + ${activeTab * 124}px)`,
              width: '120px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
              borderRadius: '12px',
              transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 0,
              pointerEvents: 'none'
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
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                minWidth: '120px',
                padding: '16px 24px',
                border: 'none',
                background: 'transparent',
                color: isActive ? '#667eea' : 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isActive ? 'translateY(-2px)' : isHovered ? 'translateY(-1px)' : 'translateY(0)',
                zIndex: 1,
                fontWeight: isActive ? '600' : '500',
                fontSize: '14px',
                letterSpacing: '0.3px',
                outline: 'none'
              }}
            >
              <div style={{
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isActive ? 'scale(1.15) rotate(5deg)' : isHovered ? 'scale(1.08)' : 'scale(1)',
                filter: isActive ? 'drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3))' : 'none'
              }}>
                <Icon size={28} strokeWidth={2} />
              </div>
              <span style={{
                transition: 'all 0.3s ease',
                opacity: isActive ? 1 : isHovered ? 0.9 : 0.7
              }}>
                {item.label}
              </span>

              {/* Ripple effect on active */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '12px',
                    background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}
                />
              )}
            </button>
          );
        })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.5);
          outline-offset: 4px;
        }
      `}</style>
    </>
  );
}
