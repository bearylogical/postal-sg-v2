<script lang="ts">
	import { run } from 'svelte/legacy';

	import parse from 'parse-color';

	interface Props {
		color?: string;
		nowrap?: boolean;
		children?: import('svelte').Snippet;
	}

	let { color = 'lightgrey', nowrap = true, children }: Props = $props();

	function textColor(rgb) {
		const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
		return brightness > 125 ? 'black' : 'white';
	}

	let text = $state('black');

	let rgb = $derived(parse(color).rgb);

	run(() => {
		if (rgb) {
			text = textColor(rgb);
		}
	});
</script>

<span class="em" class:nowrap style="background-color: {color}; color: {text}" role="presentation">
	{@render children?.()}
</span>

<style>
	.em {
		padding: 1px 4px 1px 4px;
		font-weight: bold;
	}
	.nowrap {
		white-space: nowrap;
	}
</style>
