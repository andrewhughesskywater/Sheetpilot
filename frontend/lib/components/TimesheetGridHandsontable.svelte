<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Handsontable from 'handsontable';
  import 'handsontable/dist/handsontable.full.min.css';
  import { Button, Alert } from 'flowbite-svelte';
  import { dataStore } from '../stores/data';
  import type { TimesheetRow } from '../stores/data';
  import { invoke } from '@tauri-apps/api/core';

  let containerEl: HTMLDivElement;
  let hot: Handsontable | null = null;
  let timesheetData: TimesheetRow[] = [];
  let isLoading = false;
  let isSubmitting = false;
  let error = '';
  let saveMessage = '';
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let isAutoSaving = false;

  $: {
    timesheetData = $dataStore.timesheetDraft;
    isLoading = $dataStore.isLoading;
    error = $dataStore.error || '';
  }

  onMount(async () => {
    await dataStore.loadTimesheetDraft();
    initializeHandsontable();
    await checkForFailedEntries();
  });

  onDestroy(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    if (hot) {
      hot.destroy();
    }
  });

  // Debounced auto-save function
  function debouncedAutoSave() {
    // Clear existing timer
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    // Set new timer to save after 1.5 seconds of inactivity
    autoSaveTimer = setTimeout(async () => {
      if (isAutoSaving) return; // Prevent concurrent saves
      
      isAutoSaving = true;
      saveMessage = '💾 Auto-saving...';
      await handleSaveAll(true);
      isAutoSaving = false;
    }, 1500);
  }

  function initializeHandsontable() {
    if (!containerEl) return;

    // Convert timesheet data to array format for Handsontable
    const tableData = timesheetData.map((row) => [
      row.date || '',
      row.timeIn || '',
      row.timeOut || '',
      row.project || '',
      row.tool || '',
      row.chargeCode || '',
      row.taskDescription || '',
    ]);

    hot = new Handsontable(containerEl, {
      data: tableData,
      colHeaders: [
        'Date *',
        'Time In *',
        'Time Out *',
        'Project *',
        'Tool',
        'Charge Code',
        'Task Description *',
      ],
      columns: [
        { type: 'text', width: 100 }, // Date
        { type: 'text', width: 80 }, // Time In
        { type: 'text', width: 80 }, // Time Out
        { type: 'text', width: 150 }, // Project
        { type: 'text', width: 100 }, // Tool
        { type: 'text', width: 120 }, // Charge Code
        { type: 'text', width: 200 }, // Task Description
      ],
      rowHeaders: true,
      height: 'auto',
      licenseKey: 'non-commercial-and-evaluation',
      minSpareRows: 1,
      contextMenu: ['row_above', 'row_below', 'remove_row', 'undo', 'redo'],
      stretchH: 'all',
      className: 'htCenter htMiddle',
      afterChange: (changes, source) => {
        // Auto-save on user edits, autofill, and paste operations
        if (source === 'edit' || source === 'Autofill.fill' || source === 'CopyPaste.paste') {
          debouncedAutoSave();
        }
      },
    });
  }

  async function handleSaveAll(isAutoSave = false) {
    if (!hot) return;

    const data = hot.getData();
    if (!isAutoSave) {
      saveMessage = '';
      error = '';
    }
    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row[0] && !row[1] && !row[2] && !row[3] && !row[6]) {
        continue;
      }

      // Check required fields
      if (!row[0] || !row[1] || !row[2] || !row[3] || !row[6]) {
        errorCount++;
        continue; // Skip incomplete rows
      }

      const timesheetRow: TimesheetRow = {
        id: timesheetData[i]?.id,
        date: row[0],
        timeIn: row[1],
        timeOut: row[2],
        project: row[3],
        tool: row[4] || null,
        chargeCode: row[5] || null,
        taskDescription: row[6],
      };

      const result = await dataStore.saveTimesheetRow(timesheetRow);
      if (result.success) {
        savedCount++;
      } else {
        errorCount++;
        console.error(`Failed to save row ${i}:`, result.error);
      }
    }

    if (savedCount > 0) {
      if (isAutoSave) {
        saveMessage = `✓ Auto-saved ${savedCount} row(s)`;
        setTimeout(() => (saveMessage = ''), 2000);
      } else {
        saveMessage = `✓ Saved ${savedCount} row(s) successfully`;
        setTimeout(() => (saveMessage = ''), 3000);
      }
      await dataStore.loadTimesheetDraft();
      // Reinitialize Handsontable with fresh data
      if (hot) {
        hot.destroy();
      }
      initializeHandsontable();
    } else if (isAutoSave) {
      // Don't show message if auto-save had nothing to save
      saveMessage = '';
    }

    if (errorCount > 0 && !isAutoSave) {
      error = `⚠ ${errorCount} row(s) could not be saved. Check that all required fields (*) are filled.`;
    }
  }

  async function handleRefresh() {
    await dataStore.loadTimesheetDraft();
    if (hot) {
      hot.destroy();
    }
    initializeHandsontable();
  }

  async function handleDeleteSelected() {
    if (!hot) return;

    const selected = hot.getSelected();
    if (!selected || selected.length === 0) {
      alert('Please select rows to delete');
      return;
    }

    const rowsToDelete: number[] = [];
    for (const range of selected) {
      const [startRow, , endRow] = range;
      for (let i = startRow; i <= endRow; i++) {
        const row = timesheetData[i];
        if (row && row.id) {
          rowsToDelete.push(row.id);
        }
      }
    }

    if (rowsToDelete.length === 0) {
      alert('Selected rows have not been saved yet');
      return;
    }

    if (!confirm(`Delete ${rowsToDelete.length} row(s)?`)) {
      return;
    }

    let deletedCount = 0;
    for (const id of rowsToDelete) {
      const result = await dataStore.deleteTimesheetRow(id);
      if (result.success) {
        deletedCount++;
      }
    }

    saveMessage = `✓ Deleted ${deletedCount} row(s)`;
    setTimeout(() => (saveMessage = ''), 3000);
    await handleRefresh();
  }

  async function handleSubmit() {
    if (isSubmitting) {
      alert('Submission already in progress. Please wait.');
      return;
    }

    // If auto-save is pending, complete it immediately before submission
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
      saveMessage = '💾 Saving pending changes...';
      await handleSaveAll(true);
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!confirm('Submit timesheet to portal? This will launch browser automation.')) {
      return;
    }

    isSubmitting = true;
    error = '';
    saveMessage = 'Submitting to portal...';

    try {
      // Retrieve stored credentials
      const credentials = await invoke('credentials_get', { service: 'timesheet_portal' });

      if (!credentials || !credentials.success) {
        error = 'No credentials found. Please store credentials in Settings first.';
        isSubmitting = false;
        saveMessage = '';
        return;
      }

      // Call submission command (database is source of truth, no entries passed)
      const result = await invoke('timesheet_submit', {
        token: '', // TODO: Get from session store if needed
        service: 'timesheet_portal',
        baseUrl: 'https://your-portal-url.com', // TODO: Get from config/settings
        formId: 'timesheet_form', // TODO: Get from config/settings
      });

      if (result.error) {
        error = `Submission error: ${result.error}`;
      } else if (result.submit_result) {
        const sr = result.submit_result;
        saveMessage = `✓ Successfully submitted ${sr.success_count} entries!`;
        setTimeout(() => (saveMessage = ''), 5000);
      } else {
        error = 'Submission completed with unknown status';
      }
    } catch (e) {
      error = `Submission failed: ${e}`;
    } finally {
      isSubmitting = false;
      // Always refresh from database after submission attempt
      await handleRefresh();
    }
  }

  async function checkForFailedEntries() {
    try {
      const failed = await invoke('get_failed_entries');

      if (failed && failed.length > 0) {
        const message = `Found ${failed.length} failed entries from previous submission.\n\nWould you like to retry submission?`;
        
        if (confirm(message)) {
          // Retry submission
          await handleSubmit();
        } else if (confirm('Mark them as drafts to edit?')) {
          // Reset to draft
          await invoke('reset_failed_to_draft');
          saveMessage = '✓ Failed entries reset to draft';
          setTimeout(() => (saveMessage = ''), 3000);
          await handleRefresh();
        }
      }
    } catch (e) {
      console.error('Failed to check for failed entries:', e);
    }
  }
