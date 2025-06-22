<script>
	import { onMount } from 'svelte';

	let counter = 0;
	let isVisible = true;

	function updateCounter() {
		isVisible = false;
		setTimeout(() => {
			counter = Math.floor(Math.random() * 10);
			isVisible = true;
		}, 1000); // Half of the total animation time
	}

	onMount(() => {
		const interval = setInterval(updateCounter, 2000);
		return () => clearInterval(interval);
	});
</script>

<span class="counter" class:fade-in={isVisible} class:fade-out={!isVisible}>
	{counter}
</span>

<style>
	.counter {
		opacity: 0;
		transition: opacity 2s ease-in-out;
		display: inline-block; /* This ensures the span behaves more like a block for styling purposes */
	}

	.fade-in {
		opacity: 1;
	}

	.fade-out {
		opacity: 0;
	}
</style>
