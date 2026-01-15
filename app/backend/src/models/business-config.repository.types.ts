/**
 * @fileoverview Business Configuration Repository Types
 *
 * Type definitions for business configuration database entities and operations.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

/**
 * Project entity from database
 */
export interface Project {
  id: number;
  name: string;
  requires_tools: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Tool entity from database
 */
export interface Tool {
  id: number;
  name: string;
  requires_charge_code: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Charge code entity from database
 */
export interface ChargeCode {
  id: number;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Tool-project link entity from database
 */
export interface ToolProjectLink {
  id: number;
  project_id: number;
  tool_id: number;
  display_order: number;
}

/**
 * Project update payload
 */
export interface ProjectUpdate {
  name?: string;
  requires_tools?: boolean;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Tool update payload
 */
export interface ToolUpdate {
  name?: string;
  requires_charge_code?: boolean;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Charge code update payload
 */
export interface ChargeCodeUpdate {
  name?: string;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Project create payload
 */
export interface ProjectCreate {
  name: string;
  requires_tools?: boolean;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Tool create payload
 */
export interface ToolCreate {
  name: string;
  requires_charge_code?: boolean;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Charge code create payload
 */
export interface ChargeCodeCreate {
  name: string;
  display_order?: number;
  is_active?: boolean;
}
