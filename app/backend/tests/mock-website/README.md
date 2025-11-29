# Mock Timesheet Website

A mock website that simulates the real timesheet website for testing the bot automation. This server implements the complete login flow and form submission process that the bot expects.

## Features

- **Complete Login Flow**: Simulates the full authentication process
  - Email entry
  - SSO (Single Sign-On) choice
  - Azure AD (AAD) login simulation
  - Password entry
  - Stay signed in prompt

- **Timesheet Form**: Full form with all fields the bot expects
  - Project code
  - Date (mm/dd/yyyy format)
  - Hours
  - Tool (optional)
  - Task Description
  - Detail Charge Code (optional)

- **Form Submission**: Mimics the Smartsheet API endpoint
  - Returns proper JSON responses with submission IDs
  - Supports HTTP 200 status codes
  - Includes success indicators the bot looks for

## Setup

### Prerequisites

- Node.js 18+ (with ES modules support)
- npm or yarn

### Installation

1. Navigate to the mock website directory:
   ```bash
   cd app/backend/tests/mock-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Starting the Server

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

### Configuration

You can configure the server using environment variables:

- `MOCK_WEBSITE_PORT`: Port to run the server on (default: 3000)
- `MOCK_FORM_ID`: Form ID to use in submission endpoints (default: `0197cbae7daf72bdb96b3395b500d414`)
- `NODE_ENV`: Environment mode (development/production)

Example:
```bash
MOCK_WEBSITE_PORT=8080 MOCK_FORM_ID=your-form-id npm start
```

## Testing with the Bot

### 1. Start the Mock Website

```bash
cd app/backend/tests/mock-website
npm install
npm start
```

### 2. Configure the Bot to Use the Mock Website

Update your bot configuration to point to the mock website:

```typescript
import { createFormConfig } from './automation_config';

const formConfig = createFormConfig(
  'http://localhost:3000/form',  // Base URL
  '0197cbae7daf72bdb96b3395b500d414'  // Form ID
);
```

### 3. Run the Bot

The bot will now:
1. Navigate to `http://localhost:3000`
2. Complete the login flow automatically
3. Fill out the form
4. Submit to the mock endpoint

## API Endpoints

### Authentication

- `GET /` - Redirects to `/login` or `/form` based on authentication
- `GET /login` - Login page (email entry)
- `POST /login/email` - Submit email
- `GET /sso` - SSO choice page
- `POST /sso/choose` - Choose SSO option
- `GET /aad/login` - Azure AD email entry
- `POST /aad/email` - Submit AAD email
- `GET /aad/password` - Password entry page
- `POST /aad/password` - Submit password
- `GET /aad/stay-signed-in` - Stay signed in prompt
- `POST /aad/stay-signed-in` - Handle stay signed in choice

### Form

- `GET /form` - Timesheet form page
- `POST /api/submit/:formId` - Submit form (mimics Smartsheet API)

### Utility

- `GET /health` - Health check endpoint
- `GET /session` - Get current session info
- `POST /reset` - Reset current session

## Form Field Specifications

The form matches the bot's expected field locators:

| Field | Locator | Type |
|-------|---------|------|
| Project | `input[aria-label='Project']` | Text input |
| Date | `input[placeholder='mm/dd/yyyy']` | Text input |
| Hours | `input[aria-label='Hours']` | Number input |
| Tool | `input[aria-label*='Tool']` | Text input (optional) |
| Task Description | `role=textbox[name='Task Description']` | Textarea |
| Detail Charge Code | `input[aria-label='Detail Charge Code']` | Text input (optional) |
| Submit Button | `button[data-client-id='form_submit_btn']` | Button |

## Submission Response Format

The submission endpoint returns JSON in the format the bot expects:

```json
{
  "success": true,
  "submissionId": "sub_1234567890_abc123",
  "message": "Success! We've captured your submission.",
  "timestamp": "2025-01-XX...",
  "formId": "0197cbae7daf72bdb96b3395b500d414"
}
```

## Session Management

The server uses simple in-memory session storage. Each session tracks:
- Authentication status
- Email address
- Form ID

Sessions persist for the lifetime of the server process. To reset a session, use the `/reset` endpoint.

## Development

### File Structure

```
mock-website/
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── README.md             # This file
└── public/               # Static HTML files
    ├── login.html        # Login page
    ├── sso.html          # SSO choice page
    ├── aad-login.html    # Azure AD email entry
    ├── aad-password.html # Azure AD password entry
    ├── stay-signed-in.html # Stay signed in prompt
    └── form.html         # Timesheet form page
```

### Adding Features

To add new features or modify behavior:

1. **Modify server routes**: Edit `server.js`
2. **Update HTML pages**: Edit files in `public/`
3. **Change form fields**: Update `public/form.html` to match bot expectations

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, set a different port:

```bash
MOCK_WEBSITE_PORT=8080 npm start
```

### Bot Can't Connect

Make sure:
1. The mock website is running
2. The bot is configured with the correct base URL (`http://localhost:3000`)
3. No firewall is blocking the connection

### Authentication Not Working

Check:
1. Session cookies are enabled
2. The login flow URLs match what the bot expects
3. Session state is being maintained (check `/session` endpoint)

### Form Submission Failing

Verify:
1. The form ID matches in both the bot config and the server
2. The submission endpoint returns HTTP 200
3. The response format matches what the bot expects

## Notes

- This is a **mock server for testing only**. It does not provide real authentication or data persistence.
- All passwords are accepted for testing purposes.
- Sessions are stored in memory and will be lost when the server restarts.
- The server logs all form submissions to the console for debugging.
