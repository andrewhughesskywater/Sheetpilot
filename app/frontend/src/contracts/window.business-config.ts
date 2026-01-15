/**
 * @fileoverview Window API - Business Configuration operations
 */

export {};

declare global {
  interface Window {
    /**
     * Business configuration operations
     *
     * Handles reading and updating business configuration data.
     */
    businessConfig?: {
      // Read operations
      getAllProjects: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      getProjectsWithoutTools: () => Promise<{
        success: boolean;
        projects?: readonly string[];
        error?: string;
      }>;
      getToolsForProject: (project: string) => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getAllTools: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getToolsWithoutChargeCodes: () => Promise<{
        success: boolean;
        tools?: readonly string[];
        error?: string;
      }>;
      getAllChargeCodes: () => Promise<{
        success: boolean;
        chargeCodes?: readonly string[];
        error?: string;
      }>;
      validateProject: (project: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      validateToolForProject: (tool: string, project: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      validateChargeCode: (chargeCode: string) => Promise<{
        success: boolean;
        isValid?: boolean;
        error?: string;
      }>;
      // Admin write operations
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
      linkToolToProject: (
        token: string,
        projectId: number,
        toolId: number,
        displayOrder?: number
      ) => Promise<{
        success: boolean;
        error?: string;
      }>;
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
