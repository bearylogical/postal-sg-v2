<script lang="ts">
	import { setContext } from 'svelte';

	import { themes } from '$lib/config';
	import { tick } from 'svelte';
	import { gsap } from 'gsap/dist/gsap';
	import { Flip } from 'gsap/dist/Flip';

	gsap.registerPlugin(Flip);

	type Layout = 'stack' | 'grid';

	let layout: Layout = 'stack';

	// STYLE CONFIG
	// Set theme globally (options are 'light' or 'dark')
	let theme = 'light';
	setContext('theme', themes[theme]);

	async function flip() {
		// get initial state
		const state = Flip.getState('.circle', { props: 'borderRadius' });

		// change layout
		layout === 'grid' ? (layout = 'stack') : (layout = 'grid');

		// wait for changes to DOM
		await tick();

		// flip
		Flip.from(state, {
			duration: 0.6,
			absolute: true,
			scale: true,
			stagger: -0.1,
			spin: true,
			ease: 'power1.easeOut'
		});
	}
</script>

<div class="container">
	<h1 class="text-6xl">Under Construction</h1>
	<p>This page is currently under construction. Please check back later.</p>
</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 70vh;
		text-align: center;
	}

	h1 {
		color: var(--color-primary);
		margin-bottom: 1rem;
	}

	p {
		color: var(--color-secondary);
		font-size: 1.25rem;
	}
</style>
