/**
 * @fileoverview Business Configuration - Main Entry Point
 *
 * Centralizes business rules and configuration data used throughout the application.
 * This file re-exports all business configuration modules for backward compatibility.
 *
 * For new code, prefer importing from specific modules:
 * - './business-config.static' - Static data arrays and types
 * - './business-config.sync' - Synchronous validation functions
 * - './business-config.async' - Async database-backed functions
 * - './business-config.window' - Window interface declarations
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025-10-01
 */

// Re-export window interface declarations
import "./business-config.window";

// Re-export static data and types
export * from "./business-config.static";

// Re-export synchronous business logic
export * from "./business-config.sync";

// Re-export async functions
export * from "./business-config.async";
