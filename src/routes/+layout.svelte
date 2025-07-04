<script lang="ts">
	import { setContext } from 'svelte';
	import Header from '$lib/layout/Header.svelte';
	import { themes } from '$lib/config';
	import './../app.css';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	// STYLE CONFIG
	// Set theme globally (options are 'light' or 'dark')
	let theme = 'light';
	setContext('theme', themes[theme]);
</script>

<Header></Header>

<main>
	{@render children?.()}
</main>
