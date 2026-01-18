import { z } from 'zod';

export const emailSchema = z.string()
  .regex(/^(?!\.)(?!.*\.\.)[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')
  .refine((email) => {
    // Additional validation: no consecutive dots in local or domain part
    const [local, domain] = email.split('@');
    if (!local || !domain) return false;
    return !local.includes('..') && !domain.includes('..');
  }, 'Invalid email format')
  .min(3, 'Email must be at least 3 characters')
  .max(255, 'Email must not exceed 255 characters');

export const passwordSchema = z.string()
  .min(1, 'Password is required')
  .max(1000, 'Password too long'); // Allow long passwords but have reasonable upper limit

export const serviceNameSchema = z.string()
  .min(1, 'Service name is required')
  .max(100, 'Service name too long')
  .regex(/^[a-z0-9_-]+$/i, 'Service name must contain only letters, numbers, hyphens, and underscores');

export const sessionTokenSchema = z.string()
  .uuid('Invalid session token format');

export const dateSchema = z.string()
  .regex(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/, 'Invalid date format. Use YYYY-MM-DD or MM/DD/YYYY');

export const timeSchema = z.string()
  .regex(/^([0-1]?[0-9]|2[0-3]):[0-5]?[0-9]$/, 'Invalid time format. Use H:MM or HH:MM');

export const projectNameSchema = z.string()
  .min(1, 'Project name is required')
  .max(500, 'Project name too long');

export const taskDescriptionSchema = z.string()
  .min(1, 'Task description is required')
  .max(5000, 'Task description too long');

export const storeCredentialsSchema = z.object({
  service: serviceNameSchema,
  email: emailSchema,
  password: passwordSchema
});

export const deleteCredentialsSchema = z.object({
  service: serviceNameSchema
});

export const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .max(255, 'Email must not exceed 255 characters')
    .refine((val) => {
      // Allow 'admin' as a special case for admin login
      if (val === 'admin') return true;
      // Otherwise validate as email
      return emailSchema.safeParse(val).success;
    }, 'Invalid email format'),
  password: passwordSchema,
  stayLoggedIn: z.boolean()
});

export const validateSessionSchema = z.object({
  token: sessionTokenSchema
});

export const logoutSchema = z.object({
  token: sessionTokenSchema
});

export const getCurrentSessionSchema = z.object({
  token: sessionTokenSchema
});


export const saveDraftSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  date: dateSchema.optional(),
  hours: z.number()
    .min(0.25, 'Hours must be at least 0.25')
    .max(24.0, 'Hours must not exceed 24.0')
    .refine((val) => {
      // Validate 15-minute increments (multiples of 0.25)
      const remainder = (val * 4) % 1;
      return Math.abs(remainder) < 0.0001 || Math.abs(remainder - 1) < 0.0001;
    }, 'Hours must be in 15-minute increments (0.25, 0.5, 0.75, etc.)')
    .optional(),
  project: projectNameSchema.optional(),
  tool: z.string().max(500).nullable().optional(),
  chargeCode: z.string().max(100).nullable().optional(),
  taskDescription: taskDescriptionSchema.optional()
});

export const deleteDraftSchema = z.object({
  id: z.number().int().positive('Valid ID is required')
});

export const submitTimesheetsSchema = z.object({
  token: sessionTokenSchema
});

export const adminTokenSchema = z.object({
  token: sessionTokenSchema
});

export const getAllTimesheetEntriesSchema = z.object({
  token: sessionTokenSchema
});

export const readLogFileSchema = z.object({
  logPath: z.string().min(1).max(1000)
});

export const exportLogsSchema = z.object({
  logPath: z.string().min(1).max(1000),
  exportFormat: z.enum(['json', 'txt']).optional()
});

export const getToolsForProjectSchema = z.object({
  project: z.string().min(1).max(500)
});

export const validateProjectSchema = z.object({
  project: z.string().min(1).max(500)
});

export const validateToolForProjectSchema = z.object({
  tool: z.string().min(1).max(500),
  project: z.string().min(1).max(500)
});

