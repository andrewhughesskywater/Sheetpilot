import { writable } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface TimesheetRow {
  id?: number;
  date: string;
  timeIn: string;
  timeOut: string;
  project: string;
  tool?: string | null;
  chargeCode?: string | null;
  taskDescription: string;
}

interface DataState {
  timesheetDraft: TimesheetRow[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DataState = {
  timesheetDraft: [],
  isLoading: false,
  error: null,
};

function createDataStore() {
  const { subscribe, set, update } = writable<DataState>(initialState);

  return {
    subscribe,
    
    async loadTimesheetDraft() {
      update(state => ({ ...state, isLoading: true, error: null }));
      
      try {
        const response = await invoke<{
          success: boolean;
          entries: TimesheetRow[];
          error?: string;
        }>('load_timesheet_draft');
        
        if (response.success) {
          update(state => ({
            ...state,
            timesheetDraft: response.entries,
            isLoading: false,
          }));
        } else {
          update(state => ({
            ...state,
            error: response.error || 'Failed to load timesheet',
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Load timesheet error:', error);
        update(state => ({
          ...state,
          error: String(error),
          isLoading: false,
        }));
      }
    },
    
    async saveTimesheetRow(row: TimesheetRow) {
      try {
        const response = await invoke<{
          success: boolean;
          changes?: number;
          error?: string;
        }>('save_timesheet_draft', { row });
        
        if (response.success) {
          // Reload the draft to get updated data
          await this.loadTimesheetDraft();
          return { success: true };
        } else {
          return { success: false, error: response.error || 'Failed to save row' };
        }
      } catch (error) {
        console.error('Save row error:', error);
        return { success: false, error: String(error) };
      }
    },
    
    async deleteTimesheetRow(id: number) {
      try {
        const response = await invoke<{
          success: boolean;
          changes?: number;
          error?: string;
        }>('delete_timesheet_draft', { id });
        
        if (response.success) {
          // Remove from local state
          update(state => ({
            ...state,
            timesheetDraft: state.timesheetDraft.filter(row => row.id !== id),
          }));
          return { success: true };
        } else {
          return { success: false, error: response.error || 'Failed to delete row' };
        }
      } catch (error) {
        console.error('Delete row error:', error);
        return { success: false, error: String(error) };
      }
    },
    
    updateLocalRow(index: number, row: TimesheetRow) {
      update(state => {
        const newDraft = [...state.timesheetDraft];
        newDraft[index] = row;
        return { ...state, timesheetDraft: newDraft };
      });
    },
  };
}

export const dataStore = createDataStore();

