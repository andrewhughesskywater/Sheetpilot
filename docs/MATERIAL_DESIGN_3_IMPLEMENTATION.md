# Material Design 3 Implementation

## Overview

SheetPilot now follows [Material Design 3 (M3)](https://m3.material.io/) guidelines with a comprehensive design system implementation including:

- **Tonal color palettes** with light and dark theme support
- **M3 typography scale** (Display, Headline, Title, Body, Label)
- **State layers** for interactive elements (8%, 12%, 16% opacity)
- **M3 elevation system** with standardized shadows
- **Dynamic theme switching** between light and dark modes
- **Segmented button navigation** following [M3 button group guidelines](https://m3.material.io/components/button-groups/guidelines)

## Design System Architecture

### Color System

#### Tonal Palettes
The app uses five tonal palettes as specified by M3:
- **Primary**: Sky Blue (#4F8EF7) - Main brand color
- **Secondary**: Coral (#FF6B6B) - Accent color
- **Tertiary**: Green - Success states
- **Error**: Red - Error states
- **Neutral**: Grays - Surface and text colors

Each palette contains 13 tonal values (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100) to support both light and dark themes.

#### Color Roles
M3 semantic color roles are defined in `renderer/src/m3-tokens.css`:
- `--md-sys-color-primary`, `--md-sys-color-on-primary`
- `--md-sys-color-surface`, `--md-sys-color-on-surface`
- `--md-sys-color-background`, `--md-sys-color-on-background`
- Surface containers (lowest, low, container, high, highest)
- `--md-sys-color-outline`, `--md-sys-color-outline-variant`

### Typography Scale

M3 typography system with proper type scales:

#### Display
- Display Large: 57px / 400 weight
- Display Medium: 45px / 400 weight
- Display Small: 36px / 400 weight

#### Headline
- Headline Large: 32px / 400 weight
- Headline Medium: 28px / 400 weight
- Headline Small: 24px / 400 weight

#### Title
- Title Large: 22px / 500 weight
- Title Medium: 16px / 500 weight
- Title Small: 14px / 500 weight

#### Body
- Body Large: 16px / 400 weight
- Body Medium: 14px / 400 weight
- Body Small: 12px / 400 weight

#### Label
- Label Large: 14px / 500 weight
- Label Medium: 12px / 500 weight
- Label Small: 11px / 500 weight

**Usage**: Apply classes like `md-typescale-headline-medium` or `md-typescale-body-large`.

### State Layers

Interactive elements use M3 state layers for visual feedback:
- **Hover**: 8% opacity overlay
- **Focus**: 12% opacity overlay
- **Press**: 12% opacity overlay
- **Dragged**: 16% opacity overlay

State layers are implemented with `::before` pseudo-elements on interactive components.

### Elevation System

M3 elevation levels (0-5) using standardized shadow tokens:
- **Level 0**: No shadow (flush with surface)
- **Level 1**: Subtle shadow for raised elements
- **Level 2**: Medium shadow for cards
- **Level 3**: Pronounced shadow for FABs
- **Level 4**: Strong shadow for dialogs
- **Level 5**: Maximum shadow for menus/dropdowns

## Navigation

### Segmented Button Navigation

Following [M3 segmented button guidelines](https://m3.material.io/components/button-groups/guidelines), the app uses a segmented button group for primary navigation instead of a sidebar.

**Location**: Top of the window, centered in the navigation bar

**Options**:
- Home
- Timesheet
- Archive
- Help

**Features**:
- Text-only labels (no icons)
- Persistent across all views
- Selected state using secondary container color
- State layers for hover/focus/press interactions
- Full keyboard accessibility
- Responsive design for smaller screens

**Component**: `renderer/src/components/SegmentedNavigation.tsx`

### Top Navigation Bar

The top navigation bar contains:
1. **App branding** (left): Logo + "SheetPilot" title - opens About dialog
2. **Segmented navigation** (center): Primary navigation buttons
3. **Theme toggle** (right): Switch between light/dark modes

## Theme System

### Dynamic Theme Switching

The theme system supports:
- **Light mode**: Default theme with bright backgrounds
- **Dark mode**: Dark backgrounds with light text
- **Auto mode**: Follows system preference

**Implementation**:
- Theme manager: `renderer/src/utils/theme-manager.ts`
- React hook: `renderer/src/hooks/useTheme.ts`
- Storage: Persists preference in `localStorage`

**Usage**:
```typescript
import { useTheme } from './hooks/useTheme';

const { themeMode, effectiveTheme, setThemeMode, toggleTheme } = useTheme();
```

### Theme Application

Themes are applied via `data-theme` attribute on `<html>`:
```html
<html data-theme="light">
<html data-theme="dark">
```

CSS automatically adjusts based on this attribute.

## Component Updates

### Updated Components

All components now use M3 design tokens:

1. **TimesheetGrid**: M3 buttons, typography, surfaces
2. **DatabaseViewer (Archive)**: M3 surfaces, elevation, state layers
3. **App Layout**: Top navigation with segmented buttons
4. **Buttons**: M3 filled buttons with state layers

### M3 Component Classes

Available M3 component classes in `renderer/src/m3-components.css`:

- **Buttons**: `.md-button`, `.md-button--filled`, `.md-button--outlined`, `.md-button--text`
- **Icon Buttons**: `.md-icon-button`, `.md-icon-button--filled`
- **Cards**: `.md-card`, `.md-card--elevated`, `.md-card--outlined`
- **FAB**: `.md-fab`, `.md-fab--primary`, `.md-fab--surface`
- **Chips**: `.md-chip`, `.md-chip--filter`, `.md-chip--input`
- **Surfaces**: `.md-surface`, `.md-surface-container`
- **Typography**: All M3 type scale classes

## File Structure

```
renderer/src/
├── m3-tokens.css              # M3 design tokens (colors, typography, elevation)
├── m3-components.css          # M3 component styles
├── theme.css                  # Legacy theme mapped to M3 tokens
├── index.css                  # Global styles (imports M3 tokens)
├── utils/
│   └── theme-manager.ts       # Theme switching logic
├── hooks/
│   └── useTheme.ts            # React hook for theme management
└── components/
    └── SegmentedNavigation.tsx # M3 segmented button navigation
    └── SegmentedNavigation.css # Segmented button styles
```

## Migration Notes

### Backward Compatibility

Legacy CSS custom properties (`--sp-*`) are maintained and mapped to M3 tokens for backward compatibility:
- `--sp-color-primary` → `--md-sys-color-primary`
- `--sp-surface` → `--md-sys-color-surface`
- `--sp-shadow-1` → `--md-sys-elevation-level1`
- `--sp-radius-md` → `--md-sys-shape-corner-medium`

### Breaking Changes

1. **Layout**: Changed from sidebar to top navigation
2. **Navigation**: Segmented buttons instead of icon navigation
3. **Theme toggle**: Moved from sidebar to top-right

## Accessibility

M3 implementation includes:
- High contrast mode support
- Reduced motion support
- Keyboard navigation
- ARIA labels and roles
- Focus indicators following M3 specs (3px outline with 2px offset)

## Resources

- [Material Design 3](https://m3.material.io/)
- [M3 Color System](https://m3.material.io/styles/color/system/overview)
- [M3 Typography](https://m3.material.io/styles/typography/overview)
- [M3 Button Groups](https://m3.material.io/components/button-groups/guidelines)
- [M3 Elevation](https://m3.material.io/styles/elevation/overview)

## Future Enhancements

Potential M3 features to implement:
- Material You dynamic color generation from user wallpaper
- Additional M3 components (bottom sheets, navigation drawer)
- Motion system with emphasized easing
- Adaptive layout for mobile/tablet

