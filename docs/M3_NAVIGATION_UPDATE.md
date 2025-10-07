# Material Design 3 Navigation Update

## Overview

SheetPilot's navigation has been updated to follow [Material Design 3 segmented button guidelines](https://m3.material.io/components/button-groups/guidelines). The sidebar navigation has been replaced with a modern top navigation bar featuring segmented buttons.

## Changes Implemented

### Navigation Architecture

**Before**: Vertical sidebar with icon-based navigation
**After**: Horizontal top bar with text-based segmented button navigation

### New Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] SheetPilot  │ [Home][Timesheet][Archive][Help] │ [🌙]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Main Content Area                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Top Navigation Bar Components

1. **App Branding (Left)**
   - SheetPilot logo icon
   - "SheetPilot" text (Title Large typography)
   - Clickable to open About dialog
   - Hover state with M3 state layer

2. **Segmented Navigation (Center)**
   - Text-only buttons: Home, Timesheet, Archive, Help
   - Selected state using secondary container color
   - State layers for hover/focus/press
   - Shared borders between buttons
   - Rounded corners on group ends
   - Full keyboard accessibility

3. **Theme Toggle (Right)**
   - Icon button to switch between light/dark modes
   - Shows opposite mode icon (moon in light, sun in dark)
   - Material icon button styling

### Segmented Button Specifications

Following M3 guidelines:

- **Height**: 40px
- **Padding**: 0 24px per button
- **Border**: 1px solid outline color
- **Border radius**: Full rounded (999px) on group ends
- **Typography**: Label Large (14px / 500 weight)
- **State layers**: 8% hover, 12% focus, 12% press
- **Selected state**: Secondary container background with on-secondary-container text

### Responsive Design

```css
@media (max-width: 600px) {
  .md-segmented-button {
    min-width: 40px;
    padding: 0 16px;
  }
}
```

Buttons compress on smaller screens while maintaining usability.

### Accessibility Features

- **Keyboard Navigation**: Full tab support with visible focus indicators
- **ARIA Attributes**: `role="group"`, `aria-label="Navigation"`, `aria-current="page"`
- **Focus Indicators**: 3px outline with 2px offset (M3 spec)
- **High Contrast Mode**: Increased border width (2px)
- **Reduced Motion**: Transitions disabled when preferred

## Component Files

### New Files Created

1. **`renderer/src/components/SegmentedNavigation.tsx`**
   - Segmented button navigation component
   - Props: `activeTab`, `onTabChange`
   - Renders navigation items from array

2. **`renderer/src/components/SegmentedNavigation.css`**
   - M3-compliant segmented button styles
   - State layers and interactions
   - Responsive and accessibility support

### Modified Files

1. **`renderer/src/App.tsx`**
   - Replaced `SidebarNavigation` with `SegmentedNavigation`
   - Added top navigation bar layout
   - Integrated theme toggle with `useTheme` hook
   - Updated layout from flex-row to flex-column

2. **`renderer/src/App.css`**
   - Removed sidebar margin (was `margin-left: 100px`)
   - Added `.top-navigation` styles
   - Added `.app-branding` and `.theme-controls` styles
   - Updated `.main-content-area` for new layout

### Removed Dependencies

- `SidebarNavigation.tsx` is no longer used (can be deleted)
- Sidebar-specific styles removed from theme

## Visual Design

### Color Usage (M3 Tokens)

**Unselected Buttons**:
- Background: Transparent
- Text: `--md-sys-color-on-surface`
- Border: `--md-sys-color-outline`

**Selected Button**:
- Background: `--md-sys-color-secondary-container`
- Text: `--md-sys-color-on-secondary-container`
- Border: Transparent

**Top Navigation Bar**:
- Background: `--md-sys-color-surface`
- Border: `--md-sys-color-outline-variant`
- Shadow: `--md-sys-elevation-level1`

### State Layers

All interactive elements use M3 state layers:

```css
.md-segmented-button::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 100ms cubic-bezier(0.2, 0.0, 0, 1.0);
}

.md-segmented-button:hover::before {
  background: currentColor;
  opacity: 0.08; /* 8% M3 hover state */
}
```

## User Experience Improvements

### Before
- Navigation icons required memorization
- Sidebar consumed horizontal space
- Theme toggle hidden in sidebar
- Logo click not discoverable

### After
- Text labels are self-explanatory
- Full width available for content
- Theme toggle prominently placed
- App branding clickable for About info
- Centered navigation draws focus

## Browser Compatibility

- Modern CSS features used: `color-mix()`, `inset`, `:has()`
- Fallbacks provided where needed
- Tested in Electron (Chromium-based)

## Future Enhancements

Potential improvements:
- Badge notifications on navigation items
- Overflow menu for additional items on mobile
- Breadcrumb integration for sub-navigation
- Animation when switching tabs

## Testing Checklist

- [x] Navigation switches between all tabs
- [x] Selected state persists correctly
- [x] Keyboard navigation works (Tab, Enter, Space)
- [x] Focus indicators visible
- [x] Theme toggle functions correctly
- [x] Responsive on smaller screens
- [x] State layers show on hover/focus/press
- [x] Logo opens About dialog
- [x] No console errors
- [x] Linter passes

## References

- [M3 Segmented Buttons](https://m3.material.io/components/button-groups/guidelines)
- [M3 Navigation Patterns](https://m3.material.io/foundations/navigation)
- [M3 State Layers](https://m3.material.io/foundations/interaction/states/overview)

