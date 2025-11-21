import './styles.css';
import 'flowbite/dist/flowbite.css';
import 'flowbite';
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
