<script lang="ts">
  import { Modal, Button, Input, Label, Checkbox, Alert } from 'flowbite-svelte';
  import { sessionStore } from '../stores/session';
  
  export let open = true;
  
  let email = '';
  let password = '';
  let stayLoggedIn = false;
  let error = '';
  let isLoggingIn = false;
  
  async function handleLogin() {
    if (!email || !password) {
      error = 'Email and password are required';
      return;
    }
    
    isLoggingIn = true;
    error = '';
    
    const result = await sessionStore.login(email, password, stayLoggedIn);
    
    if (result.success) {
      // Login successful, modal will close automatically
      open = false;
    } else {
      error = result.error || 'Login failed';
    }
    
    isLoggingIn = false;
  }
  
  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin();
    }
  }
</script>

<Modal bind:open size="sm" autoclose={false} class="w-full">
  <div class="text-center mb-6">
    <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
      SheetPilot Login
    </h3>
    <p class="text-sm text-gray-500 dark:text-gray-400">
      Sign in to manage your timesheets
    </p>
  </div>
  
  {#if error}
    <Alert color="red" class="mb-4">
      <span class="font-medium">Login failed!</span> {error}
    </Alert>
  {/if}
  
  <form on:submit|preventDefault={handleLogin} class="space-y-4">
    <div>
      <Label for="email" class="mb-2">Email / Username</Label>
      <Input
        type="text"
        id="email"
        bind:value={email}
        placeholder="Enter your email"
        required
        disabled={isLoggingIn}
        on:keypress={handleKeyPress}
      />
    </div>
    
    <div>
      <Label for="password" class="mb-2">Password</Label>
      <Input
        type="password"
        id="password"
        bind:value={password}
        placeholder="Enter your password"
        required
        disabled={isLoggingIn}
        on:keypress={handleKeyPress}
      />
    </div>
    
    <div class="flex items-center">
      <Checkbox bind:checked={stayLoggedIn} disabled={isLoggingIn}>
        Stay logged in
      </Checkbox>
    </div>
    
    <Button
      type="submit"
      class="w-full"
      disabled={isLoggingIn}
    >
      {#if isLoggingIn}
        Logging in...
      {:else}
        Sign In
      {/if}
    </Button>
  </form>
  
  <div class="text-center mt-4">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Admin credentials: Admin / SWFL_ADMIN
    </p>
  </div>
</Modal>

