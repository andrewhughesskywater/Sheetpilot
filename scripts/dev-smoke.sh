#!/bin/bash

# Development smoke test to verify single initialization and absence of CSP warnings
# This script starts the dev server, captures console output, and verifies expected behavior

set -e

echo "🚀 Starting development smoke test..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Temporary log file
LOG_FILE=$(mktemp)
trap "rm -f $LOG_FILE" EXIT

# Start the dev server in the background
echo "📦 Starting dev server..."
cd "$(dirname "$0")/.."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ node_modules not found. Please run 'npm install' first.${NC}"
    exit 1
fi

# Kill any existing dev servers on port 5173
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Killing existing process on port 5173..."
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start dev server and capture output
npm run dev 2>&1 | tee $LOG_FILE &
DEV_PID=$!

# Give it time to start
echo "⏳ Waiting for dev server to start (10 seconds)..."
sleep 10

# Check if dev server is running
if ! kill -0 $DEV_PID 2>/dev/null; then
    echo -e "${RED}❌ Dev server failed to start${NC}"
    cat $LOG_FILE
    exit 1
fi

echo "✅ Dev server started successfully (PID: $DEV_PID)"
echo ""

# Analyze logs
echo "🔍 Analyzing console output..."
echo ""

# Count initialization occurrences
INIT_COUNT=$(grep -c "init:1" $LOG_FILE || true)
INIT_SKIPPED=$(grep -c "init:skipped" $LOG_FILE || true)

# Count CSP warnings
CSP_WARNING_COUNT=$(grep -c "Insecure Content-Security-Policy" $LOG_FILE || true)

# Count React StrictMode renders (should be 2x due to StrictMode, not more)
APP_RENDER_COUNT=$(grep -c "\[App\] render" $LOG_FILE || true)
APPCONTENT_RENDER_COUNT=$(grep -c "\[AppContent\] render" $LOG_FILE || true)

# Report results
echo "📊 Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FAILED=0

# Check initialization count (should be exactly 1)
if [ "$INIT_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✅ Initialization count: $INIT_COUNT (expected: 1)${NC}"
else
    echo -e "${RED}❌ Initialization count: $INIT_COUNT (expected: 1)${NC}"
    FAILED=1
fi

# Check CSP warnings (should be 0)
if [ "$CSP_WARNING_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ CSP warnings: $CSP_WARNING_COUNT (expected: 0)${NC}"
else
    echo -e "${RED}❌ CSP warnings: $CSP_WARNING_COUNT (expected: 0)${NC}"
    echo -e "${YELLOW}   Found CSP warnings in console output${NC}"
    FAILED=1
fi

# Check App render count (2 is acceptable due to StrictMode, more than 4 is excessive)
if [ "$APP_RENDER_COUNT" -ge 1 ] && [ "$APP_RENDER_COUNT" -le 4 ]; then
    echo -e "${GREEN}✅ App renders: $APP_RENDER_COUNT (acceptable: 1-4 for StrictMode)${NC}"
elif [ "$APP_RENDER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  App renders: $APP_RENDER_COUNT (logs may not have appeared yet)${NC}"
else
    echo -e "${RED}❌ App renders: $APP_RENDER_COUNT (acceptable: 1-4, excessive re-renders detected)${NC}"
    FAILED=1
fi

# Check AppContent render count
if [ "$APPCONTENT_RENDER_COUNT" -ge 1 ] && [ "$APPCONTENT_RENDER_COUNT" -le 4 ]; then
    echo -e "${GREEN}✅ AppContent renders: $APPCONTENT_RENDER_COUNT (acceptable: 1-4 for StrictMode)${NC}"
elif [ "$APPCONTENT_RENDER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  AppContent renders: $APPCONTENT_RENDER_COUNT (logs may not have appeared yet)${NC}"
else
    echo -e "${RED}❌ AppContent renders: $APPCONTENT_RENDER_COUNT (acceptable: 1-4, excessive re-renders detected)${NC}"
    FAILED=1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup
echo "🧹 Cleaning up..."
kill $DEV_PID 2>/dev/null || true
sleep 2

# Final result
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All smoke tests PASSED${NC}"
    echo ""
    echo "Summary:"
    echo "  - Single initialization verified"
    echo "  - No CSP warnings detected"
    echo "  - Render counts are within acceptable range"
    exit 0
else
    echo -e "${RED}❌ Smoke tests FAILED${NC}"
    echo ""
    echo "Issues found:"
    [ "$INIT_COUNT" -ne 1 ] && echo "  - Multiple initializations detected"
    [ "$CSP_WARNING_COUNT" -ne 0 ] && echo "  - CSP warnings present"
    [ "$APP_RENDER_COUNT" -gt 4 ] && echo "  - Excessive App re-renders"
    [ "$APPCONTENT_RENDER_COUNT" -gt 4 ] && echo "  - Excessive AppContent re-renders"
    echo ""
    echo "Review the log file for details:"
    echo "  $LOG_FILE"
    echo ""
    echo "Note: If this is the first run, the server may not have fully loaded."
    echo "Try running the script again or manually verify with 'npm run dev'"
    exit 1
fi

