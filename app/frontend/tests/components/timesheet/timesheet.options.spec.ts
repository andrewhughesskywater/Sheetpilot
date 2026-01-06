/**
 * @fileoverview Timesheet Options Module Tests
 * 
 * Tests for dropdown options, project-tool relationships, and business rules.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import {
  PROJECTS as projects,
  CHARGE_CODES as chargeCodes,
  PROJECTS_WITHOUT_TOOLS,
  TOOLS_WITHOUT_CHARGES,
  getToolsForProject as getToolOptions,
  doesProjectNeedTools as projectNeedsTools,
  doesToolNeedChargeCode as toolNeedsChargeCode
} from '@sheetpilot/shared/business-config';

// Convert arrays to Sets for backward compatibility with tests
const projectsWithoutTools: Set<string> = new Set(PROJECTS_WITHOUT_TOOLS);
const toolsWithoutCharges: Set<string> = new Set(TOOLS_WITHOUT_CHARGES);

describe('Timesheet Options Module', () => {
  describe('Project Options', () => {
    it('should have all required projects', () => {
      const requiredProjects = [
        'FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB',
        'PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP', 'Training'
      ];
      
      requiredProjects.forEach(project => {
        expect(projects).toContain(project);
      });
    });

    it('should have correct number of projects', () => {
      expect(projects.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Charge Code Options', () => {
    it('should have all required charge codes', () => {
      const requiredCodes = [
        'Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair',
        'Meeting', 'Other', 'PM', 'Training', 'Upgrade'
      ];
      
      requiredCodes.forEach(code => {
        expect(chargeCodes).toContain(code);
      });
    });

    it('should have correct number of charge codes', () => {
      expect(chargeCodes.length).toBeGreaterThanOrEqual(11);
    });
  });

  describe('Project-Tool Relationships', () => {
    it('should identify projects without tools', () => {
      const expected = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      expected.forEach(project => {
        expect(projectsWithoutTools.has(project)).toBe(true);
        expect(projectNeedsTools(project)).toBe(false);
      });
    });

    it('should identify projects with tools', () => {
      const expected = ['FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 'SWFL-EQUIP'];
      
      expected.forEach(project => {
        expect(projectsWithoutTools.has(project)).toBe(false);
        expect(projectNeedsTools(project)).toBe(true);
      });
    });

    it('should return empty array for projects without tools', () => {
      const tools = getToolOptions('PTO/RTO');
      expect(tools).toEqual([]);
    });

    it('should return tools for projects that need them', () => {
      const tools = getToolOptions('FL-Carver Techs');
      expect(tools.length).toBeGreaterThan(0);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should handle undefined project', () => {
      expect(projectNeedsTools(undefined as any)).toBe(false);
      expect(getToolOptions(undefined as any)).toEqual([]);
    });

    it('should handle invalid project', () => {
      // Invalid projects are assumed to need tools (returns true) but have no tool options
      expect(projectNeedsTools('InvalidProject')).toBe(true);
      expect(getToolOptions('InvalidProject')).toEqual([]);
    });
  });

  describe('Tool-ChargeCode Relationships', () => {
    it('should identify tools without charge codes', () => {
      const expected = [
        'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting',
        'Non Tool Related', 'Admin', 'Training', 'N/A'
      ];
      
      expected.forEach(tool => {
        expect(toolsWithoutCharges.has(tool)).toBe(true);
        expect(toolNeedsChargeCode(tool)).toBe(false);
      });
    });

    it('should identify tools with charge codes', () => {
      const expected = [
        '#1 Rinse and 2D marker', '#2 Sputter', 'AFM101', 'ALD101'
      ];
      
      expected.forEach(tool => {
        expect(toolsWithoutCharges.has(tool)).toBe(false);
        expect(toolNeedsChargeCode(tool)).toBe(true);
      });
    });

    it('should handle undefined tool', () => {
      expect(toolNeedsChargeCode(undefined as any)).toBe(false);
    });

    it('should handle empty tool', () => {
      expect(toolNeedsChargeCode('')).toBe(false);
    });

    it('should handle null tool', () => {
      expect(toolNeedsChargeCode(null as unknown as string)).toBe(false);
    });
  });

  describe('Option Filtering', () => {
    it('should return different tools for different projects', () => {
      const toolsA = getToolOptions('FL-Carver Techs');
      const toolsB = getToolOptions('OSC-BBB');
      
      // Different projects should have different tool sets
      expect(toolsA).not.toEqual(toolsB);
    });

    it('should maintain consistent tool options for same project', () => {
      const tools1 = getToolOptions('FL-Carver Techs');
      const tools2 = getToolOptions('FL-Carver Techs');
      
      expect(tools1).toEqual(tools2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle whitespace in project names', () => {
      // Whitespace doesn't match exact project name, so it's treated as unknown project needing tools
      expect(projectNeedsTools('  FL-Carver Techs  ')).toBe(true);
    });

    it('should handle case sensitivity', () => {
      // Lowercase doesn't match PTO/RTO exactly, so it's treated as unknown project needing tools
      expect(projectNeedsTools('pto/rto')).toBe(true);
      // PTO/RTO is in PROJECTS_WITHOUT_TOOLS, so it does NOT need tools
      expect(projectNeedsTools('PTO/RTO')).toBe(false);
    });

    it('should handle special characters in project names', () => {
      expect(projects.some(p => p.includes('/'))).toBe(true);
      expect(projects.some(p => p.includes('-'))).toBe(true);
    });

    it('should handle special characters in tool names', () => {
      const tools = getToolOptions('FL-Carver Techs');
      const hasSpecialChars = tools.some(t => t.includes('#') || t.includes('/'));
      expect(hasSpecialChars).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should have unique project names', () => {
      const uniqueProjects = new Set(projects);
      expect(uniqueProjects.size).toBe(projects.length);
    });

    it('should have unique charge codes', () => {
      const uniqueCodes = new Set(chargeCodes);
      expect(uniqueCodes.size).toBe(chargeCodes.length);
    });

    it('should have all projects categorized correctly', () => {
      projects.forEach(project => {
        const needsTools = projectNeedsTools(project);
        const isInWithoutTools = projectsWithoutTools.has(project);
        
        expect(needsTools).toBe(!isInWithoutTools);
      });
    });
  });
});

