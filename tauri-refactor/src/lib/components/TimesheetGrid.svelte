<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Input, Alert } from 'flowbite-svelte';
  import { dataStore } from '../stores/data';
  import type { TimesheetRow } from '../stores/data';
  
  let timesheetData: TimesheetRow[] = [];
  let isLoading = false;
  let error = '';
  
  $: {
    timesheetData = $dataStore.timesheetDraft;
    isLoading = $dataStore.isLoading;
    error = $dataStore.error || '';
  }
  
  onMount(async () => {
    await dataStore.loadTimesheetDraft();
  });
  
  function addRow() {
    timesheetData = [...timesheetData, {
      date: '',
      timeIn: '',
      timeOut: '',
      project: '',
      tool: null,
      chargeCode: null,
      taskDescription: '',
    }];
  }
  
  async function saveRow(index: number) {
    const row = timesheetData[index];
    if (!row) return;
    
    // Don't save if row is incomplete
    if (!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription) {
      return; // Skip validation for incomplete rows
    }
    
    const result = await dataStore.saveTimesheetRow(row);
    if (result.success) {
      // Show success briefly
      console.log('Row saved successfully');
    } else {
      alert(`Failed to save: ${result.error}`);
    }
  }
  
  async function deleteRow(index: number) {
    const row = timesheetData[index];
    if (row.id) {
      const result = await dataStore.deleteTimesheetRow(row.id);
      if (!result.success) {
        alert(`Failed to delete: ${result.error}`);
      }
    } else {
      // Remove unsaved row from local state
      timesheetData = timesheetData.filter((_, i) => i !== index);
    }
  }
  
  function updateRow(index: number, field: keyof TimesheetRow, value: any) {
    const updatedRow = { ...timesheetData[index], [field]: value };
    dataStore.updateLocalRow(index, updatedRow);
  }
</script>

<div class="timesheet-container p-4">
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
      Timesheet
    </h2>
    <div class="flex gap-2">
      <Button on:click={addRow} size="sm">
        Add Row
      </Button>
      <Button on:click={() => dataStore.loadTimesheetDraft()} size="sm" color="alternative">
        Refresh
      </Button>
    </div>
  </div>
  
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
    <div class="overflow-x-auto">
      <Table hoverable={true}>
        <TableHead>
          <TableHeadCell>Date</TableHeadCell>
          <TableHeadCell>Time In</TableHeadCell>
          <TableHeadCell>Time Out</TableHeadCell>
          <TableHeadCell>Project</TableHeadCell>
          <TableHeadCell>Tool</TableHeadCell>
          <TableHeadCell>Charge Code</TableHeadCell>
          <TableHeadCell>Task Description</TableHeadCell>
          <TableHeadCell>Actions</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each timesheetData as row, index}
            <TableBodyRow>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="MM/DD/YYYY *"
                  value={row.date}
                  on:input={(e) => updateRow(index, 'date', e.target.value)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="HH:MM *"
                  value={row.timeIn}
                  on:input={(e) => updateRow(index, 'timeIn', e.target.value)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="HH:MM *"
                  value={row.timeOut}
                  on:input={(e) => updateRow(index, 'timeOut', e.target.value)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="Project *"
                  value={row.project}
                  on:input={(e) => updateRow(index, 'project', e.target.value)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="Tool"
                  value={row.tool || ''}
                  on:input={(e) => updateRow(index, 'tool', e.target.value || null)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="Code"
                  value={row.chargeCode || ''}
                  on:input={(e) => updateRow(index, 'chargeCode', e.target.value || null)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <Input
                  type="text"
                  size="sm"
                  placeholder="Task description *"
                  value={row.taskDescription}
                  on:input={(e) => updateRow(index, 'taskDescription', e.target.value)}
                />
              </TableBodyCell>
              <TableBodyCell>
                <div class="flex gap-1">
                  <Button
                    size="xs"
                    color="blue"
                    on:click={() => saveRow(index)}
                    disabled={!row.date || !row.timeIn || !row.timeOut || !row.project || !row.taskDescription}
                  >
                    Save
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    on:click={() => deleteRow(index)}
                  >
                    Delete
                  </Button>
                </div>
              </TableBodyCell>
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
      
      {#if timesheetData.length === 0}
        <div class="text-center py-8">
          <p class="text-gray-500 mb-4">No timesheet entries yet</p>
          <Button on:click={addRow}>Add First Entry</Button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .timesheet-container {
    max-width: 100%;
  }
</style>

