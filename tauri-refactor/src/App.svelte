<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Alert, Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
  import Login from './lib/components/Login.svelte';
  import TimesheetGrid from './lib/components/TimesheetGrid.svelte';
  import { sessionStore, isLoggedIn, isAdmin, currentUser } from './lib/stores/session';
  
  let showLogin = false;
  
  onMount(async () => {
    await sessionStore.initialize();
  });
  
  $: {
    // Show login if not logged in and not loading
    if (!$sessionStore.isLoading && !$isLoggedIn) {
      showLogin = true;
    } else {
      showLogin = false;
    }
  }
  
  async function handleLogout() {
    await sessionStore.logout();
  }
</script>

<div class="app-container min-h-screen bg-gray-50 dark:bg-gray-900">
  <!-- Navigation -->
  <Navbar let:hidden let:toggle>
    <NavBrand href="/">
      <span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
        SheetPilot
      </span>
    </NavBrand>
    <NavHamburger on:click={toggle} />
    <NavUl {hidden}>
      {#if $isLoggedIn}
        <NavLi>
          <span class="text-gray-700 dark:text-gray-300">
            {$currentUser}
            {#if $isAdmin}
              <span class="ml-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded">
                Admin
              </span>
            {/if}
          </span>
        </NavLi>
        <NavLi>
          <Button size="sm" color="alternative" on:click={handleLogout}>
            Logout
          </Button>
        </NavLi>
      {/if}
    </NavUl>
  </Navbar>
  
  <!-- Main Content -->
  <main class="container mx-auto p-4">
    {#if $sessionStore.isLoading}
      <div class="flex items-center justify-center h-96">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    {:else if $isLoggedIn}
      {#if $isAdmin}
        <Alert color="yellow" class="mb-4">
          <span class="font-medium">Admin Mode:</span> You are logged in as an administrator.
        </Alert>
      {/if}
      
      <TimesheetGrid />
    {:else}
      <div class="flex items-center justify-center h-96">
        <div class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to SheetPilot
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Please log in to continue
          </p>
          <Button on:click={() => showLogin = true}>
            Login
          </Button>
        </div>
      </div>
    {/if}
  </main>
  
  <!-- Login Modal -->
  <Login bind:open={showLogin} />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  .app-container {
    min-height: 100vh;
  }
</style>
