import { registerBusinessConfigChargeCodeHandlers } from "@/routes/business-config-handlers.charge-codes";
import { registerBusinessConfigProjectHandlers } from "@/routes/business-config-handlers.projects";
import { registerBusinessConfigReadHandlers } from "@/routes/business-config-handlers.read";
import { registerBusinessConfigToolHandlers } from "@/routes/business-config-handlers.tools";

export function registerBusinessConfigHandlers(): void {
  registerBusinessConfigReadHandlers();
  registerBusinessConfigProjectHandlers();
  registerBusinessConfigToolHandlers();
  registerBusinessConfigChargeCodeHandlers();
}
