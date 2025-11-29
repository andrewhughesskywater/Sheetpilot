# Quick Start Guide

Get the mock website up and running in 3 steps:

## Step 1: Install Dependencies

```bash
cd app/backend/tests/mock-website
npm install
```

## Step 2: Start the Server

```bash
npm start
```

You should see:
```
Mock Timesheet Website running at http://localhost:3000
```

## Step 3: Test It

Open your browser and visit:
- http://localhost:3000 - Should redirect to login
- http://localhost:3000/login - Login page
- http://localhost:3000/form - Timesheet form (requires login)

## Using with the Bot

To test the bot against the mock website, configure it like this:

```typescript
import { createFormConfig } from './automation_config';

// Point the bot to the mock website
const formConfig = createFormConfig(
  'http://localhost:3000/form',  // Base URL for the form
  '0197cbae7daf72bdb96b3395b500d414'  // Form ID
);

// Then run the bot normally
await runTimesheet(
  rows,
  'test@example.com',  // Any email works
  'testpassword',      // Any password works
  formConfig
);
```

## Example Bot Configuration

If you're using quarter-based routing, you might need to override the BASE_URL:

```typescript
// In your test setup
const mockFormConfig = {
  BASE_URL: 'http://localhost:3000',
  FORM_ID: '0197cbae7daf72bdb96b3395b500d414',
  SUBMISSION_ENDPOINT: 'http://localhost:3000/api/submit/0197cbae7daf72bdb96b3395b500d414',
  SUBMIT_SUCCESS_RESPONSE_URL_PATTERNS: [
    '**localhost:3000/**',
    '**/api/submit/**'
  ]
};

// Use this config when creating the bot
const bot = new BotOrchestrator(Cfg, mockFormConfig, false);
```

## Troubleshooting

### Port 3000 already in use?

```bash
MOCK_WEBSITE_PORT=8080 npm start
```

Then update your bot config to use `http://localhost:8080`

### Bot can't find the form?

Make sure:
1. The mock website is running (check http://localhost:3000/health)
2. The BASE_URL in bot config matches the mock website URL
3. The form ID matches (default: `0197cbae7daf72bdb96b3395b500d414`)

### Check if server is working

Visit http://localhost:3000/health - should return JSON with status "ok"

## Next Steps

See [README.md](./README.md) for full documentation.
