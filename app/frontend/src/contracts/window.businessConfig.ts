/**
 * @fileoverview Window API - Business Configuration
 */

export {};

declare global {
  interface Window {
    /**
     * Business configuration API
     */
    businessConfig?: {
      /** Gets all available projects */
      getAllProjects: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      /** Gets projects that do not require tools */
      getProjectsWithoutTools: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      /** Gets tools for a specific project */
      getToolsForProject: (project: string) => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      /** Gets all available tools */
      getAllTools: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      /** Gets tools that do not require charge codes */
      getToolsWithoutChargeCodes: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      /** Gets all available charge codes */
      getAllChargeCodes: () => Promise<{
        success: boolean;
        chargeCodes?: readonly string[];
        error?: string;
      }>;
      /** Validates if a project is valid */
      validateProject: (project: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      /** Validates if a tool is valid for a given project */
      validateToolForProject: (
        tool: string,
        project: string
      ) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      /** Validates if a charge code is valid */
      validateChargeCode: (chargeCode: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      /** Updates a project (admin only) */
      updateProject: (
        token: string,
        id: number,
        updates: {
          name?: string;
          requires_tools?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      /** Updates a tool (admin only) */
      updateTool: (
        token: string,
        id: number,
        updates: {
          name?: string;
          requires_charge_code?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      /** Updates a charge code (admin only) */
      updateChargeCode: (
        token: string,
        id: number,
        updates: {
          name?: string;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      /** Adds a new project (admin only) */
      addProject: (
        token: string,
        project: {
          name: string;
          requires_tools?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      /** Adds a new tool (admin only) */
      addTool: (
        token: string,
        tool: {
          name: string;
          requires_charge_code?: boolean;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      /** Adds a new charge code (admin only) */
      addChargeCode: (
        token: string,
        chargeCode: {
          name: string;
          display_order?: number;
          is_active?: boolean;
        }
      ) => Promise<{
        success: boolean;
        id?: number;
        error?: string;
      }>;
      /** Links a tool to a project (admin only) */
      linkToolToProject: (
        token: string,
        projectId: number,
        toolId: number,
        displayOrder?: number
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
      /** Unlinks a tool from a project (admin only) */
      unlinkToolFromProject: (
        token: string,
        projectId: number,
        toolId: number
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
    };
  }
}
