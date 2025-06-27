<script lang="ts">
	interface Props {
		loading?: boolean;
		content?: string;
	}

	let { loading = true, content = '' }: Props = $props();
</script>

{#if loading}
	<div class="skeleton skeleton-text"></div>
	<div class="skeleton skeleton-text"></div>
	<div class="skeleton skeleton-image"></div>
{:else}
	<p>{content}</p>
	<!-- Your actual content here -->
{/if}

<style>
	.skeleton {
		background: #f0f0f0;
		background: linear-gradient(110deg, #ececec 8%, #f5f5f5 18%, #ececec 33%);
		border-radius: 5px;
		background-size: 200% 100%;
		animation: 1.5s shine linear infinite;
	}

	@keyframes shine {
		to {
			background-position-x: -200%;
		}
	}

	/* Example usage */
	.skeleton-text {
		height: 1em;
		margin-bottom: 0.5em;
	}

	.skeleton-image {
		height: 200px;
		width: 100%;
	}
</style>
