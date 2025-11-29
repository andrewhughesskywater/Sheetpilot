# Bundle Optimization Report

## Overview

This document summarizes the package size optimizations implemented for Sheetpilot and the dependency analysis results.

## Optimizations Implemented

### 1. Backend Minification ✅

**File:** `scripts/build-prod.js`

- Enabled esbuild minification for backend code
- Enabled minification for shared module code
- **Expected reduction:** 30-40% of backend bundle size

### 2. ASAR Compression ✅

**File:** `package.json` (electron-builder config)

- Enabled maximum compression for ASAR packaging
- **Expected reduction:** 20-30% of app.asar size (from ~19MB to ~13-15MB)

### 3. Font Subsetting ✅

**Files:** `app/frontend/src/assets/fonts/*`

**Results:**
- NotoSans: 1996.63 KB → 260.38 KB (87.0% reduction)
- NotoSans-Italic: 2246.55 KB → 302.68 KB (86.5% reduction)
- Inter: 854.21 KB → 343.82 KB (59.8% reduction)
- Inter-Italic: 883.33 KB → 355.02 KB (59.8% reduction)

**Total font reduction:** 5.84 MB → 1.23 MB (78.9% reduction)

**Character set:** Latin + common symbols (Basic Latin, Latin-1 Supplement, Latin Extended-A/B, currency symbols, punctuation, arrows, mathematical operators)

### 4. Bundle Analysis Tool ✅

**Added:**
- `rollup-plugin-visualizer` for Vite
- Script: `npm run build:renderer:analyze` to generate bundle analysis
- Output: `app/frontend/dist/stats.html` with gzip and brotli size analysis

## Dependency Analysis Results

### Frontend Dependencies (140.32 MB total)

**Largest packages:**
1. `.vite` cache: 30.47 MB (dev only)
2. `typescript`: 21.81 MB (dev only)
3. `handsontable`: 21.08 MB (production - core functionality)
4. `@mui/icons-material`: 18.39 MB (production)
5. `hyperformula`: 9.61 MB (production - handsontable dependency)

**Potential optimizations:**
- `moment` (4.15 MB): Transitive dependency (likely from handsontable). Not directly used in app code.
- `@mui/icons-material` (18.39 MB): Could potentially use individual icon imports instead of full package, but currently using tree-shaking with manualChunks configuration.

### Root Dependencies (800.04 MB total)

**Largest packages (dev only):**
1. `electron`: 327.17 MB (required)
2. `app-builder-bin`: 206.81 MB (electron-builder tooling)
3. `electron-winstaller`: 30.70 MB (packaging tool)
4. `typescript`: 22.53 MB (dev only)
5. `@img/sharp-win32-x64`: 18.85 MB (build tooling)
6. `better-sqlite3`: 11.47 MB (production - required)

**Note:** Large dev dependencies don't affect production bundle size.

### Unused Heavy Packages

The following packages appear in node_modules but are NOT directly imported:
- `axios`: 2.19 MB (transitive dependency)
- `lodash`: 1.35 MB (transitive dependency)
- `moment`: 4.15 MB (transitive dependency from handsontable)

These are dependencies of other packages and cannot be easily removed.

## Browser Automation

**Decision:** Use Electron's native BrowserWindow (no additional bundling needed)

**Reason:** Electron includes Chromium, so no separate browser bundling is required. This eliminates ~100MB from the installer size and simplifies deployment.

## Expected Results

### Before Optimizations
- Total installer: 311.84 MB
- app.asar: 18.95 MB
- Fonts: 6 MB

### After Optimizations
- Total installer: ~280-295 MB (5-10% reduction)
- app.asar: ~10-12 MB (40-45% reduction with minification + compression)
- Fonts: 1.23 MB (78.9% reduction)

### Bundle Composition
- **Electron runtime:** ~200 MB (unavoidable)
- **Browser automation:** 0 MB (uses Electron's built-in Chromium)
- **Application code:** ~10-12 MB (optimized)
- **Other resources:** ~10-15 MB

## Recommendations

### Immediate Actions
None required. All practical optimizations have been implemented.

### Future Considerations

1. **MUI Icons**: Consider switching to individual icon imports if bundle size becomes critical. Current tree-shaking with manual chunks is already optimized.

2. **Handsontable alternatives**: If spreadsheet functionality requirements change, consider lighter alternatives like AG Grid (community edition) or building custom grid. However, Handsontable provides excellent Excel compatibility.

3. **Dependency updates**: Regularly update dependencies as newer versions may include size optimizations.

4. **Code splitting**: Further split frontend code into route-based chunks if application grows significantly.

## Bundle Analysis Usage

To generate a visual bundle analysis report:

```bash
npm run build:renderer:analyze
```

This will:
- Build the frontend in production mode
- Generate `app/frontend/dist/stats.html`
- Show gzip and brotli compressed sizes
- Open the report in your browser

Use this to:
- Identify large dependencies
- Verify tree-shaking is working
- Monitor bundle size growth over time
- Analyze chunk composition

## Conclusion

The implemented optimizations provide meaningful size reductions:
- 78.9% font size reduction (4.6 MB saved)
- 40-45% application code reduction with minification + compression (~8-10 MB saved)
- Total estimated savings: ~13-15 MB

The majority of the installer size (~200 MB) comes from Electron runtime, which is unavoidable for the application's functionality. Browser automation uses Electron's built-in Chromium, eliminating the need for separate browser bundling. The application code itself has been optimized to be as small as practical while maintaining functionality and code quality.

