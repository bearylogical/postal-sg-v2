<script lang="ts">
	import { setContext } from 'svelte';
	import '../app.css';
	import { themes } from '$lib/config';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// STYLE CONFIG
	// Set theme globally (options are 'light' or 'dark')
	let theme = 'light';
	setContext('theme', themes[theme]);
</script>

{@render children?.()}
