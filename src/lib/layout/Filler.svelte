<script lang="ts">
	import { themes } from '../config.js';
	import { getContext } from 'svelte';

	interface Props {
		theme?: any;
		center?: boolean;
		wide?: boolean;
		short?: boolean;
		children?: import('svelte').Snippet;
	}

	let {
		theme = getContext('theme'),
		center = true,
		wide = false,
		short = false,
		children
	}: Props = $props();
</script>

<section style="color: {theme['text']}; background-color: {theme['background']};">
	<div
		class="middle"
		class:center
		class:col-medium={!wide}
		class:col-wide={wide}
		class:height-full={!short}
		class:short
	>
		{@render children?.()}
	</div>
</section>

<style>
	section {
		padding: 36px 0;
	}
	.short {
		min-height: 70vh;
	}
</style>
