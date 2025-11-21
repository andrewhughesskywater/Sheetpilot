<script>
  import { onMount } from 'svelte';
  import { Button, Alert } from 'flowbite-svelte';
  
  let appVersion = '1.0.0';
  
  onMount(async () => {
    // Example: Get app version from Tauri
    // const version = await invoke('get_app_version');
    // appVersion = version;
  });
</script>

<div class="container mx-auto p-8">
  <div class="text-center mb-8">
    <h1 class="text-4xl font-bold mb-4">SheetPilot</h1>
    <p class="text-lg text-gray-600 dark:text-gray-400">Tauri + Svelte + Flowbite</p>
    <p class="text-sm text-gray-500">Version {appVersion}</p>
  </div>
  
  <Alert color="blue" class="mb-4">
    <span class="font-medium">Tauri refactor in progress!</span> 
    This is the new lightweight version of SheetPilot.
  </Alert>
  
  <div class="flex gap-4 justify-center">
    <Button>Primary Button</Button>
    <Button color="alternative">Secondary Button</Button>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
  }
</style>

