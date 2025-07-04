<script lang="ts">
	import { page } from '$app/stores';
	import { themes } from '$lib/config.js';
	import { getContext, onMount } from 'svelte';

	interface Props {
		theme?: any;
		bgimage?: any;
		bgcolor?: any;
		bgfixed?: boolean;
		center?: boolean;
		short?: boolean;
		children?: import('svelte').Snippet;
		showHeaderToggle?: boolean;
	}

	let { children, showHeaderToggle }: Props = $props();

	let style = $state('');
	let isMenuOpen = $state(false);
	let isHeaderVisible = $state(true);

	// Define pages where the header toggle should not appear
	const pagesWithHeaderToggle = ['/', '/about'];

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	function closeMenu() {
		isMenuOpen = false;
	}

	function toggleHeader() {
		isHeaderVisible = !isHeaderVisible;
		if (typeof window !== 'undefined') {
			document.body.style.paddingTop = isHeaderVisible ? '80px' : '0';
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			document.body.style.paddingTop = '80px';
		}
	});

	let shouldShowHeaderToggle = $derived.by(
		() =>
			showHeaderToggle ??
			!pagesWithHeaderToggle.some((path) => {
				if (path === '/') {
					return $page.url.pathname === '/'; // Exact match for root
				}

				return $page.url.pathname.startsWith(path);
			})
	);
</script>