</script>

<div class="timesheet-container p-4">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Timesheet</h2>
    <div class="flex gap-2">
      <Button on:click={handleSaveAll} size="sm" color="blue">Save All</Button>
      <Button on:click={handleRefresh} size="sm" color="alternative">Refresh</Button>
      <Button on:click={handleDeleteSelected} size="sm" color="red">Delete Selected</Button>
      <Button on:click={handleSubmit} size="sm" color="green" disabled={timesheetData.length === 0 || isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit to Portal'}
      </Button>
    </div>
  </div>

  {#if saveMessage}
    <Alert color="green" class="mb-4">
      {saveMessage}
    </Alert>
  {/if}

  {#if error}
    <Alert color="red" class="mb-4">
      {error}
    </Alert>
  {/if}

  {#if isLoading}
    <div class="text-center py-8">
      <p class="text-gray-500">Loading timesheet data...</p>
    </div>
  {:else}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div bind:this={containerEl}></div>

      <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p><strong>Instructions:</strong></p>
        <ul class="list-disc ml-5 mt-2">
          <li>Fields marked with * are required</li>
          <li>Right-click for context menu (add/remove rows)</li>
          <li>Changes auto-save 1.5 seconds after you stop editing</li>
          <li>Select rows and click "Delete Selected" to remove them</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .timesheet-container {
    max-width: 100%;
  }

  :global(.handsontable) {
    font-size: 13px;
  }

  :global(.handsontable th) {
    background-color: #f3f4f6;
    font-weight: 600;
  }

  :global(.dark .handsontable th) {
    background-color: #374151;
    color: #f9fafb;
  }
</style>
