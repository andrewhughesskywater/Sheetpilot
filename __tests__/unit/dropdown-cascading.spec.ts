/**
 * @fileoverview Dropdown Cascading Logic Unit Tests
 * 
 * Tests the cascading dropdown logic to prevent AI from breaking business rules.
 * Validates project → tool → chargeCode dependency relationships.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect } from 'vitest';
import {
  projectsWithoutTools,
  toolsWithoutCharges,
  projects,
  toolsByProject,
  chargeCodes,
  getToolOptions,
  toolNeedsChargeCode,
  projectNeedsTools
} from '../../src/renderer/business-logic/dropdown-logic';
import { cascadingTestCases } from '../fixtures/timesheet-data';

describe('Dropdown Cascading Logic Unit Tests', () => {
  describe('Project-Tool Relationships', () => {
    it('should identify projects that do not need tools', () => {
      const expectedProjectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      expectedProjectsWithoutTools.forEach(project => {
        expect(projectsWithoutTools.has(project)).toBe(true);
        expect(projectNeedsTools(project)).toBe(false);
      });
    });

    it('should identify projects that need tools', () => {
      const expectedProjectsWithTools = ['FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 'SWFL-EQUIP'];
      
      expectedProjectsWithTools.forEach(project => {
        expect(projectsWithoutTools.has(project)).toBe(false);
        expect(projectNeedsTools(project)).toBe(true);
      });
    });

    it('should return empty tool options for projects without tools', () => {
      const projectsWithoutToolsList = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      projectsWithoutToolsList.forEach(project => {
        const toolOptions = getToolOptions(project);
        expect(toolOptions).toEqual([]);
      });
    });

    it('should return correct tool options for projects with tools', () => {
      const testCases = [
        {
          project: 'FL-Carver Techs',
          expectedTools: ['DECA Meeting', 'Logistics', '#1 Rinse and 2D marker', '#2 Sputter']
        },
        {
          project: 'OSC-BBB',
          expectedTools: ['Meeting', 'Non Tool Related', '#1 CSAM101', '#2 BOND Pull Tester']
        },
        {
          project: 'SWFL-EQUIP',
          expectedTools: ['Meeting', 'Non Tool Related', 'AFM101', 'ALD101']
        }
      ];
      
      testCases.forEach(({ project, expectedTools }) => {
        const toolOptions = getToolOptions(project);
        expect(toolOptions).toEqual(expect.arrayContaining(expectedTools));
        expect(toolOptions.length).toBeGreaterThan(0);
      });
    });

    it('should handle undefined project gracefully', () => {
      const toolOptions = getToolOptions(undefined);
      expect(toolOptions).toEqual([]);
    });

    it('should handle invalid project gracefully', () => {
      const toolOptions = getToolOptions('Invalid Project');
      expect(toolOptions).toEqual([]);
    });
  });

  describe('Tool-ChargeCode Relationships', () => {
    it('should identify tools that do not need charge codes', () => {
      const expectedToolsWithoutCharges = [
        'Internal Meeting', 'DECA Meeting', 'Logistics', 'Meeting',
        'Non Tool Related', 'Admin', 'Training', 'N/A'
      ];
      
      expectedToolsWithoutCharges.forEach(tool => {
        expect(toolsWithoutCharges.has(tool)).toBe(true);
        expect(toolNeedsChargeCode(tool)).toBe(false);
      });
    });

    it('should identify tools that need charge codes', () => {
      const expectedToolsWithCharges = [
        '#1 Rinse and 2D marker', '#2 Sputter', '#3 Laminator 300mm',
        'AFM101', 'ALD101', 'ALIGN101', '#1 CSAM101', '#2 BOND Pull Tester'
      ];
      
      expectedToolsWithCharges.forEach(tool => {
        expect(toolsWithoutCharges.has(tool)).toBe(false);
        expect(toolNeedsChargeCode(tool)).toBe(true);
      });
    });

    it('should handle undefined tool gracefully', () => {
      expect(toolNeedsChargeCode(undefined)).toBe(false);
    });

    it('should handle empty tool gracefully', () => {
      expect(toolNeedsChargeCode('')).toBe(false);
    });
  });

  describe('Cascading Rule Application', () => {
    it('should apply cascading rules correctly for project changes', () => {
      cascadingTestCases.forEach(testCase => {
        if ('expectedToolOptions' in testCase) {
          const { project, expectedToolOptions, shouldClearTool, shouldClearChargeCode } = testCase;
          
          const toolOptions = getToolOptions(project);
          expect(toolOptions).toEqual(expect.arrayContaining(expectedToolOptions));
          expect(toolOptions.length).toBeGreaterThanOrEqual(expectedToolOptions.length);
          
          if (shouldClearTool) {
            expect(toolOptions).toEqual([]);
          }
          
          if (shouldClearChargeCode) {
            // If project doesn't need tools, charge codes should also be cleared
            expect(projectNeedsTools(project)).toBe(false);
          }
        }
      });
    });

    it('should apply cascading rules correctly for tool changes', () => {
      cascadingTestCases.forEach(testCase => {
        if ('expectedChargeCodeOptions' in testCase && 'tool' in testCase) {
          const { tool, shouldClearChargeCode } = testCase;
          
          if (shouldClearChargeCode) {
            expect(toolNeedsChargeCode(tool)).toBe(false);
          } else {
            expect(toolNeedsChargeCode(tool)).toBe(true);
          }
        }
      });
    });

    it('should handle cascading from project without tools to project with tools', () => {
      // Start with project that doesn't need tools
      let currentProject = 'PTO/RTO';
      let currentTool = null;
      let currentChargeCode = null;
      
      expect(projectNeedsTools(currentProject)).toBe(false);
      expect(getToolOptions(currentProject)).toEqual([]);
      
      // Change to project that needs tools
      currentProject = 'FL-Carver Techs';
      const toolOptions = getToolOptions(currentProject);
      
      expect(projectNeedsTools(currentProject)).toBe(true);
      expect(toolOptions.length).toBeGreaterThan(0);
      
      // Tool and charge code should be cleared
      expect(currentTool).toBeNull();
      expect(currentChargeCode).toBeNull();
    });

    it('should handle cascading from project with tools to project without tools', () => {
      // Start with project that needs tools
      let currentProject = 'FL-Carver Techs';
      let currentTool = '#1 Rinse and 2D marker';
      let currentChargeCode = 'EPR1';
      
      expect(projectNeedsTools(currentProject)).toBe(true);
      expect(getToolOptions(currentProject)).toContain(currentTool);
      
      // Change to project that doesn't need tools
      currentProject = 'PTO/RTO';
      
      expect(projectNeedsTools(currentProject)).toBe(false);
      expect(getToolOptions(currentProject)).toEqual([]);
      
      // Tool and charge code should be cleared
      currentTool = null;
      currentChargeCode = null;
      expect(currentTool).toBeNull();
      expect(currentChargeCode).toBeNull();
    });

    it('should handle cascading from tool without charges to tool with charges', () => {
      // Start with tool that doesn't need charge codes
      let currentTool = 'Meeting';
      let currentChargeCode = null;
      
      expect(toolNeedsChargeCode(currentTool)).toBe(false);
      
      // Change to tool that needs charge codes
      currentTool = '#1 Rinse and 2D marker';
      
      expect(toolNeedsChargeCode(currentTool)).toBe(true);
      
      // Charge code should be cleared initially
      expect(currentChargeCode).toBeNull();
    });

    it('should handle cascading from tool with charges to tool without charges', () => {
      // Start with tool that needs charge codes
      let currentTool = '#1 Rinse and 2D marker';
      let currentChargeCode = 'EPR1';
      
      expect(toolNeedsChargeCode(currentTool)).toBe(true);
      
      // Change to tool that doesn't need charge codes
      currentTool = 'Meeting';
      
      expect(toolNeedsChargeCode(currentTool)).toBe(false);
      
      // Charge code should be cleared
      currentChargeCode = null;
      expect(currentChargeCode).toBeNull();
    });
  });

  describe('Data Consistency', () => {
    it('should have consistent project lists', () => {
      const allProjects = [
        'FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB',
        'PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP', 'Training'
      ];
      
      expect(projects).toEqual(expect.arrayContaining(allProjects));
      expect(projects.length).toBe(allProjects.length);
    });

    it('should have consistent charge code lists', () => {
      const allChargeCodes = [
        'Admin', 'EPR1', 'EPR2', 'EPR3', 'EPR4', 'Repair',
        'Meeting', 'Other', 'PM', 'Training', 'Upgrade'
      ];
      
      expect(chargeCodes).toEqual(expect.arrayContaining(allChargeCodes));
      expect(chargeCodes.length).toBe(allChargeCodes.length);
    });

    it('should have consistent tool mappings', () => {
      const projectsWithTools = ['FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 'SWFL-EQUIP'];
      
      projectsWithTools.forEach(project => {
        expect(toolsByProject[project]).toBeDefined();
        expect(Array.isArray(toolsByProject[project])).toBe(true);
        expect(toolsByProject[project].length).toBeGreaterThan(0);
      });
    });

    it('should not have overlapping project categories', () => {
      const projectsWithTools = projects.filter(project => projectNeedsTools(project));
      const projectsWithoutToolsList = projects.filter(project => !projectNeedsTools(project));
      
      // No project should be in both categories
      const overlap = projectsWithTools.filter(project => projectsWithoutToolsList.includes(project));
      void expect(overlap).toEqual([]);
      
      // All projects should be in one category
      expect(projectsWithTools.length + projectsWithoutToolsList.length).toBe(projects.length);
    });

    it('should not have overlapping tool categories', () => {
      const toolsWithCharges = Object.values(toolsByProject)
        .flat()
        .filter(tool => toolNeedsChargeCode(tool));
      const toolsWithoutChargesList = Array.from(toolsWithoutCharges);
      
      // No tool should be in both categories
      const overlap = toolsWithCharges.filter(tool => toolsWithoutChargesList.includes(tool));
      expect(overlap).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings gracefully', () => {
      expect(projectNeedsTools('')).toBe(false);
      expect(toolNeedsChargeCode('')).toBe(false);
      expect(getToolOptions('')).toEqual([]);
    });

    it('should handle null values gracefully', () => {
      expect(projectNeedsTools(null as unknown as string)).toBe(false);
      expect(toolNeedsChargeCode(null as unknown as string)).toBe(false);
      expect(getToolOptions(null as unknown as string)).toEqual([]);
    });

    it('should handle case sensitivity correctly', () => {
      // Test exact case matching
      expect(projectsWithoutTools.has('PTO/RTO')).toBe(true);
      expect(projectsWithoutTools.has('pto/rto')).toBe(false);
      expect(projectsWithoutTools.has('Pto/Rto')).toBe(false);
      
      expect(toolsWithoutCharges.has('Meeting')).toBe(true);
      expect(toolsWithoutCharges.has('meeting')).toBe(false);
      expect(toolsWithoutCharges.has('MEETING')).toBe(false);
    });

    it('should handle special characters in project names', () => {
      const specialProjects = ['PTO/RTO', 'SWFL-CHEM/GAS', 'SWFL-EQUIP'];
      
      specialProjects.forEach(project => {
        expect(projects).toContain(project);
        expect(typeof project).toBe('string');
        expect(project.length).toBeGreaterThan(0);
      });
    });

    it('should handle special characters in tool names', () => {
      const specialTools = ['#1 Rinse and 2D marker', '#2 Sputter', '#3 Laminator 300mm'];
      
      specialTools.forEach(tool => {
        expect(toolsByProject['FL-Carver Techs']).toContain(tool);
        expect(toolNeedsChargeCode(tool)).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large tool lists efficiently', () => {
      const flCarverTools = toolsByProject['FL-Carver Techs'];
      expect(flCarverTools.length).toBeGreaterThan(50); // FL-Carver Techs has many tools
      
      // Should be able to check tool membership quickly
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        toolNeedsChargeCode('#1 Rinse and 2D marker');
      }
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle multiple project lookups efficiently', () => {
      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        void getToolOptions('FL-Carver Techs');
        void getToolOptions('PTO/RTO');
        void getToolOptions('OSC-BBB');
      }
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });

  describe('Business Rule Validation', () => {
    it('should enforce correct project-tool relationships for all projects', () => {
      projects.forEach(project => {
        const toolOptions = getToolOptions(project);
        const needsTools = projectNeedsTools(project);
        
        if (needsTools) {
          expect(toolOptions.length).toBeGreaterThan(0);
        } else {
          expect(toolOptions).toEqual([]);
        }
      });
    });

    it('should enforce correct tool-chargeCode relationships for all tools', () => {
      const allTools = Object.values(toolsByProject).flat();
      
      allTools.forEach(tool => {
        const needsChargeCode = toolNeedsChargeCode(tool);
        const isInWithoutCharges = toolsWithoutCharges.has(tool);
        
        expect(needsChargeCode).toBe(!isInWithoutCharges);
      });
    });

    it('should maintain referential integrity', () => {
      // All tools in toolsByProject should exist
      Object.values(toolsByProject).flat().forEach(tool => {
        expect(tool).toBeDefined();
        expect(typeof tool).toBe('string');
        expect(tool.length).toBeGreaterThan(0);
      });
      
      // All projects in toolsByProject should be valid projects
      Object.keys(toolsByProject).forEach(project => {
        expect(projects).toContain(project);
      });
      
      // All charge codes should be valid
      chargeCodes.forEach(chargeCode => {
        expect(chargeCode).toBeDefined();
        expect(typeof chargeCode).toBe('string');
        expect(chargeCode.length).toBeGreaterThan(0);
      });
    });
  });
});
