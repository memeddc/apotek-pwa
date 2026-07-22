<script lang="ts">
	import '$app/navigation';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	let sidebarOpen = $state(false);
	let sidebarCollapsed = $state(false);

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: '📊' },
		{ href: '/penjualan', label: 'Penjualan', icon: '🛒' },
		{ href: '/cetak_nota', label: 'Cetak Nota', icon: '🧾' },
		{ href: '/faktur', label: 'Faktur', icon: 'F' },
		{ href: '/stok', label: 'Stok', icon: 'S' },
		{ href: '/kartu_stok', label: 'Kartu Stok', icon: 'K' },
		{ href: '/rubah_harga', label: 'Rubah Harga', icon: '💲' },
		{ href: '/resep', label: 'Resep Dokter', icon: '📋' },
		{ href: '/jenisobat', label: 'Jenis Obat', icon: '🏷️' },
		{ href: '/obat', label: 'Obat', icon: '💊' },
		{ href: '/pbf', label: 'PBF / Supplier', icon: '🏢' }
	];

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Apotek PWA — Sistem Manajemen Apotek</title>
</svelte:head>

<div class="app-layout">
	<!-- Mobile Header -->
	<div class="mobile-header">
		<button onclick={() => (sidebarOpen = !sidebarOpen)}>☰</button>
		<h3>💊 Apotek PWA</h3>
	</div>

	<!-- Mobile Overlay -->
	{#if sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="mobile-overlay" onclick={() => (sidebarOpen = false)}></div>
	{/if}

	<!-- Sidebar -->
	<aside class="sidebar" class:open={sidebarOpen} class:collapsed={sidebarCollapsed}>
		<div class="sidebar-brand">
			<button class="sidebar-toggle" aria-label="Tutup atau buka sidebar" onclick={() => (sidebarCollapsed = !sidebarCollapsed)}>&#9776;</button>
			<h2>💊 Apotek PWA</h2>
			<p>Sistem Manajemen Apotek</p>
		</div>
		<nav class="sidebar-nav">
			{#each navItems as item}
				<a
					href={item.href}
					class:active={isActive(item.href)}
					onclick={() => (sidebarOpen = false)}
				>
					<span class="nav-icon">{item.icon}</span>
					<span class="nav-label">{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="main-content" class:sidebar-collapsed={sidebarCollapsed}>
		{@render children()}
	</main>
</div>
