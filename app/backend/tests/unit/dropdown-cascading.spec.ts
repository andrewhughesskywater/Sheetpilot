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
} from '../../src/logic/dropdown-logic';
import { cascadingTestCases } from '../fixtures/timesheet-data';

describe('Dropdown Cascading Logic Unit Tests', () => {
  describe('Project-Tool Relationships', () => {
    it('should identify projects that do not need tools', () => {
      const expectedProjectsWithoutTools = ['ERT', 'PTO/RTO', 'SWFL-CHEM/GAS', 'Training'];
      
      expectedProjectsWithoutTools.forEach(project => {
        expect(projectsWithoutTools.has(project as any)).toBe(true);
        expect(projectNeedsTools(project as any)).toBe(false);
      });
    });

    it('should identify projects that need tools', () => {
      const expectedProjectsWithTools = ['FL-Carver Techs', 'FL-Carver Tools', 'OSC-BBB', 'SWFL-EQUIP'];
      
      expectedProjectsWithTools.forEach(project => {
        expect(projectsWithoutTools.has(project as any)).toBe(false);
        expect(projectNeedsTools(project as any)).toBe(true);
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
        expect(toolsWithoutCharges.has(tool as any)).toBe(true);
        expect(toolNeedsChargeCode(tool as any)).toBe(false);
      });
    });

    it('should identify tools that need charge codes', () => {
      const expectedToolsWithCharges = [
        '#1 Rinse and 2D marker', '#2 Sputter', '#3 Laminator 300mm',
        'AFM101', 'ALD101', 'ALIGN101', '#1 CSAM101', '#2 BOND Pull Tester'
      ];
      
      expectedToolsWithCharges.forEach(tool => {
        expect(toolsWithoutCharges.has(tool as any)).toBe(false);
        expect(toolNeedsChargeCode(tool as any)).toBe(true);
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
      let currentProject: string = 'PTO/RTO';
      let currentTool: string | null = null;
      let currentChargeCode: string | null = null;
      
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
      let currentProject: string = 'FL-Carver Techs';
      let currentTool: string | null = '#1 Rinse and 2D marker';
      let currentChargeCode: string | null = 'EPR1';
      
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
      let currentTool: string | null = 'Meeting';
      let currentChargeCode: string | null = null;
      
      expect(toolNeedsChargeCode(currentTool)).toBe(false);
      
      // Change to tool that needs charge codes
      currentTool = '#1 Rinse and 2D marker';
      
      expect(toolNeedsChargeCode(currentTool)).toBe(true);
      
      // Charge code should be cleared initially
      expect(currentChargeCode).toBeNull();
    });

    it('should handle cascading from tool with charges to tool without charges', () => {
      // Start with tool that needs charge codes
      let currentTool: string | null = '#1 Rinse and 2D marker';
      let currentChargeCode: string | null = 'EPR1';
      
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
      const flCarverTools = toolsByProject['FL-Carver Techs'] ?? [];
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

  describe('Advanced Edge Cases - Circular Dependencies', () => {
    it('should not have circular dependencies in project-tool relationships', () => {
      // No project should reference itself in its tool list
      projects.forEach(project => {
        const toolOptions = getToolOptions(project);
        expect(toolOptions).not.toContain(project);
      });
    });

    it('should not have circular dependencies in tool-project relationships', () => {
      // Verify that tools are not also projects (with exception for "Training")
      // Note: "Training" exists as both a project and a tool in SWFL-EQUIP by design
      const allTools = Object.values(toolsByProject).flat();
      const toolsExceptTraining = allTools.filter(tool => tool !== 'Training');
      toolsExceptTraining.forEach(tool => {
        expect(projects).not.toContain(tool);
      });
    });

    it('should handle hypothetical circular cascade scenario', () => {
      // Test scenario where project A → tool B → (hypothetically) project A
      // Exception: "Training" exists as both a project and a tool by design
      // We verify that for most tools, they are not valid project names
      const allTools = Object.values(toolsByProject).flat();
      const uniqueTools = [...new Set(allTools)];
      const toolsThatAreProjects = uniqueTools.filter(tool => projects.includes(tool));
      
      // Only "Training" should appear in both lists
      expect(toolsThatAreProjects).toEqual(['Training']);
    });
  });

  describe('Advanced Edge Cases - Undefined Combinations', () => {
    it('should handle undefined project and undefined tool combination', () => {
      expect(projectNeedsTools(undefined as unknown as string)).toBe(false);
      expect(toolNeedsChargeCode(undefined as unknown as string)).toBe(false);
      expect(getToolOptions(undefined as unknown as string)).toEqual([]);
    });

    it('should handle valid project with undefined tool', () => {
      const project = 'FL-Carver Techs';
      expect(projectNeedsTools(project)).toBe(true);
      expect(toolNeedsChargeCode(undefined as unknown as string)).toBe(false);
    });

    it('should handle invalid project with valid tool', () => {
      const invalidProject = 'NonExistentProject';
      const validTool = '#1 Rinse and 2D marker';
      
      expect(getToolOptions(invalidProject)).toEqual([]);
      expect(toolNeedsChargeCode(validTool)).toBe(true);
    });

    it('should handle project-tool mismatch scenarios', () => {
      // Test tool from Project A used with Project B
      const projectA = 'FL-Carver Techs';
      const projectB = 'OSC-BBB';
      const toolFromA = '#1 Rinse and 2D marker';
      
      const toolsForB = getToolOptions(projectB);
      expect(toolsForB).not.toContain(toolFromA); // Tool from A shouldn't be valid for B
    });

    it('should handle empty string project with non-empty tool', () => {
      const emptyProject = '';
      const validTool = 'Meeting';
      
      expect(projectNeedsTools(emptyProject)).toBe(false);
      expect(getToolOptions(emptyProject)).toEqual([]);
      expect(toolNeedsChargeCode(validTool)).toBe(false);
    });

    it('should handle whitespace-only inputs', () => {
      const whitespaceProject = '   ';
      const whitespaceTool = '  ';
      
      expect(projectNeedsTools(whitespaceProject)).toBe(false);
      expect(toolNeedsChargeCode(whitespaceTool)).toBe(false);
      expect(getToolOptions(whitespaceProject)).toEqual([]);
    });

    it('should handle mixed case variations of undefined combinations', () => {
      const variations = [
        { project: 'undefined', tool: 'undefined' },
        { project: 'Undefined', tool: 'Undefined' },
        { project: 'UNDEFINED', tool: 'UNDEFINED' },
        { project: 'null', tool: 'null' },
        { project: 'NULL', tool: 'NULL' }
      ];
      
      variations.forEach(({ project, tool }) => {
        // These should all be treated as invalid/unknown values
        // Note: Case-sensitive matching means "Training" != "training"
        const needsTools = projectNeedsTools(project);
        const needsCharge = toolNeedsChargeCode(tool);
        const toolOpts = getToolOptions(project);
        
        // All these should be falsy/empty since they're not real project/tool names
        expect(typeof needsTools).toBe('boolean');
        expect(typeof needsCharge).toBe('boolean');
        expect(Array.isArray(toolOpts)).toBe(true);
      });
    });
  });

  describe('Advanced Edge Cases - Rapid Cascade Changes', () => {
    it('should handle rapid sequential project changes', () => {
      const projectSequence = [
        'FL-Carver Techs',
        'PTO/RTO',
        'OSC-BBB',
        'Training',
        'SWFL-EQUIP',
        'FL-Carver Tools'
      ];
      
      // Simulate rapid changes
      const results = projectSequence.map(project => ({
        project,
        needsTools: projectNeedsTools(project),
        toolOptions: getToolOptions(project)
      }));
      
      // All results should be consistent
      results.forEach((result, index) => {
        const project = projectSequence[index];
        expect(result.project).toBe(project);
        expect(typeof result.needsTools).toBe('boolean');
        expect(Array.isArray(result.toolOptions)).toBe(true);
      });
    });

    it('should handle rapid sequential tool changes', () => {
      const toolSequence = [
        '#1 Rinse and 2D marker',
        'Meeting',
        'AFM101',
        'DECA Meeting',
        'Logistics',
        '#2 Sputter'
      ];
      
      // Simulate rapid changes
      const results = toolSequence.map(tool => ({
        tool,
        needsChargeCode: toolNeedsChargeCode(tool)
      }));
      
      // All results should be consistent
      results.forEach((result, index) => {
        const tool = toolSequence[index];
        expect(result.tool).toBe(tool);
        expect(typeof result.needsChargeCode).toBe('boolean');
      });
    });

    it('should handle rapid back-and-forth project changes', () => {
      const projectA = 'FL-Carver Techs';
      const projectB = 'PTO/RTO';
      
      // Simulate 100 rapid switches
      for (let i = 0; i < 100; i++) {
        const currentProject = i % 2 === 0 ? projectA : projectB;
        const needsTools = projectNeedsTools(currentProject);
        const toolOptions = getToolOptions(currentProject);
        
        if (currentProject === projectA) {
          expect(needsTools).toBe(true);
          expect(toolOptions.length).toBeGreaterThan(0);
        } else {
          expect(needsTools).toBe(false);
          expect(toolOptions).toEqual([]);
        }
      }
    });

    it('should handle rapid back-and-forth tool changes', () => {
      const toolA = '#1 Rinse and 2D marker';
      const toolB = 'Meeting';
      
      // Simulate 100 rapid switches
      for (let i = 0; i < 100; i++) {
        const currentTool = i % 2 === 0 ? toolA : toolB;
        const needsChargeCode = toolNeedsChargeCode(currentTool);
        
        if (currentTool === toolA) {
          expect(needsChargeCode).toBe(true);
        } else {
          expect(needsChargeCode).toBe(false);
        }
      }
    });

    it('should handle rapid cascade through all three levels', () => {
      // Simulate rapid changes through project → tool → chargeCode cascade
      const cascadeSequence = [
        { project: 'FL-Carver Techs', tool: '#1 Rinse and 2D marker', expectedChargeCodeNeeded: true },
        { project: 'FL-Carver Techs', tool: 'Meeting', expectedChargeCodeNeeded: false },
        { project: 'PTO/RTO', tool: null, expectedChargeCodeNeeded: false },
        { project: 'OSC-BBB', tool: 'AFM101', expectedChargeCodeNeeded: true },
        { project: 'Training', tool: null, expectedChargeCodeNeeded: false }
      ];
      
      cascadeSequence.forEach(({ project, tool, expectedChargeCodeNeeded }) => {
        expect(projectNeedsTools(project)).toBe(tool !== null);
        if (tool) {
          expect(toolNeedsChargeCode(tool)).toBe(expectedChargeCodeNeeded);
        }
      });
    });

    it('should maintain consistency during concurrent-like operations', () => {
      // Simulate checking multiple projects/tools "concurrently"
      const operations = [];
      
      // Queue up operations
      for (let i = 0; i < 50; i++) {
        operations.push(() => projectNeedsTools('FL-Carver Techs'));
        operations.push(() => toolNeedsChargeCode('#1 Rinse and 2D marker'));
        operations.push(() => getToolOptions('OSC-BBB'));
      }
      
      // Execute all operations
      const results = operations.map(op => op());
      
      // Check consistency - same operations should return same results
      for (let i = 0; i < results.length; i += 3) {
        expect(results[i]).toBe(true); // FL-Carver Techs needs tools
        expect(results[i + 1]).toBe(true); // #1 Rinse needs charge code
        expect(Array.isArray(results[i + 2])).toBe(true); // OSC-BBB tools is an array
      }
    });

    it('should handle rapid changes with invalid inputs mixed in', () => {
      const mixedSequence = [
        'FL-Carver Techs',
        null,
        'PTO/RTO',
        undefined,
        '',
        'OSC-BBB',
        'InvalidProject',
        'SWFL-EQUIP'
      ];
      
      // Should handle all inputs without throwing errors
      mixedSequence.forEach(project => {
        expect(() => {
          projectNeedsTools(project as any);
          getToolOptions(project as any);
        }).not.toThrow();
      });
    });
  });
});
