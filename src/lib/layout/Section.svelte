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
