import { registerBusinessConfigChargeCodeHandlers } from "./business-config-handlers.charge-codes";
import { registerBusinessConfigProjectHandlers } from "./business-config-handlers.projects";
import { registerBusinessConfigReadHandlers } from "./business-config-handlers.read";
import { registerBusinessConfigToolHandlers } from "./business-config-handlers.tools";

export function registerBusinessConfigHandlers(): void {
  registerBusinessConfigReadHandlers();
  registerBusinessConfigProjectHandlers();
  registerBusinessConfigToolHandlers();
  registerBusinessConfigChargeCodeHandlers();
}
