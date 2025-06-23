<script lang="ts">
	import { setContext } from 'svelte';
	import '../app.css';
	import { themes } from '$lib/config';

	// STYLE CONFIG
	// Set theme globally (options are 'light' or 'dark')
	let theme = 'light';
	setContext('theme', themes[theme]);
</script>
