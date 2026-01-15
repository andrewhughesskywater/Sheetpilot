import { ipcRenderer } from 'electron';

export const businessConfigBridge = {
  // Read operations
  getAllProjects: (): Promise<{
    success: boolean;
    projects?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getAllProjects'),

  getProjectsWithoutTools: (): Promise<{
    success: boolean;
    projects?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getProjectsWithoutTools'),

  getToolsForProject: (project: string): Promise<{
    success: boolean;
    tools?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getToolsForProject', project),

  getAllTools: (): Promise<{
    success: boolean;
    tools?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getAllTools'),

  getToolsWithoutChargeCodes: (): Promise<{
    success: boolean;
    tools?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getToolsWithoutChargeCodes'),

  getAllChargeCodes: (): Promise<{
    success: boolean;
    chargeCodes?: readonly string[];
    error?: string;
  }> => ipcRenderer.invoke('business-config:getAllChargeCodes'),

  validateProject: (project: string): Promise<{
    success: boolean;
    isValid?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:validateProject', project),

  validateToolForProject: (tool: string, project: string): Promise<{
    success: boolean;
    isValid?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:validateToolForProject', tool, project),

  validateChargeCode: (chargeCode: string): Promise<{
    success: boolean;
    isValid?: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:validateChargeCode', chargeCode),

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
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:updateProject', token, id, updates),

  updateTool: (
    token: string,
    id: number,
    updates: {
      name?: string;
      requires_charge_code?: boolean;
      display_order?: number;
      is_active?: boolean;
    }
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:updateTool', token, id, updates),

  updateChargeCode: (
    token: string,
    id: number,
    updates: {
      name?: string;
      display_order?: number;
      is_active?: boolean;
    }
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:updateChargeCode', token, id, updates),

  addProject: (
    token: string,
    project: {
      name: string;
      requires_tools?: boolean;
      display_order?: number;
      is_active?: boolean;
    }
  ): Promise<{
    success: boolean;
    id?: number;
    error?: string;
  }> => ipcRenderer.invoke('business-config:addProject', token, project),

  addTool: (
    token: string,
    tool: {
      name: string;
      requires_charge_code?: boolean;
      display_order?: number;
      is_active?: boolean;
    }
  ): Promise<{
    success: boolean;
    id?: number;
    error?: string;
  }> => ipcRenderer.invoke('business-config:addTool', token, tool),

  addChargeCode: (
    token: string,
    chargeCode: {
      name: string;
      display_order?: number;
      is_active?: boolean;
    }
  ): Promise<{
    success: boolean;
    id?: number;
    error?: string;
  }> => ipcRenderer.invoke('business-config:addChargeCode', token, chargeCode),

  linkToolToProject: (
    token: string,
    projectId: number,
    toolId: number,
    displayOrder?: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:linkToolToProject', token, projectId, toolId, displayOrder),

  unlinkToolFromProject: (
    token: string,
    projectId: number,
    toolId: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> => ipcRenderer.invoke('business-config:unlinkToolFromProject', token, projectId, toolId),
};
