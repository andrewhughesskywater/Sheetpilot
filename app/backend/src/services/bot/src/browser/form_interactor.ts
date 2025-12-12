// form_interactor.ts
import type { Locator, Page } from 'playwright';
import * as cfg from './automation_config';
import { botLogger } from '@sheetpilot/shared/logger';
import { FieldSpec } from './types';

export class FormInteractor {
  constructor(private readonly getPage: () => Page) {}

  async fillField(spec: FieldSpec, value: string): Promise<void> {
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

    if (['project_code', 'date', 'hours', 'task_description'].includes(fieldName)) {
      await this._checkValidationErrors(field, fieldName);
    }
  }

  // --- helpers (split same logic you already have) ---

  private async _isDropdownField(
    spec: FieldSpec,
    field: Locator,
  ): Promise<boolean> {
    // your existing heuristic here...
    return false;
  }

  private async _handleSmartsheetsDropdown(
    field: Locator,
    fieldName: string,
  ): Promise<void> {
    // your existing dropdown handling
  }

  private async _checkValidationErrors(
    field: Locator,
    fieldName: string,
  ): Promise<void> {
    // your existing validation logic
  }
}