<!-- Show Header Button (when header is hidden) -->
{#if !isHeaderVisible && shouldShowHeaderToggle}
	<div class="show-header-trigger">
		<div class="header-toggle-container">
			<button class="header-toggle-btn" onclick={toggleHeader} aria-label="Show header">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="6 9 12 15 18 9" transform="rotate(0 12 12)"></polyline>
				</svg>
			</button>
			<span class="header-toggle-text">Show</span>
		</div>
	</div>
{/if}

<header class="brutalist-header" class:hidden={!isHeaderVisible}>
	<div class="header-container">
		<!-- Logo/Brand -->
		<div class="brand">
			<a href="/" class="brand-link"> Stories </a>
		</div>

		<!-- Desktop Navigation -->
		<nav class="desktop-nav">
			<ul class="nav-list">
				<li class="nav-item">
					<button class="brutalist-button">Home</button>
				</li>

				<li class="nav-item">
					<button class="brutalist-button">About</button>
				</li>
			</ul>
		</nav>

		<!-- Mobile Menu Button -->
		<button class="mobile-menu-btn" aria-label="Toggle menu" onclick={toggleMenu}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
				<path
					d="M3 12h18M3 6h18M3 18h18"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>

		<!-- Header Toggle Button (when header is visible) -->
		{#if shouldShowHeaderToggle}
			<div class="header-toggle-container visible">
				<button class="header-toggle-btn" aria-label="Hide header" onclick={toggleHeader}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="6 9 12 15 18 9" transform="rotate(180 12 12)"></polyline>
					</svg>
				</button>
				<span class="header-toggle-text">Hide</span>
			</div>
		{/if}
	</div>

	<div class="header-content">
		{@render children?.()}
	</div>

	<!-- Mobile Menu Overlay -->
	{#if isMenuOpen}
		<div
			class="mobile-menu-overlay"
			role="button"
			tabindex="0"
			aria-label="Close menu"
			onclick={closeMenu}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') closeMenu();
			}}
		>
			<div
				class="mobile-menu-wrapper"
				aria-label="Mobile menu content"
				onclick={(e) => e.stopPropagation()}
			>
				<nav class="mobile-menu" aria-label="Mobile menu">
					<div class="mobile-menu-header">
						<span class="mobile-menu-title">Menu</span>
						<button class="mobile-menu-close" onclick={closeMenu} aria-label="Close menu">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M18 6L6 18M6 6l12 12"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
					</div>

					<div class="mobile-menu-content">
						<ul class="mobile-nav-list">
							<li class="mobile-nav-section">
								<span class="mobile-nav-section-title">Getting Started</span>
								<ul class="mobile-nav-subsection">
									<li>
										<a href="/overview" class="mobile-nav-link" onclick={closeMenu}>Overview</a>
									</li>
									<li>
										<a href="/installation" class="mobile-nav-link" onclick={closeMenu}
											>Installation</a
										>
									</li>
								</ul>
							</li>

							<li class="mobile-nav-section">
								<span class="mobile-nav-section-title">Components</span>
								<ul class="mobile-nav-subsection">
									<li>
										<a
											href="/components/buttons"
											class="mobile-nav-link"
											aria-label="close menu"
											onclick={closeMenu}>Buttons</a
										>
									</li>
									<li>
										<a href="/components/cards" class="mobile-nav-link" onclick={closeMenu}>Cards</a
										>
									</li>
									<li>
										<a href="/components/forms" class="mobile-nav-link" onclick={closeMenu}>Forms</a
										>
									</li>
								</ul>
							</li>

							<li class="mobile-nav-section">
								<a
									href="https://github.com/marieooq/neo-brutalism-ui-library"
									target="_blank"
									class="mobile-github-link"
									onclick={closeMenu}
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
										/>
									</svg>
									GitHub
								</a>
							</li>
						</ul>
					</div>
				</nav>
			</div>
		</div>
	{/if}
</header>

<style>
	/* Brutalist Header Component Styles */
	.brutalist-header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 1000;
		background: #ffffff;
		border-bottom: 4px solid #000000;
		box-shadow: 8px 8px 0px #000000;
		height: 80px;
		transition: top 0.3s ease-in-out;
	}

	.brutalist-header.hidden {
		top: -80px;
	}

	.header-container {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1.25rem;
		position: relative;
	}

	.header-content {
		text-align: center;
		padding: 2rem 0;
	}

	.brand {
		flex-shrink: 0;
	}

	.brand-link {
		font-size: 1.75rem;
		font-weight: 900;
		color: #000000;
		text-decoration: none;
		text-transform: uppercase;
		letter-spacing: -0.02em;
		transition: transform 0.2s ease;
	}

	.brand-link:hover {
		transform: rotate(-2deg) scale(1.05);
	}

	.desktop-nav {
		display: none;
	}

	.nav-list {
		display: flex;
		align-items: center;
		gap: 2rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.mobile-menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #ffffff;
		border: 2px solid #000000;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mobile-menu-btn:hover {
		background: #000000;
		color: #ffffff;
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0px #ff6b35;
	}

	.mobile-menu-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1001;
		display: flex;
		justify-content: flex-start;
	}

	.mobile-menu {
		background: #ffffff;
		border-right: 4px solid #000000;
		box-shadow: 8px 0px 0px rgba(0, 0, 0, 0.1);
		width: 85%;
		max-width: 320px;
		height: 100vh;
		overflow-y: auto;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.mobile-menu-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 3px solid #000000;
		background: #f8f8f8;
	}

	.mobile-menu-title {
		font-size: 1.25rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mobile-menu-close {
		background: none;
		border: 2px solid #000000;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mobile-menu-close:hover {
		background: #000000;
		color: #ffffff;
	}

	.mobile-menu-content {
		padding: 1.5rem;
	}

	.mobile-nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.mobile-nav-section {
		margin-bottom: 2rem;
	}

	.mobile-nav-section-title {
		display: block;
		font-size: 1.125rem;
		font-weight: 900;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 1rem;
		color: #000000;
		border-bottom: 2px solid #ff6b35;
		padding-bottom: 0.5rem;
	}

	.mobile-nav-subsection {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.mobile-nav-link {
		display: block;
		color: #000000;
		text-decoration: none;
		font-weight: 600;
		padding: 0.75rem 0;
		border-bottom: 1px solid #e5e5e5;
		transition: all 0.2s ease;
	}

	.mobile-nav-link:hover {
		color: #ff6b35;
		padding-left: 1rem;
		border-left: 3px solid #ff6b35;
	}

	.mobile-github-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #000000;
		text-decoration: none;
		font-weight: 700;
		padding: 1rem;
		border: 2px solid #000000;
		background: #f8f8f8;
		transition: all 0.2s ease;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mobile-github-link:hover {
		background: #000000;
		color: #ffffff;
		transform: translate(-2px, -2px);
		box-shadow: 4px 4px 0px #ff6b35;
	}
	/* Arrow animations */
	.arrow-up,
	.arrow-down {
		transition: transform 0.3s ease;
	}

	.arrow-up {
		transform: rotate(180deg);
	}

	.arrow-down {
		transform: rotate(0deg);
	}
	/* Header Toggle Styles */
	.header-toggle-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.header-toggle-container:hover {
		opacity: 1;
	}

	/* When header is visible - positioned in header */
	.header-toggle-container.visible {
		position: absolute;
		bottom: -80px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1001;
	}

	/* When header is hidden - positioned at top of screen */
	.show-header-trigger {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1001;
	}

	.show-header-trigger .header-toggle-container {
		opacity: 0;
		transform: translateY(-10px);
		transition: all 0.3s ease;
	}

	.show-header-trigger:hover .header-toggle-container {
		opacity: 1;
		transform: translateY(0);
	}

	.header-toggle-btn {
		background: rgba(255, 255, 255, 0.95);
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 50%;
		padding: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(4px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.header-toggle-btn:hover {
		background: rgba(255, 255, 255, 1);
		color: rgba(0, 0, 0, 0.9);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
		transform: translateY(-1px);
	}

	.header-toggle-text {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgba(0, 0, 0, 0.7);
		background: rgba(255, 255, 255, 0.9);
		padding: 2px 8px;
		border-radius: 12px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(0, 0, 0, 0.1);
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Desktop styles */
	@media (min-width: 768px) {
		.header-container {
			padding: 0 3rem;
		}

		.desktop-nav {
			display: block;
		}

		.mobile-menu-btn {
			display: none;
		}
	}

	@media (min-width: 1024px) {
		.header-container {
			padding: 0 6rem;
		}
	}
</style>
