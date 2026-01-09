/**
 * FieldProcessor: Encapsulates per-field processing logic for form automation
 *
 * Responsibility: Handle the details of preparing field specifications and injecting
 * field values into forms. This separates field-level concerns from the orchestration
 * workflow, reducing complexity in _fill_fields and improving testability.
 */

import * as Cfg from '../config/automation_config';
import type { WebformFiller } from '../browser/webform_flow';
import { botLogger } from '../../utils/logger';

export interface FieldProcessingContext {
  webformFiller: WebformFiller;
  fieldKey: string;
  value: unknown;
  allFields: Record<string, unknown>;
  shouldProcessField: (key: string, fields: Record<string, unknown>) => boolean;
  getProjectSpecificToolLocator: (projectName: string) => string | null;
}

export class FieldProcessor {
  /**
   * Prepares a field specification for injection, handling tool/detail_code
   * locator overrides and validation
   */
  static prepareFieldSpec(
    fieldKey: string,
    specBase: Record<string, unknown>,
    context: FieldProcessingContext
  ): Record<string, unknown> | null {
    const { allFields, shouldProcessField, getProjectSpecificToolLocator } = context;

    if (!shouldProcessField(fieldKey, allFields)) {
      botLogger.debug('Skipping field', { fieldKey, reason: 'Empty/invalid value', value: String(context.value) });
      return null;
    }

    const spec = { ...specBase };

    if (fieldKey === 'tool' || fieldKey === 'detail_code') {
      const projectName = String(allFields['project_code'] ?? 'Unknown');
      if (!shouldProcessField(fieldKey, allFields)) {
        botLogger.debug('Skipping field', {
          fieldKey,
          reason: 'Not required for project',
          projectName
        });
        return null;
      }

      if (fieldKey === 'tool') {
        const projectSpecificLocator = getProjectSpecificToolLocator(projectName);
        if (projectSpecificLocator) {
          spec['locator'] = projectSpecificLocator;
          botLogger.debug('Using project-specific locator', {
            fieldKey,
            projectName,
            locator: projectSpecificLocator
          });
        }
      }
    }

    return spec;
  }

  /**
   * Injects a single field value into the form
   */
  static async injectField(context: FieldProcessingContext, spec: Record<string, unknown>): Promise<void> {
    const { fieldKey, value, webformFiller } = context;

    try {
      botLogger.debug('Injecting field value', { fieldKey, value: String(value) });
      await webformFiller.injectFieldValue(spec, String(value));
    } catch (error) {
      botLogger.error('Could not process field', {
        fieldKey,
        value,
        fieldSpec: JSON.stringify(spec),
        error: String(error)
      });
      throw error;
    }
  }

  /**
   * Process a single field: prepare spec and inject value
   */
  static async processField(context: FieldProcessingContext): Promise<void> {
    const { fieldKey } = context;
    const specBase = Cfg.FIELD_DEFINITIONS[fieldKey] as unknown as Record<string, unknown>;

    if (!specBase) {
      botLogger.debug('Skipping field', { fieldKey, reason: 'No specification found' });
      return;
    }

    botLogger.debug('Processing field', { fieldKey, value: context.value });

    const spec = this.prepareFieldSpec(fieldKey, specBase, context);
    if (!spec) {
      return;
    }

    botLogger.debug('Field specification', {
      fieldKey,
      label: spec['label'] || 'No label',
      type: spec['type'] || 'text',
      locator: spec['locator'] || 'No locator'
    });

    await this.injectField(context, spec);
  }
}
