# Fast Development Mode Guide

This guide explains the optimizations made to speed up `npm run dev` and the different development modes available.

## Performance Improvements Summary

### Before Optimizations

- **First Start**: ~30-60 seconds
- **Subsequent Starts**: ~30-60 seconds (no caching)
- **File Change**: Manual restart required

### After Optimizations

1. **TypeScript Incremental Compilation**: 50-80% faster on subsequent builds
2. **Skip Native Module Rebuild**: 5-15 seconds saved per start
3. **esbuild (Option 3)**: 10-100x faster than TypeScript compiler
4. **Watch Mode (Option 4)**: 0.5-2 second restart on file changes

## Available Development Modes

### 1. `npm run dev` - Standard Mode (Recommended for Most Use)

**Uses**: TypeScript compiler with incremental compilation

```bash
npm run dev
```

**Features**:

- Full TypeScript type-checking during build
- Incremental compilation caches unchanged files
- Skips native module rebuild (now happens only during `npm install`)
- Best for: Regular development with type safety

**Speed**:

- First run: ~15-25 seconds
- Subsequent runs: ~5-10 seconds (with incremental cache)

---

### 2. `npm run dev:watch` - Ultra-Fast Watch Mode ⚡

**Uses**: esbuild + nodemon for automatic restarts

```bash
npm run dev:watch
```

**Features**:

- **Lightning-fast compilation** with esbuild (10-100x faster than tsc)
- **Auto-restart** when files change (no manual restart needed)
- **Live reload** - just save your file and Electron restarts automatically
- Runs 3 processes concurrently:
  1. Vite (frontend dev server)
  2. esbuild in watch mode (backend compilation)
  3. Nodemon (auto-restart Electron on changes)

**Speed**:

- Initial build: ~2-5 seconds
- File change rebuild: ~0.5-2 seconds
- Best for: Active development with frequent changes

**How it works**:

1. esbuild watches `app/backend/src` and `app/shared`
2. When you save a `.ts` file, esbuild recompiles it instantly
3. Nodemon detects the compiled `.js` file change
4. Electron automatically restarts with your changes

**Type-checking**:

- esbuild only transpiles TypeScript (doesn't type-check)
- Run `npm run type-check` periodically to catch type errors
- Or enable TypeScript checking in your IDE (VS Code, etc.)

---

## One-Time Setup (Already Done)

The following optimizations have been implemented:

### 1. TypeScript Incremental Compilation

`tsconfig.build-main.json`:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "build/.tsbuildinfo"
  }
}
```

### 2. Native Module Rebuild

- Moved to `postinstall` script
- Runs automatically after `npm install` or `npm ci`
- To manually rebuild: `npm run rebuild`

### 3. esbuild Configuration

`scripts/build-dev.js`:

- Compiles all TypeScript files in `app/backend/src` and `app/shared`
- Outputs to `build/dist/`
- Supports watch mode with `--watch` flag

### 4. Nodemon Configuration

`nodemon.json`:

- Watches `build/dist/` for changes
- Auto-restarts Electron when compiled files change
- 500ms delay to prevent multiple restarts

---

## Recommended Workflow

### For Active Development (Making Lots of Changes)

```bash
npm run dev:watch
```

- Ultra-fast hot reload
- Save file → Auto restart in ~1 second
- Run `npm run type-check` before committing

### For Occasional Development or Debugging

```bash
npm run dev
```

- Full type-checking during build
- More stable for debugging
- Catches type errors immediately

### Before Committing

```bash
npm run type-check
npm run lint
npm test
```

---

## Troubleshooting

### "Module not found" errors

If you see module resolution errors after switching between modes:

```bash
npm run clean
npm install
```

### Native module errors (better-sqlite3)

If Electron crashes with native module errors:

```bash
npm run rebuild
```

### esbuild not updating

If watch mode isn't detecting changes:

1. Stop `npm run dev:watch` (Ctrl+C)
2. Clear build: `npm run clean`
3. Restart: `npm run dev:watch`

### Type errors not showing

Remember: esbuild doesn't type-check! Run:

```bash
npm run type-check
```

---

## Script Reference

| Script | Description | Use Case |
|--------|-------------|----------|
| `npm run dev` | TypeScript with incremental compilation | Default development |
| `npm run dev:watch` | esbuild + auto-restart | Fast development |
| `npm run build:main` | Full production build with version sync | Production builds |
| `npm run build:main:fast` | TypeScript without version sync | Quick builds |
| `npm run build:main:esbuild` | Single esbuild compilation | Test esbuild setup |
| `npm run build:main:watch` | esbuild in watch mode (manual) | Advanced use |
| `npm run electron:dev` | Run Electron without rebuild | After manual build |
| `npm run electron:watch` | Nodemon auto-restart | After manual build |
| `npm run rebuild` | Rebuild native modules | After dependency changes |
| `npm run type-check` | Full TypeScript type-checking | Before commits |

---

## Performance Comparison

| Mode | Initial Build | File Change | Type-Checking | Auto-Restart |
|------|--------------|-------------|---------------|--------------|
| **Old `dev`** | 30-60s | Manual restart | ✅ Yes | ❌ No |
| **New `dev`** | 5-10s | Manual restart | ✅ Yes | ❌ No |
| **`dev:watch`** | 2-5s | 0.5-2s | ❌ No* | ✅ Yes |

*Use `npm run type-check` for type-checking with `dev:watch` mode

---

## Tips for Maximum Speed

1. **Use `dev:watch` for active development**
   - Saves time with every file change
   - Type-check before commits

2. **Keep your IDE type-checker enabled**
   - VS Code shows type errors in real-time
   - No need for tsc type-checking while coding

3. **Don't restart unnecessarily**
   - `dev:watch` auto-restarts on file save
   - Only restart if you change dependencies

4. **Clean build directory occasionally**

   ```bash
   npm run clean
   ```

   - Prevents stale file issues
   - Fresh start if something feels off

---

## What Changed?

### Modified Files

1. `package.json` - New scripts for fast dev mode
2. `tsconfig.build-main.json` - Incremental compilation enabled
3. `scripts/build-dev.js` - New esbuild build script
4. `nodemon.json` - New auto-restart configuration

### New Dependencies

- `esbuild` - Ultra-fast TypeScript/JavaScript bundler
- `glob` - File pattern matching for build script

### Behavior Changes

- Native module rebuild now happens during `npm install` (not every dev start)
- `dev:watch` mode doesn't type-check (use `npm run type-check` manually)
