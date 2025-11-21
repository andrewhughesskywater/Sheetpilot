<script lang="ts">
  import { onMount } from 'svelte';
  import { Card, Button, Alert, Modal, Label, Input, Toggle } from 'flowbite-svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { sessionStore, isAdmin, currentUser } from '../stores/session';
  
  let credentials: Array<{service: string; email: string}> = [];
  let isLoading = false;
  let error = '';
  let success = '';
  
  let showCredentialsModal = false;
  let showAboutModal = false;
  let showAdminModal = false;
  
  onMount(async () => {
    await loadCredentials();
  });
  
  async function loadCredentials() {
    try {
      const result = await invoke<{success: boolean; credentials: Array<{service: string; email: string}>}>('credentials_list');
      if (result.success) {
        credentials = result.credentials;
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  }
  
  async function handleDeleteCredential(service: string) {
    if (!confirm(`Delete ${service} credentials?`)) {
      return;
    }
    
    try {
      const result = await invoke<{success: boolean; error?: string}>('credentials_delete', { service });
      if (result.success) {
        success = 'Credentials deleted successfully';
        setTimeout(() => success = '', 3000);
        await loadCredentials();
      } else {
        error = result.error || 'Failed to delete credentials';
      }
    } catch (err) {
      error = String(err);
    }
  }
  
  async function handleClearAllCredentials() {
    if (!confirm('Clear ALL stored credentials? This cannot be undone.')) {
      return;
    }
    
    try {
      const result = await invoke<{success: boolean; error?: string}>('admin_clear_credentials');
      if (result.success) {
        success = 'All credentials cleared';
        setTimeout(() => success = '', 3000);
        await loadCredentials();
      } else {
        error = result.error || 'Failed to clear credentials';
      }
    } catch (err) {
      error = String(err);
    }
  }
  
  async function handleRebuildDatabase() {
    if (!confirm('Rebuild database? This will clear all draft entries but keep submitted records.')) {
      return;
    }
    
    try {
      const result = await invoke<{success: boolean; error?: string}>('admin_rebuild_database');
      if (result.success) {
        success = 'Database rebuilt successfully';
        setTimeout(() => success = '', 3000);
      } else {
        error = result.error || 'Failed to rebuild database';
      }
    } catch (err) {
      error = String(err);
    }
  }
</script>

<div class="settings-container p-4">
  <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
    Settings
  </h2>
  
  {#if success}
    <Alert color="green" class="mb-4">
      {success}
    </Alert>
  {/if}
  
  {#if error}
    <Alert color="red" class="mb-4">
      {error}
    </Alert>
  {/if}
  
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- User Info Card -->
    <Card>
      <h3 class="text-lg font-semibold mb-2">User Information</h3>
      <div class="space-y-2">
        <p class="text-gray-700 dark:text-gray-300">
          <strong>Email:</strong> {$currentUser}
        </p>
        <p class="text-gray-700 dark:text-gray-300">
          <strong>Role:</strong> {$isAdmin ? 'Administrator' : 'User'}
        </p>
      </div>
    </Card>
    
    <!-- Credentials Card -->
    <Card>
      <h3 class="text-lg font-semibold mb-2">Stored Credentials</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Manage saved service credentials
      </p>
      <Button size="sm" on:click={() => showCredentialsModal = true}>
        View Credentials ({credentials.length})
      </Button>
    </Card>
    
    <!-- About Card -->
    <Card>
      <h3 class="text-lg font-semibold mb-2">About SheetPilot</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Version and system information
      </p>
      <Button size="sm" on:click={() => showAboutModal = true}>
        View Details
      </Button>
    </Card>
    
    <!-- Admin Tools Card (only if admin) -->
    {#if $isAdmin}
      <Card>
        <h3 class="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">
          Admin Tools
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Administrative functions
        </p>
        <Button size="sm" color="red" on:click={() => showAdminModal = true}>
          Open Admin Tools
        </Button>
      </Card>
    {/if}
  </div>
</div>

<!-- Credentials Modal -->
<Modal bind:open={showCredentialsModal} title="Stored Credentials" autoclose>
  {#if credentials.length === 0}
    <p class="text-gray-600 dark:text-gray-400">No credentials stored</p>
  {:else}
    <div class="space-y-3">
      {#each credentials as cred}
        <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
          <div>
            <p class="font-semibold">{cred.service}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">{cred.email}</p>
          </div>
          <Button size="xs" color="red" on:click={() => handleDeleteCredential(cred.service)}>
            Delete
          </Button>
        </div>
      {/each}
    </div>
  {/if}
</Modal>

<!-- About Modal -->
<Modal bind:open={showAboutModal} title="About SheetPilot" autoclose>
  <div class="space-y-4">
    <div class="text-center mb-4">
      <h3 class="text-2xl font-bold">SheetPilot</h3>
      <p class="text-gray-600 dark:text-gray-400">Tauri Edition</p>
    </div>
    
    <div class="space-y-2">
      <p><strong>Version:</strong> 1.0.0</p>
      <p><strong>Framework:</strong> Tauri v2 + Svelte 5</p>
      <p><strong>Backend:</strong> Rust</p>
      <p><strong>Database:</strong> SQLite (rusqlite)</p>
    </div>
    
    <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
      <p class="text-sm">
        <strong>New in Tauri:</strong> 96% smaller deployment size (25MB vs 668MB),
        faster startup, and native performance.
      </p>
    </div>
  </div>
</Modal>

<!-- Admin Tools Modal -->
<Modal bind:open={showAdminModal} title="Admin Tools" autoclose={false}>
  <div class="space-y-4">
    <Alert color="yellow">
      <span class="font-medium">Warning:</span> These actions are irreversible
    </Alert>
    
    <div class="space-y-3">
      <Card>
        <h4 class="font-semibold mb-2">Clear All Credentials</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Remove all stored service credentials from the database
        </p>
        <Button size="sm" color="red" on:click={handleClearAllCredentials}>
          Clear All Credentials
        </Button>
      </Card>
      
      <Card>
        <h4 class="font-semibold mb-2">Rebuild Database</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Rebuild database schema (clears draft entries, keeps submissions)
        </p>
        <Button size="sm" color="red" on:click={handleRebuildDatabase}>
          Rebuild Database
        </Button>
      </Card>
    </div>
  </div>
</Modal>

<style>
  .settings-container {
    max-width: 1200px;
    margin: 0 auto;
  }
</style>

