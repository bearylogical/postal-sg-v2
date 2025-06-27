<script lang="ts">
	import { themes } from '$lib/config.js';
	import { getContext } from 'svelte';

	interface Props {
		theme?: any;
		bgimage?: any;
		bgcolor?: any;
		bgfixed?: boolean;
		center?: boolean;
		short?: boolean;
		children?: import('svelte').Snippet;
	}

	let {
		theme = getContext('theme'),
		bgimage = null,
		bgcolor = null,
		bgfixed = false,
		center = true,
		short = false,
		children
	}: Props = $props();

	let style = $state('');

	if (bgimage) {
		style += `background-image: url(${bgimage});`;
	} else {
		style += 'background-image: none;';
	}

	if (bgfixed) {
		style += ' background-attachment: fixed;';
	}
</script>

<header style="color: black; background-color:white; {style}" class:short>
	<div
		class="v-padded col-wide middle"
		style="position: relative"
		class:short
		class:height-full={!short}
	>
		<div class:center>
			{@render children?.()}
		</div>
	</div>
</header>

<style>
	.short {
		min-height: 85vh;
	}
	.v-padded {
		box-sizing: border-box;
		padding: 40px 0;
	}
</style>
