<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Alert, Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Input, Select } from 'flowbite-svelte';
  import { invoke } from '@tauri-apps/api/core';
  
  interface ArchiveEntry {
    id: number;
    date: string;
    timeIn: string;
    timeOut: string;
    project: string;
    tool: string | null;
    chargeCode: string | null;
    taskDescription: string;
    status: string;
    submittedAt: string | null;
  }
  
  let archiveData: ArchiveEntry[] = [];
  let filteredData: ArchiveEntry[] = [];
  let isLoading = false;
  let error = '';
  
  let filterDate = '';
  let filterProject = '';
  let filterStatus = 'all';
  
  onMount(async () => {
    await loadArchiveData();
  });
  
  async function loadArchiveData() {
    isLoading = true;
    error = '';
    
    try {
      const result = await invoke<{
        success: boolean;
        entries: ArchiveEntry[];
        error?: string;
      }>('get_all_archive_data');
      
      if (result.success) {
        archiveData = result.entries;
        applyFilters();
      } else {
        error = result.error || 'Failed to load archive data';
      }
    } catch (err) {
      error = String(err);
    } finally {
      isLoading = false;
    }
  }
  
  function applyFilters() {
    filteredData = archiveData.filter(entry => {
      // Date filter
      if (filterDate && !entry.date.includes(filterDate)) {
        return false;
      }
      
      // Project filter
      if (filterProject && !entry.project.toLowerCase().includes(filterProject.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (filterStatus !== 'all' && entry.status !== filterStatus) {
        return false;
      }
      
      return true;
    });
  }
  
  function clearFilters() {
    filterDate = '';
    filterProject = '';
    filterStatus = 'all';
    applyFilters();
  }
  
  async function handleExportCSV() {
    try {
      const result = await invoke<{
        success: boolean;
        path?: string;
        error?: string;
      }>('timesheet_export_csv', {
        entries: filteredData,
      });
      
      if (result.success && result.path) {
        alert(`CSV exported to: ${result.path}`);
      } else {
        error = result.error || 'Failed to export CSV';
      }
    } catch (err) {
      error = String(err);
    }
  }
  
  $: {
    // Reapply filters when filter values change
    applyFilters();
  }
</script>

<div class="database-viewer-container p-4">
  <div class="flex justify-between items-center mb-6">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
      Archive / Submitted Timesheets
    </h2>
    <div class="flex gap-2">
      <Button size="sm" on:click={loadArchiveData}>
        Refresh
      </Button>
      <Button size="sm" color="blue" on:click={handleExportCSV} disabled={filteredData.length === 0}>
        Export CSV ({filteredData.length})
      </Button>
    </div>
  </div>
  
  {#if error}
    <Alert color="red" class="mb-4">
      {error}
    </Alert>
  {/if}
  
  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <div>
      <label class="block text-sm font-medium mb-2">Date</label>
      <Input
        type="text"
        placeholder="MM/DD/YYYY"
        bind:value={filterDate}
      />
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Project</label>
      <Input
        type="text"
        placeholder="Search project"
        bind:value={filterProject}
      />
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Status</label>
      <Select bind:value={filterStatus}>
        <option value="all">All</option>
        <option value="submitted">Submitted</option>
        <option value="pending">Pending</option>
      </Select>
    </div>
    <div class="flex items-end">
      <Button size="sm" color="alternative" on:click={clearFilters}>
        Clear Filters
      </Button>
    </div>
  </div>
  
  {#if isLoading}
    <div class="text-center py-8">
      <p class="text-gray-500">Loading archive data...</p>
    </div>
  {:else if filteredData.length === 0}
    <div class="text-center py-8">
      <p class="text-gray-500">No entries found</p>
      {#if archiveData.length > 0}
        <p class="text-sm text-gray-400 mt-2">Try adjusting your filters</p>
      {/if}
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
          <TableHeadCell>Task</TableHeadCell>
          <TableHeadCell>Status</TableHeadCell>
          <TableHeadCell>Submitted</TableHeadCell>
        </TableHead>
        <TableBody>
          {#each filteredData as entry}
            <TableBodyRow>
              <TableBodyCell>{entry.date}</TableBodyCell>
              <TableBodyCell>{entry.timeIn}</TableBodyCell>
              <TableBodyCell>{entry.timeOut}</TableBodyCell>
              <TableBodyCell>{entry.project}</TableBodyCell>
              <TableBodyCell>{entry.tool || '-'}</TableBodyCell>
              <TableBodyCell>{entry.chargeCode || '-'}</TableBodyCell>
              <TableBodyCell>{entry.taskDescription}</TableBodyCell>
              <TableBodyCell>
                <span class="px-2 py-1 text-xs rounded {entry.status === 'submitted' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'}">
                  {entry.status || 'pending'}
                </span>
              </TableBodyCell>
              <TableBodyCell>
                {#if entry.submittedAt}
                  {new Date(entry.submittedAt).toLocaleString()}
                {:else}
                  -
                {/if}
              </TableBodyCell>
            </TableBodyRow>
          {/each}
        </TableBody>
      </Table>
    </div>
    
    <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
      Showing {filteredData.length} of {archiveData.length} entries
    </div>
  {/if}
</div>

<style>
  .database-viewer-container {
    max-width: 100%;
  }
</style>

