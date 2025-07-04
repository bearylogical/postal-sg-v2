<script lang="ts">
	import { themes } from '$lib/config.js';
	import { getContext } from 'svelte';

	let { theme = getContext('theme'), children } = $props();
</script>

<section style="color: {theme['text']}; background-color: {theme['background']}">
	<div class="col-medium">
		{@render children?.()}
	</div>
</section>

<style>
	section {
		display: block;
		width: 100%;
		padding: 1rem;
		box-sizing: border-box;
	}

	.col-medium {
		max-width: 800px;
		margin: 0 auto;
	}

	@media (max-width: 600px) {
		.col-medium {
			padding: 0 1rem;
		}
	}
</style>
