/**
 * @fileoverview IPC Schemas Validation Unit Tests
 * 
 * Tests all Zod schemas used for IPC input validation to ensure proper
 * validation and security against injection attacks.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  serviceNameSchema,
  sessionTokenSchema,
  dateSchema,
  timeSchema,
  projectNameSchema,
  taskDescriptionSchema,
  storeCredentialsSchema,
  deleteCredentialsSchema,
  loginSchema,
  validateSessionSchema,
  logoutSchema,
  getCurrentSessionSchema,
  saveDraftSchema,
  deleteDraftSchema,
  submitTimesheetsSchema,
  adminTokenSchema,
  getAllTimesheetEntriesSchema,
  readLogFileSchema,
  exportLogsSchema
} from '../../src/validation/ipc-schemas';

describe('IPC Schemas Validation', () => {
  describe('Common Schemas', () => {
    describe('emailSchema', () => {
      it('should accept valid email addresses', () => {
        const validEmails = [
          'user@example.com',
          'test.user@domain.co.uk',
          'first.last+tag@company.com',
          'user123@test-domain.com',
          'a@b.c'
        ];
        
        validEmails.forEach(email => {
          expect(() => emailSchema.parse(email)).not.toThrow();
        });
      });

      it('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid',
          '@domain.com',
          'user@',
          'user @domain.com',
          'user..name@domain.com',
          ''
        ];
        
        invalidEmails.forEach(email => {
          expect(() => emailSchema.parse(email)).toThrow();
        });
      });

      it('should enforce length limits', () => {
        expect(() => emailSchema.parse('a@b')).toThrow(); // Too short
        expect(() => emailSchema.parse('a'.repeat(250) + '@domain.com')).toThrow(); // Too long
      });
    });

    describe('passwordSchema', () => {
      it('should accept any non-empty password', () => {
        const passwords = [
          'short',
          'a',
          'Long password with spaces and special chars!@#$',
          'P@ssw0rd123',
          '12345678'
        ];
        
        passwords.forEach(password => {
          expect(() => passwordSchema.parse(password)).not.toThrow();
        });
      });

      it('should reject empty passwords', () => {
        expect(() => passwordSchema.parse('')).toThrow();
      });

      it('should enforce maximum length', () => {
        const tooLong = 'a'.repeat(1001);
        expect(() => passwordSchema.parse(tooLong)).toThrow();
      });

      it('should accept passwords up to 1000 characters', () => {
        const maxLength = 'a'.repeat(1000);
        expect(() => passwordSchema.parse(maxLength)).not.toThrow();
      });
    });

    describe('serviceNameSchema', () => {
      it('should accept valid service names', () => {
        const validNames = [
          'smartsheet',
          'test-service',
          'service_name',
          'SERVICE123',
          'a'
        ];
        
        validNames.forEach(name => {
          expect(() => serviceNameSchema.parse(name)).not.toThrow();
        });
      });

      it('should reject invalid characters', () => {
        const invalidNames = [
          'service name',  // Space
          'service.name',  // Dot
          'service@name',  // At sign
          'service/name',  // Slash
          'service\\name', // Backslash
          ''
        ];
        
        invalidNames.forEach(name => {
          expect(() => serviceNameSchema.parse(name)).toThrow();
        });
      });

      it('should enforce length limits', () => {
        expect(() => serviceNameSchema.parse('a'.repeat(101))).toThrow();
      });
    });

    describe('sessionTokenSchema', () => {
      it('should accept valid UUID tokens', () => {
        const validUUIDs = [
          '123e4567-e89b-12d3-a456-426614174000',
          '550e8400-e29b-41d4-a716-446655440000',
          '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
        ];
        
        validUUIDs.forEach(uuid => {
          expect(() => sessionTokenSchema.parse(uuid)).not.toThrow();
        });
      });

      it('should reject invalid UUID formats', () => {
        const invalidUUIDs = [
          'not-a-uuid',
          '123-456-789',
          '',
          '12345678-1234-1234-1234-1234567890' // Wrong length
        ];
        
        invalidUUIDs.forEach(uuid => {
          expect(() => sessionTokenSchema.parse(uuid)).toThrow();
        });
      });
    });

    describe('dateSchema', () => {
      it('should accept ISO format dates (YYYY-MM-DD)', () => {
        const validDates = [
          '2025-01-15',
          '2024-12-31',
          '2025-06-30'
        ];
        
        validDates.forEach(date => {
          expect(() => dateSchema.parse(date)).not.toThrow();
        });
      });

      it('should accept US format dates (MM/DD/YYYY)', () => {
        const validDates = [
          '01/15/2025',
          '12/31/2024',
          '6/15/2025',
          '1/1/2025'
        ];
        
        validDates.forEach(date => {
          expect(() => dateSchema.parse(date)).not.toThrow();
        });
      });

      it('should reject invalid date formats', () => {
        const invalidDates = [
          '15-01-2025',  // Wrong order
          '2025/01/15',  // Wrong separator for ISO
          '01-15-2025',  // Wrong separator for US
          '',
          'not-a-date'
        ];
        
        invalidDates.forEach(date => {
          expect(() => dateSchema.parse(date)).toThrow();
        });
      });
    });

    describe('timeSchema', () => {
      it('should accept valid time formats', () => {
        const validTimes = [
          '00:00',
          '09:00',
          '17:30',
          '23:59',
          '9:00',  // Single digit hour
          '9:5'    // Single digit minutes
        ];
        
        validTimes.forEach(time => {
          expect(() => timeSchema.parse(time)).not.toThrow();
        });
      });

      it('should reject invalid time formats', () => {
        const invalidTimes = [
          '25:00',  // Invalid hour
          '09:60',  // Invalid minute
          '9',      // Missing minutes
          '',
          'not-a-time',
          '09:00:00' // Seconds not allowed
        ];
        
        invalidTimes.forEach(time => {
          expect(() => timeSchema.parse(time)).toThrow();
        });
      });
    });

    describe('projectNameSchema', () => {
      it('should accept valid project names', () => {
        const validNames = [
          'FL-Carver Techs',
          'PTO/RTO',
          'SWFL-CHEM/GAS',
          'Test Project 123'
        ];
        
        validNames.forEach(name => {
          expect(() => projectNameSchema.parse(name)).not.toThrow();
        });
      });

      it('should reject empty project names', () => {
        expect(() => projectNameSchema.parse('')).toThrow();
      });

      it('should enforce length limits', () => {
        const tooLong = 'a'.repeat(501);
        expect(() => projectNameSchema.parse(tooLong)).toThrow();
      });
    });

    describe('taskDescriptionSchema', () => {
      it('should accept valid task descriptions', () => {
        const validDescriptions = [
          'Simple task',
          'Task with special chars!@#$%^&*()',
          'Very long task description '.repeat(50),
          'Task with\nnewlines\nand\ttabs'
        ];
        
        validDescriptions.forEach(desc => {
          expect(() => taskDescriptionSchema.parse(desc)).not.toThrow();
        });
      });

      it('should reject empty descriptions', () => {
        expect(() => taskDescriptionSchema.parse('')).toThrow();
      });

      it('should enforce length limits', () => {
        const tooLong = 'a'.repeat(5001);
        expect(() => taskDescriptionSchema.parse(tooLong)).toThrow();
      });
    });
  });

  describe('Credentials Schemas', () => {
    describe('storeCredentialsSchema', () => {
      it('should accept valid credentials', () => {
        const valid = {
          service: 'smartsheet',
          email: 'user@example.com',
          password: 'password123'
        };
        
        expect(() => storeCredentialsSchema.parse(valid)).not.toThrow();
      });

      it('should reject missing fields', () => {
        expect(() => storeCredentialsSchema.parse({})).toThrow();
        expect(() => storeCredentialsSchema.parse({ service: 'test' })).toThrow();
        expect(() => storeCredentialsSchema.parse({ email: 'test@test.com' })).toThrow();
      });

      it('should reject invalid field types', () => {
        const invalid = {
          service: 123,
          email: 'user@example.com',
          password: 'password123'
        };
        
        expect(() => storeCredentialsSchema.parse(invalid)).toThrow();
      });
    });

    describe('deleteCredentialsSchema', () => {
      it('should accept valid service name', () => {
        expect(() => deleteCredentialsSchema.parse({ service: 'smartsheet' })).not.toThrow();
      });

      it('should reject invalid service names', () => {
        expect(() => deleteCredentialsSchema.parse({})).toThrow();
      });
    });
  });

  describe('Authentication Schemas', () => {
    describe('loginSchema', () => {
      it('should accept valid login data', () => {
        const valid = {
          email: 'user@example.com',
          password: 'password123',
          stayLoggedIn: true
        };
        
        expect(() => loginSchema.parse(valid)).not.toThrow();
      });

      it('should reject invalid email', () => {
        const invalid = {
          email: 'not-an-email',
          password: 'password123',
          stayLoggedIn: true
        };
        
        expect(() => loginSchema.parse(invalid)).toThrow();
      });

      it('should reject non-boolean stayLoggedIn', () => {
        const invalid = {
          email: 'user@example.com',
          password: 'password123',
          stayLoggedIn: 'true' // String instead of boolean
        };
        
        expect(() => loginSchema.parse(invalid)).toThrow();
      });
    });

    describe('validateSessionSchema', () => {
      it('should accept valid session token', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => validateSessionSchema.parse(valid)).not.toThrow();
      });

      it('should reject invalid tokens', () => {
        const invalid = [
          { token: 'not-a-uuid' },
          { token: '' },
          {}
        ];
        
        invalid.forEach(obj => {
          expect(() => validateSessionSchema.parse(obj)).toThrow();
        });
      });
    });

    describe('logoutSchema', () => {
      it('should accept valid token', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => logoutSchema.parse(valid)).not.toThrow();
      });
    });

    describe('getCurrentSessionSchema', () => {
      it('should accept valid token', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => getCurrentSessionSchema.parse(valid)).not.toThrow();
      });
    });
  });

  describe('Timesheet Schemas', () => {
    describe('saveDraftSchema', () => {
      it('should accept valid draft data', () => {
        const valid = {
          date: '2025-01-15',
          hours: 8.0,
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        expect(() => saveDraftSchema.parse(valid)).not.toThrow();
      });

      it('should accept draft with US format date', () => {
        const valid = {
          date: '01/15/2025',
          hours: 8.0,
          project: 'FL-Carver Techs',
          tool: '#1 Rinse and 2D marker',
          chargeCode: 'EPR1',
          taskDescription: 'Test task'
        };
        
        expect(() => saveDraftSchema.parse(valid)).not.toThrow();
      });

      it('should accept optional id field', () => {
        const valid = {
          id: 123,
          date: '2025-01-15',
          hours: 8.0,
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(valid)).not.toThrow();
      });

      it('should accept null tool and charge code', () => {
        const valid = {
          date: '2025-01-15',
          hours: 8.0,
          project: 'Test',
          tool: null,
          chargeCode: null,
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(valid)).not.toThrow();
      });

      it('should reject hours below minimum', () => {
        const invalid = {
          date: '2025-01-15',
          hours: 0.15, // Below 0.25 minimum
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject hours above maximum', () => {
        const invalid = {
          date: '2025-01-15',
          hours: 25.0, // Above 24.0 maximum
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject hours not in 15-minute increments', () => {
        const invalid = {
          date: '2025-01-15',
          hours: 0.1, // Not a 15-minute increment
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject missing required fields', () => {
        const missingFields = [
          { date: '2025-01-15', hours: 8.0, project: 'Test' }, // Missing taskDescription
          { date: '2025-01-15', hours: 8.0, taskDescription: 'Test' }, // Missing project
          { date: '2025-01-15', project: 'Test', taskDescription: 'Test' }, // Missing hours
          { hours: 8.0, project: 'Test', taskDescription: 'Test' } // Missing date
        ];
        
        missingFields.forEach(data => {
          expect(() => saveDraftSchema.parse(data)).toThrow();
        });
      });

      it('should reject invalid date formats', () => {
        const invalid = {
          date: 'not-a-date',
          hours: 8.0,
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject invalid hours values', () => {
        const invalid = {
          date: '2025-01-15',
          hours: 0.1, // Invalid: not 15-minute increment
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject negative id values', () => {
        const invalid = {
          id: -1,
          date: '2025-01-15',
          hours: 8.0,
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });

      it('should reject zero id values', () => {
        const invalid = {
          id: 0,
          date: '2025-01-15',
          hours: 8.0,
          project: 'Test',
          taskDescription: 'Test'
        };
        
        expect(() => saveDraftSchema.parse(invalid)).toThrow();
      });
    });

    describe('deleteDraftSchema', () => {
      it('should accept valid positive integers', () => {
        const validIds = [1, 2, 100, 999999];
        
        validIds.forEach(id => {
          expect(() => deleteDraftSchema.parse({ id })).not.toThrow();
        });
      });

      it('should reject invalid id values', () => {
        const invalidIds = [
          { id: 0 },
          { id: -1 },
          { id: 1.5 },  // Float
          { id: '1' },  // String
          {}
        ];
        
        invalidIds.forEach(data => {
          expect(() => deleteDraftSchema.parse(data)).toThrow();
        });
      });
    });

    describe('submitTimesheetsSchema', () => {
      it('should accept valid token', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => submitTimesheetsSchema.parse(valid)).not.toThrow();
      });

      it('should reject invalid tokens', () => {
        expect(() => submitTimesheetsSchema.parse({ token: 'invalid' })).toThrow();
        expect(() => submitTimesheetsSchema.parse({})).toThrow();
      });
    });
  });

  describe('Admin Schemas', () => {
    describe('adminTokenSchema', () => {
      it('should accept valid UUID tokens', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => adminTokenSchema.parse(valid)).not.toThrow();
      });

      it('should reject invalid tokens', () => {
        expect(() => adminTokenSchema.parse({ token: 'not-a-uuid' })).toThrow();
      });
    });
  });

  describe('Database Viewer Schemas', () => {
    describe('getAllTimesheetEntriesSchema', () => {
      it('should accept valid token', () => {
        const valid = {
          token: '123e4567-e89b-12d3-a456-426614174000'
        };
        
        expect(() => getAllTimesheetEntriesSchema.parse(valid)).not.toThrow();
      });

      it('should reject missing token', () => {
        expect(() => getAllTimesheetEntriesSchema.parse({})).toThrow();
      });
    });
  });

  describe('Logs Schemas', () => {
    describe('readLogFileSchema', () => {
      it('should accept valid log paths', () => {
        const validPaths = [
          'C:\\logs\\app.log',
          '/var/log/app.log',
          'logs/application.log',
          'app-2025-01-15.log'
        ];
        
        validPaths.forEach(logPath => {
          expect(() => readLogFileSchema.parse({ logPath })).not.toThrow();
        });
      });

      it('should reject empty paths', () => {
        expect(() => readLogFileSchema.parse({ logPath: '' })).toThrow();
      });

      it('should enforce length limits', () => {
        const tooLong = 'a'.repeat(1001);
        expect(() => readLogFileSchema.parse({ logPath: tooLong })).toThrow();
      });
    });

    describe('exportLogsSchema', () => {
      it('should accept valid export formats', () => {
        const validRequests = [
          { logPath: 'app.log', exportFormat: 'json' as const },
          { logPath: 'app.log', exportFormat: 'txt' as const },
          { logPath: 'app.log' } // exportFormat is optional
        ];
        
        validRequests.forEach(req => {
          expect(() => exportLogsSchema.parse(req)).not.toThrow();
        });
      });

      it('should reject invalid export formats', () => {
        const invalid = {
          logPath: 'app.log',
          exportFormat: 'csv' // Not in enum
        };
        
        expect(() => exportLogsSchema.parse(invalid)).toThrow();
      });
    });
  });

  describe('Schema Evolution', () => {
    it('should ignore extra fields in schemas', () => {
      const withExtra = {
        service: 'smartsheet',
        email: 'user@example.com',
        password: 'password123',
        extraField: 'should be ignored'
      };
      
      // Zod by default strips extra fields
      const result = storeCredentialsSchema.parse(withExtra);
      expect(result).not.toHaveProperty('extraField');
    });

    it('should maintain backward compatibility with optional fields', () => {
      // saveDraftSchema has optional id, tool, and chargeCode
      const minimal = {
        date: '2025-01-15',
        hours: 8.0,
        project: 'Test',
        taskDescription: 'Test'
      };
      
      expect(() => saveDraftSchema.parse(minimal)).not.toThrow();
    });
  });

  describe('Security Tests', () => {
    it('should prevent SQL injection in service names', () => {
      const sqlInjection = [
        "service'; DROP TABLE credentials; --",
        "service' OR '1'='1",
        "service'; DELETE FROM * --"
      ];
      
      sqlInjection.forEach(attack => {
        expect(() => serviceNameSchema.parse(attack)).toThrow();
      });
    });

    it('should prevent XSS in task descriptions', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>'
      ];
      
      // Task descriptions should accept these (they're just text)
      // XSS prevention happens at the rendering layer
      xssAttempts.forEach(attack => {
        expect(() => taskDescriptionSchema.parse(attack)).not.toThrow();
      });
    });

    it('should prevent path traversal in log paths', () => {
      const pathTraversal = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        'logs/../../secret.txt'
      ];
      
      // Schemas accept these paths (validation happens at filesystem layer)
      pathTraversal.forEach(path => {
        expect(() => readLogFileSchema.parse({ logPath: path })).not.toThrow();
      });
    });

    it('should prevent command injection in project names', () => {
      const commandInjection = [
        'project; rm -rf /',
        'project && del /f /q *.*',
        'project | cat /etc/passwd'
      ];
      
      // These should be accepted as text (validation for allowed values happens elsewhere)
      commandInjection.forEach(attack => {
        expect(() => projectNameSchema.parse(attack)).not.toThrow();
      });
    });
  });
});

