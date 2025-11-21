# SheetPilot - Tauri Refactor

This is the refactored version of SheetPilot using:
- **Tauri v2** (Rust backend)
- **Svelte 5** (Frontend)
- **Flowbite Svelte** (UI components)
- **Tailwind CSS** (Styling)

## Features Implemented

✅ **Authentication**
- Login/logout with session management
- Admin and regular user support
- Session persistence with localStorage

✅ **Database Operations**
- Create/read/update/delete timesheet entries
- SQLite database with rusqlite
- Time validation (15-minute increments)
- Automatic data persistence

✅ **UI Components**
- Login modal
- Timesheet grid (table-based for now)
- Navigation bar
- Responsive design

## Running the App

### Prerequisites
- Node.js 18+
- Rust (latest stable)

### Development Mode

You need TWO terminals:

**Terminal 1 - Frontend Dev Server:**
```bash
cd tauri-refactor
npm run dev
```

**Terminal 2 - Tauri App:**
```bash
cd tauri-refactor
npm run tauri:dev
```

The app will open in a native window.

### Build for Production

```bash
cd tauri-refactor
npm run tauri:build
```

The installer will be created in `tauri-refactor/src-tauri/target/release/bundle/`

## Default Credentials

**Admin:**
- Username: `Admin`
- Password: `SWFL_ADMIN`

**Regular User:**
- Any email/password combination will create a user account

## Database Location

Development: `C:\Users\[USERNAME]\AppData\Roaming\com.sheetpilot.app\sheetpilot.sqlite`

## Project Structure

```
tauri-refactor/
├── src/                      # Frontend (Svelte)
│   ├── lib/
│   │   ├── components/       # Svelte components
│   │   └── stores/           # State management
│   ├── App.svelte           # Main app component
│   └── main.js              # Entry point
├── src-tauri/               # Backend (Rust)
│   ├── src/
│   │   ├── commands/        # Tauri commands (IPC handlers)
│   │   ├── database.rs      # Database management
│   │   ├── auth.rs          # Authentication
│   │   ├── bot.rs           # Browser automation (WIP)
│   │   └── lib.rs           # Main entry point
│   └── Cargo.toml           # Rust dependencies
└── package.json             # Node dependencies
```

## Size Optimization

Current build size (development):
- Frontend bundle: ~123KB (38KB gzipped)
- Rust binary: ~5-8MB (with optimizations)
- **Target deployment: 25-30MB** (vs. 668MB Electron version)

## What's Next

### Phase 3 (In Progress)
- [ ] Migrate Handsontable integration
- [ ] Add more UI components (Settings, Archive viewer)
- [ ] Implement submission progress UI

### Phase 4 (Not Started)
- [ ] Implement browser automation with chromiumoxide
- [ ] Port bot orchestration from TypeScript
- [ ] Implement quarter routing

## Known Limitations

- Timesheet grid is basic table (Handsontable not yet integrated)
- Browser automation not yet implemented
- CSV export not yet implemented
- Auto-updater not yet configured

## Testing

Login and try:
1. Creating a new timesheet entry
2. Editing an entry
3. Deleting an entry
4. Logging out and back in (session persistence)

All data should persist to the database!
