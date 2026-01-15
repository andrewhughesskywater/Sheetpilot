/**
 * @fileoverview Window API Type Definitions
 *
 * TypeScript definitions for Electron IPC APIs exposed via preload script.
 * All APIs are optional to support graceful degradation in development mode.
 *
 * This file serves as the main entry point that imports all window API contract modules.
 * Each API category is defined in its own file for better maintainability.
 *
 * API Categories:
 * - api: General utilities (ping)
 * - timesheet: Draft and submission operations
 * - credentials: Secure credential storage
 * - auth: Authentication and session management
 * - admin: Administrative operations (destructive)
 * - database: Archive data access
 * - logs: Log file operations
 * - logger: Structured logging
 * - updates: Auto-update system
 * - settings: Application configuration
 */

// Import all window API contract modules to ensure they are loaded
import "./window.api";
import "./window.timesheet";
import "./window.credentials";
import "./window.auth";
import "./window.admin";
import "./window.database";
import "./window.logs";
import "./window.logger";
import "./window.updates";
import "./window.settings";
import "./window.businessConfig";

export {};