export const validateChargeCodeSchema = z.object({
  chargeCode: z.string().min(1).max(100)
});

export const businessConfigProjectUpdateSchema = z.object({
  token: sessionTokenSchema,
  id: z.number().int().positive(),
  updates: z.object({
    name: z.string().min(1).max(500).optional(),
    requires_tools: z.boolean().optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const businessConfigToolUpdateSchema = z.object({
  token: sessionTokenSchema,
  id: z.number().int().positive(),
  updates: z.object({
    name: z.string().min(1).max(500).optional(),
    requires_charge_code: z.boolean().optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const businessConfigChargeCodeUpdateSchema = z.object({
  token: sessionTokenSchema,
  id: z.number().int().positive(),
  updates: z.object({
    name: z.string().min(1).max(100).optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const businessConfigProjectCreateSchema = z.object({
  token: sessionTokenSchema,
  project: z.object({
    name: z.string().min(1).max(500),
    requires_tools: z.boolean().optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const businessConfigToolCreateSchema = z.object({
  token: sessionTokenSchema,
  tool: z.object({
    name: z.string().min(1).max(500),
    requires_charge_code: z.boolean().optional(),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const businessConfigChargeCodeCreateSchema = z.object({
  token: sessionTokenSchema,
  chargeCode: z.object({
    name: z.string().min(1).max(100),
    display_order: z.number().int().optional(),
    is_active: z.boolean().optional()
  })
});

export const linkToolToProjectSchema = z.object({
  token: sessionTokenSchema,
  projectId: z.number().int().positive(),
  toolId: z.number().int().positive(),
  displayOrder: z.number().int().optional()
});

export const unlinkToolFromProjectSchema = z.object({
  token: sessionTokenSchema,
  projectId: z.number().int().positive(),
  toolId: z.number().int().positive()
});

export type StoreCredentials = z.infer<typeof storeCredentialsSchema>;
export type DeleteCredentials = z.infer<typeof deleteCredentialsSchema>;
export type Login = z.infer<typeof loginSchema>;
export type ValidateSession = z.infer<typeof validateSessionSchema>;
export type Logout = z.infer<typeof logoutSchema>;
export type GetCurrentSession = z.infer<typeof getCurrentSessionSchema>;
export type SaveDraft = z.infer<typeof saveDraftSchema>;
export type DeleteDraft = z.infer<typeof deleteDraftSchema>;
export type SubmitTimesheets = z.infer<typeof submitTimesheetsSchema>;
export type AdminToken = z.infer<typeof adminTokenSchema>;
export type GetAllTimesheetEntries = z.infer<typeof getAllTimesheetEntriesSchema>;
export type ReadLogFile = z.infer<typeof readLogFileSchema>;
export type ExportLogs = z.infer<typeof exportLogsSchema>;
export type GetToolsForProject = z.infer<typeof getToolsForProjectSchema>;
export type ValidateProject = z.infer<typeof validateProjectSchema>;
export type ValidateToolForProject = z.infer<typeof validateToolForProjectSchema>;
export type ValidateChargeCode = z.infer<typeof validateChargeCodeSchema>;
export type BusinessConfigProjectUpdate = z.infer<typeof businessConfigProjectUpdateSchema>;
export type BusinessConfigToolUpdate = z.infer<typeof businessConfigToolUpdateSchema>;
export type BusinessConfigChargeCodeUpdate = z.infer<typeof businessConfigChargeCodeUpdateSchema>;
export type BusinessConfigProjectCreate = z.infer<typeof businessConfigProjectCreateSchema>;
export type BusinessConfigToolCreate = z.infer<typeof businessConfigToolCreateSchema>;
export type BusinessConfigChargeCodeCreate = z.infer<typeof businessConfigChargeCodeCreateSchema>;
export type LinkToolToProject = z.infer<typeof linkToolToProjectSchema>;
export type UnlinkToolFromProject = z.infer<typeof unlinkToolFromProjectSchema>;


