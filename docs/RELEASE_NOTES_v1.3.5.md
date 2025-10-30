## Sheetpilot v1.3.5

- Released: 2025-10-30  
- Scope: UI polish, updater UX, contract/test hardening

### New
- Material Design 3 tokenized theme in `app/frontend/src/styles`: centralized tokens, typography scale, elevation, motion, and shape radii via `m3-*` and `theme.css`.
- Segmented navigation styles (`ModernSegmentedNavigation.css`) using M3 tokens with smooth shape morphing.
- In-app update dialog flow wiring on the renderer side (imports present; hooks into update IPC events via `App.tsx` state).

### Improvements
- Defined z-index scale tokens in `theme.css` (`--sp-z-appbar`, `--sp-z-drawer`, `--sp-z-dropdown`, `--sp-z-modal`, `--sp-z-toast`, `--sp-z-tooltip`) for predictable layering.
- Standardized focus ring token `--sp-focus` and applied consistent focus-visible behavior across buttons and inputs.
- MUI component overrides aligned to M3 (`m3-mui-overrides.css`), including Filled/Outlined button behavior, elevation, and disabled states.
- Added reduced-motion accessibility handling; transitions and animations disable when users prefer reduced motion.
- Synchronized version across root `package.json`, backend `package.json`, bot `package.json`, and `app/shared/constants.ts` (`APP_VERSION = '1.3.5'`).

### Fixes
- Auto-updater UX: main process emits `download-progress` and `update-downloaded` to renderer; installs after a short delay, improving user feedback during updates.
- Auto-updater error reporting: logs structured context including message and stack, and notifies renderer via `update-error`.

### Developer notes
- Contract/test hardening:
  - Renderer–main contract tests in `app/backend/tests/contracts/renderer-main-contracts.spec.ts` validate IPC channel naming and required channels.
  - IPC signature validation introduced in `app/backend/tests/contracts/ipc-contracts.spec.ts`.
- Update flow hooks in main (`configureAutoUpdater`) and renderer (`App.tsx`) to support progress, cancel, and install.
- Version sync script present in scripts and used by build commands.

### Known issues
- None tracked in code for this release.

### Upgrade notes
- Use the standard in-app updater. No manual migration steps required.

### Artifacts
- `Sheetpilot-Setup.exe`, `.blockmap`, and `latest.yml` expected with the v1.3.5 GitHub release.
