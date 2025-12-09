# Security Model

This document describes the security architecture and decisions for Sheetpilot.

## Security Architecture

### Renderer Process Security

Sheetpilot follows Electron security best practices:

- **Context Isolation**: Enabled - isolates renderer JavaScript from Node.js APIs
- **Node Integration**: Disabled - prevents direct access to Node.js from renderer
- **Sandbox**: Enabled - provides additional isolation for the renderer process
- **Web Security**: Enabled - enforces same-origin policy and other web security features

### Custom Protocol Handler

Sheetpilot uses a custom protocol handler (`sheetpilot://`) instead of the `file://` protocol. This allows:

1. **Sandbox Compatibility**: The sandbox can remain enabled while loading local files
2. **Path Validation**: All file paths are validated and sanitized to prevent directory traversal attacks
3. **Controlled Access**: Only files within the application's resource directory can be accessed

The protocol handler is registered before the app is ready and validates all paths to ensure they are within the allowed application directory.

### Content Security Policy (CSP)

The application uses Content Security Policy to prevent XSS attacks:

- **Production**: Strict CSP with custom protocol support
- **Development**: More permissive CSP to allow Vite HMR (Hot Module Replacement)

**Note**: The current CSP includes `'unsafe-inline'` for scripts and styles. This is a known limitation and should be addressed in future versions using nonces or hashes.

### IPC Communication

All communication between the renderer and main process uses Electron's IPC (Inter-Process Communication) with:

- **Context Bridge**: Secure API exposure via `contextBridge.exposeInMainWorld()`
- **Input Validation**: All IPC handlers validate and sanitize inputs
- **Error Handling**: Comprehensive error handling prevents information leakage

## Code Signing

### Windows

Windows builds support code signing to prevent "Unknown Publisher" warnings. To enable:

1. Obtain a code signing certificate (.p12 or .pfx file)
2. Set environment variables:
   - `CSC_LINK`: Path to certificate file
   - `CSC_KEY_PASSWORD`: Certificate password
3. Build will automatically sign the executable

If certificates are not available, the build will continue without signing.

### macOS

macOS builds support notarization for distribution outside the App Store. To enable:

1. Set environment variables:
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_ID_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: Your Apple Developer Team ID
2. Build will automatically notarize the application

If credentials are not available, the build will continue without notarization.

## Dependencies

### Large Dependencies

**Playwright**: Playwright and Chromium (~200MB+) are bundled for browser automation functionality. This is intentional and required for the timesheet submission bot feature.

### Native Modules

**better-sqlite3**: Native SQLite bindings are rebuilt for Electron using `@electron/rebuild` to ensure compatibility with Electron's Node.js version.

## Security Considerations

### Known Limitations

1. **CSP unsafe-inline**: The current CSP allows inline scripts and styles. This should be replaced with nonces or hashes in a future version.

2. **Development Mode**: Development mode uses more permissive security settings to enable hot reloading. Never use development builds in production.

### Best Practices

1. **Keep Dependencies Updated**: Regularly update Electron and all dependencies to receive security patches
2. **Validate All Inputs**: All user inputs and IPC messages are validated
3. **Principle of Least Privilege**: The application only requests necessary permissions
4. **Secure Storage**: Credentials are encrypted before storage
5. **Error Handling**: Errors are logged but sensitive information is not exposed to users

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. Do not open a public issue
2. Contact the maintainer directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before public disclosure

## References

- [Electron Security Guidelines](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Electron Security](https://owasp.org/www-community/vulnerabilities/Electron_Security)

