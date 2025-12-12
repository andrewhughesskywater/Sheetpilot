/**
 * Compatibility re-export for BotOrchestrator.
 *
 * The implementation lives under `src/core/bot_orchestation.ts`, but consumers
 * historically imported from `src/bot_orchestation`.
 *
 * Prefer importing `BotOrchestrator` from `src/core/` in new code.
 */
export * from './core/bot_orchestation';

