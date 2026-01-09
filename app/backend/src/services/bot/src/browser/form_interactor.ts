/**
 * FormInteractor: small helpers for filling fields on a Smartsheet form.
 *
 * This module is currently **not wired** into `BotOrchestrator` / `WebformFiller`.
 * It exists as a more testable/focused alternative to `WebformFiller.inject_field_value`.
 *
 * Design intent:
 * - treat each field fill as an operation with clear preconditions (visible/ready)
 * - add lightweight heuristics for Smartsheet combobox/dropdown behavior
 * - optionally observe validation state (without hard-failing on UI variability)
 */
import type { Locator, Page } from 'playwright';
import * as cfg from '../automation_config';
import { botLogger } from '../../utils/logger';

export type FieldSpec = {
  label?: string;
  locator?: string;
  type?: string;
  optional?: boolean;
  inject_value?: boolean;
};

export class FormInteractor {
  constructor(private readonly getPage: () => Page) {}

  async fillField(spec: FieldSpec, value: string): Promise<void> {
    // `label` comes from the field spec. It is used only for logs and errors.
    // If you need key-based logic, pass a separate stable identifier.
    const fieldName = spec.label ?? 'Unknown Field';
    const locatorSel = spec.locator;
    if (!locatorSel) {
      throw new Error(`Field locator is missing for field: ${fieldName}`);
    }

    const page = this.getPage();
    const field = page.locator(locatorSel);

    botLogger.debug('Waiting for field to become visible', {
      fieldName,
      locatorSel,
    });

    const ok = await cfg.dynamic_wait_for_element(
      page,
      locatorSel,
      'visible',
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.GLOBAL_TIMEOUT,
    );
    if (!ok) {
      throw new Error(
        `Field '${fieldName}' did not become visible within timeout`,
      );
    }

    await field.fill('');
    await field.fill(String(value));

    if (await this._isDropdownField(spec, field)) {
      await this._handleSmartsheetsDropdown(field, fieldName);
    }

    // NOTE: This list uses internal field keys, but `fieldName` defaults to `spec.label`.
    // If `spec.label` is a human label like "Project", this check will not run.
    if (['project_code', 'date', 'hours', 'task_description'].includes(fieldName)) {
      await this._checkValidationErrors(field, fieldName);
    }
  }

  // --- helpers (split same logic you already have) ---

  private async _isDropdownField(
    spec: FieldSpec,
    field: Locator,
  ): Promise<boolean> {
    const explicitType = (spec.type ?? '').toLowerCase();
    if (explicitType === 'dropdown' || explicitType === 'select') return true;

    // Heuristic: Smartsheet dropdowns often advertise listbox semantics.
    const ariaHaspopup = (await field.getAttribute('aria-haspopup').catch(() => null)) ?? '';
    const role = (await field.getAttribute('role').catch(() => null)) ?? '';
    const ariaExpanded = (await field.getAttribute('aria-expanded').catch(() => null)) ?? '';
    const looksLikeDropdown =
      ariaHaspopup.toLowerCase().includes('listbox') ||
      role.toLowerCase().includes('combobox') ||
      ariaExpanded.length > 0;

    botLogger.debug('Dropdown heuristic evaluated', {
      explicitType,
      ariaHaspopup,
      role,
      ariaExpanded,
      looksLikeDropdown,
    });

    return looksLikeDropdown;
  }

  private async _handleSmartsheetsDropdown(
    field: Locator,
    fieldName: string,
  ): Promise<void> {
    const page = this.getPage();
    botLogger.debug('Handling dropdown selection', { fieldName });

    // Give the UI a brief moment to populate dropdown suggestions, then accept selection.
    await cfg.wait_for_dropdown_options(
      page,
      '[role="listbox"]',
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.DYNAMIC_WAIT_MAX_TIMEOUT,
    );

    await field.press('Enter').catch((err: unknown) => {
      botLogger.warn('Could not press Enter on dropdown field', {
        fieldName,
        error: String(err),
      });
    });
  }

  private async _checkValidationErrors(
    field: Locator,
    fieldName: string,
  ): Promise<void> {
    const page = this.getPage();

    // Wait briefly for validation to settle. We intentionally avoid throwing here
    // because validation patterns vary across Smartsheet forms.
    await cfg.wait_for_validation_stability(
      page,
      'form',
      cfg.DYNAMIC_WAIT_BASE_TIMEOUT,
      cfg.DYNAMIC_WAIT_MAX_TIMEOUT,
    );

    const ariaInvalid = await field.getAttribute('aria-invalid').catch(() => null);
    if (ariaInvalid && ariaInvalid !== 'false') {
      botLogger.warn('Field shows invalid state', { fieldName, ariaInvalid });
    }
  }
}
