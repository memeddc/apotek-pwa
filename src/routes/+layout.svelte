<script lang="ts">
	import '$app/navigation';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { Toaster } from '$lib/components/ui/toast';
	import { Breadcrumb } from '$lib/components/ui/breadcrumb';
	import { CommandPalette } from '$lib/components/ui/command';
	import { Sheet } from '$lib/components/ui/sheet';
	import { cn } from '$lib/utils';
	import {
		LayoutDashboard,
		ShoppingCart,
		Receipt,
		FileSpreadsheet,
		Package,
		History,
		DollarSign,
		ClipboardList,
		Tag,
		Pill,
		Building2,
		ChevronLeft,
		ChevronRight,
		Search,
		MoreHorizontal
	} from 'lucide-svelte';

	let { children } = $props();

	let sidebarCollapsed = $state(false);
	let commandPaletteOpen = $state(false);
	let moreMenuOpen = $state(false);

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard, primaryMobile: true },
		{ href: '/penjualan', label: 'Penjualan', icon: ShoppingCart, primaryMobile: true },
		{ href: '/resep', label: 'Resep Dokter', icon: ClipboardList, primaryMobile: true },
		{ href: '/stok', label: 'Stok', icon: Package, primaryMobile: true },
		{ href: '/cetak_nota', label: 'Cetak Nota', icon: Receipt, primaryMobile: false },
		{ href: '/faktur', label: 'Faktur', icon: FileSpreadsheet, primaryMobile: false },
		{ href: '/kartu_stok', label: 'Kartu Stok', icon: History, primaryMobile: false },
		{ href: '/rubah_harga', label: 'Rubah Harga', icon: DollarSign, primaryMobile: false },
		{ href: '/jenisobat', label: 'Jenis Obat', icon: Tag, primaryMobile: false },
		{ href: '/obat', label: 'Obat', icon: Pill, primaryMobile: false },
		{ href: '/pbf', label: 'PBF / Supplier', icon: Building2, primaryMobile: false }
	];

	const mobileMainTabs = navItems.filter((i) => i.primaryMobile);
	const mobileMoreItems = navItems.filter((i) => !i.primaryMobile);

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Apotek PWA — Sistem Manajemen Apotek</title>
</svelte:head>

<!-- Global Toast -->
<Toaster />

<!-- Command Palette -->
<CommandPalette bind:open={commandPaletteOpen} />

<div class="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">

	<!-- Top App Header -->
	<header class="sticky top-0 z-30 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<button
				onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
				class="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
				aria-label="Toggle Sidebar"
			>
				{#if sidebarCollapsed}
					<ChevronRight class="w-5 h-5" />
				{:else}
					<ChevronLeft class="w-5 h-5" />
				{/if}
			</button>

			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold shadow-sm">
					💊
				</div>
				<div>
					<h1 class="text-sm font-bold text-slate-900 leading-tight">Apotek PWA</h1>
					<p class="text-[10px] text-slate-500 hidden sm:block">Sistem Manajemen Apotek</p>
				</div>
			</div>
		</div>

		<!-- Quick Search / Command Palette Trigger -->
		<button
			onclick={() => (commandPaletteOpen = true)}
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-500 text-xs transition-colors cursor-pointer"
		>
			<Search class="w-3.5 h-3.5" />
			<span class="hidden sm:inline">Cari modul...</span>
			<kbd class="hidden sm:inline text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">Ctrl+K</kbd>
		</button>
	</header>

	<div class="flex flex-1 relative">
		<!-- Desktop Sidebar -->
		<aside
			class={cn(
				"hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 z-20",
				sidebarCollapsed ? "w-16" : "w-64"
			)}
		>
			<nav class="p-3 space-y-1 overflow-y-auto flex-1">
				{#each navItems as item}
					<a
						href={item.href}
						class={cn(
							"flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
							isActive(item.href) ? "bg-teal-50 text-teal-700" : "hover:bg-slate-100 text-slate-600"
						)}
						title={sidebarCollapsed ? item.label : undefined}
					>
						<item.icon class={cn("w-5 h-5 shrink-0", isActive(item.href) ? "text-teal-600" : "text-slate-400")} />
						{#if !sidebarCollapsed}
							<span class="truncate">{item.label}</span>
						{/if}
					</a>
				{/each}
			</nav>

			<!-- Sidebar Footer -->
			{#if !sidebarCollapsed}
				<div class="p-3 border-t border-slate-100 text-xs text-slate-400 text-center">
					Apotek PWA v1.0
				</div>
			{/if}
		</aside>

		<!-- Main Content Area -->
		<main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
			<!-- Breadcrumb Navigation -->
			<Breadcrumb />

			{@render children()}
		</main>
	</div>

	<!-- Mobile Bottom Navigation Bar (Fixed at bottom) -->
	<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
		{#each mobileMainTabs as tab}
			<a
				href={tab.href}
				class={cn(
					"flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-colors",
					isActive(tab.href) ? "text-teal-600" : "text-slate-500"
				)}
			>
				<tab.icon class="w-5 h-5 mb-0.5" />
				<span class="text-[11px]">{tab.label}</span>
			</a>
		{/each}

		<button
			onclick={() => (moreMenuOpen = true)}
			class="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
		>
			<MoreHorizontal class="w-5 h-5 mb-0.5" />
			<span class="text-[11px]">Lainnya</span>
		</button>
	</nav>

	<!-- Mobile "More" Menu Sheet -->
	<Sheet bind:open={moreMenuOpen} title="Menu Lainnya" side="bottom">
		<div class="grid grid-cols-2 gap-2 py-2">
			{#each mobileMoreItems as item}
				<a
					href={item.href}
					onclick={() => (moreMenuOpen = false)}
					class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-teal-50 hover:border-teal-200 text-slate-700 hover:text-teal-900 transition-colors"
				>
					<div class="p-2 rounded-lg bg-white shadow-xs text-teal-600">
						<item.icon class="w-4 h-4" />
					</div>
					<span class="text-xs font-semibold">{item.label}</span>
				</a>
			{/each}
		</div>
	</Sheet>
</div>
