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
	import { slide } from 'svelte/transition';
	import {
		LayoutDashboard,
		ShoppingCart,
		Stethoscope,
		Printer,
		FileSpreadsheet,
		History,
		Pill,
		Tag,
		Truck,
		BarChart3,
		CreditCard,
		ArrowLeftRight,
		Database,
		ChevronLeft,
		ChevronRight,
		ChevronDown,
		Search,
		MoreHorizontal
	} from 'lucide-svelte';

	let { children } = $props();

	let sidebarCollapsed = $state(false);
	let commandPaletteOpen = $state(false);
	let moreMenuOpen = $state(false);

	let groupOpenStates = $state<Record<string, boolean>>({
		transaksi: true,
		mutasi: true,
		dataMaster: true
	});

	function toggleGroup(groupId: string) {
		groupOpenStates[groupId] = !groupOpenStates[groupId];
	}

	type NavItem = {
		href: string;
		label: string;
		icon: any;
	};

	type NavGroup = {
		id: string;
		title: string;
		icon: any;
		items: NavItem[];
	};

	const standaloneTop: NavItem = {
		href: '/',
		label: 'Dashboard',
		icon: LayoutDashboard
	};

	const navGroups: NavGroup[] = [
		{
			id: 'transaksi',
			title: 'Transaksi',
			icon: CreditCard,
			items: [
				{ href: '/penjualan', label: 'Penjualan', icon: ShoppingCart },
				{ href: '/resep', label: 'Resep Dokter', icon: Stethoscope },
				{ href: '/cetak_nota', label: 'Cetak Nota', icon: Printer }
			]
		},
		{
			id: 'mutasi',
			title: 'Mutasi',
			icon: ArrowLeftRight,
			items: [
				{ href: '/mutasi/faktur', label: 'Faktur Pembelian', icon: FileSpreadsheet },
				{ href: '/mutasi/stok', label: 'Kartu Stok', icon: History }
			]
		},
		{
			id: 'dataMaster',
			title: 'Data Master',
			icon: Database,
			items: [
				{ href: '/obat', label: 'Data & Stok Obat', icon: Pill },
				{ href: '/jenisobat', label: 'Jenis Obat', icon: Tag },
				{ href: '/pbf', label: 'PBF / Supplier', icon: Truck }
			]
		}
	];

	const standaloneBottom: NavItem = {
		href: '/laporan',
		label: 'Laporan',
		icon: BarChart3
	};

	// Mobile main 5 tabs
	const mobileMainTabs: NavItem[] = [
		standaloneTop,
		navGroups[0].items[0], // Penjualan
		navGroups[0].items[1], // Resep Dokter
		navGroups[2].items[0], // Data & Stok Obat
		standaloneBottom      // Laporan
	];

	// Get overflow items grouped for mobile "Lainnya" sheet
	const mobileMainHrefs = new Set(mobileMainTabs.map((t) => t.href));

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
				class="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
				aria-label="Toggle Sidebar"
			>
				<div class="transition-transform duration-300">
					{#if sidebarCollapsed}
						<ChevronRight class="w-5 h-5" />
					{:else}
						<ChevronLeft class="w-5 h-5" />
					{/if}
				</div>
			</button>

			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold shadow-sm transition-transform duration-200 hover:scale-105">
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
			class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-500 text-xs transition-all duration-200 hover:shadow-xs cursor-pointer"
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
				"hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 z-20 overflow-hidden",
				sidebarCollapsed ? "w-16" : "w-64"
			)}
		>
			<nav class="p-3 space-y-3 overflow-y-auto flex-1 select-none">
				<!-- Standalone Dashboard -->
				<div>
					<a
						href={standaloneTop.href}
						class={cn(
							"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
							isActive(standaloneTop.href) ? "bg-teal-50 text-teal-700 font-semibold shadow-xs" : "hover:bg-slate-100 text-slate-600"
						)}
						title={sidebarCollapsed ? standaloneTop.label : undefined}
					>
						<standaloneTop.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(standaloneTop.href) ? "text-teal-600" : "text-slate-400")} />
						{#if !sidebarCollapsed}
							<span class="truncate transition-opacity duration-200">{standaloneTop.label}</span>
						{/if}
					</a>
				</div>

				<!-- Nav Groups -->
				{#each navGroups as group}
					<div class="pt-1 border-t border-slate-100">
						{#if !sidebarCollapsed}
							<!-- Group Header (Expanded mode) -->
							<button
								type="button"
								onclick={() => toggleGroup(group.id)}
								class="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer rounded-md group"
							>
								<div class="flex items-center gap-2">
									<group.icon class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
									<span>{group.title}</span>
								</div>
								<ChevronDown
									class={cn(
										"w-3.5 h-3.5 transition-transform duration-200",
										groupOpenStates[group.id] ? "rotate-0" : "-rotate-90"
									)}
								/>
							</button>
						{/if}

						{#if sidebarCollapsed}
							<!-- Collapsed sidebar list -->
							<div class="space-y-0.5 mt-1">
								{#each group.items as item}
									<a
										href={item.href}
										class={cn(
											"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
											isActive(item.href) ? "bg-teal-50 text-teal-700 font-semibold shadow-xs" : "hover:bg-slate-100 text-slate-600"
										)}
										title={item.label}
									>
										<item.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(item.href) ? "text-teal-600" : "text-slate-400")} />
									</a>
								{/each}
							</div>
						{:else if groupOpenStates[group.id]}
							<!-- Expanded collapsible menu list with slide transition -->
							<div transition:slide={{ duration: 200 }} class="space-y-0.5 mt-1 overflow-hidden">
								{#each group.items as item}
									<a
										href={item.href}
										class={cn(
											"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
											isActive(item.href) ? "bg-teal-50 text-teal-700 font-semibold shadow-xs" : "hover:bg-slate-100 text-slate-600"
										)}
									>
										<item.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(item.href) ? "text-teal-600" : "text-slate-400")} />
										<span class="truncate">{item.label}</span>
									</a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}

				<!-- Standalone Bottom Laporan -->
				<div class="pt-1 border-t border-slate-100">
					<a
						href={standaloneBottom.href}
						class={cn(
							"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
							isActive(standaloneBottom.href) ? "bg-teal-50 text-teal-700 font-semibold shadow-xs" : "hover:bg-slate-100 text-slate-600"
						)}
						title={sidebarCollapsed ? standaloneBottom.label : undefined}
					>
						<standaloneBottom.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(standaloneBottom.href) ? "text-teal-600" : "text-slate-400")} />
						{#if !sidebarCollapsed}
							<span class="truncate">{standaloneBottom.label}</span>
						{/if}
					</a>
				</div>
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
					"flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium transition-all duration-150",
					isActive(tab.href) ? "text-teal-600 font-semibold scale-105" : "text-slate-500 hover:text-slate-700"
				)}
			>
				<tab.icon class="w-5 h-5 mb-0.5" />
				<span class="text-[11px]">{tab.label}</span>
			</a>
		{/each}

		<button
			onclick={() => (moreMenuOpen = true)}
			class="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 transition-all duration-150 cursor-pointer"
		>
			<MoreHorizontal class="w-5 h-5 mb-0.5" />
			<span class="text-[11px]">Lainnya</span>
		</button>
	</nav>

	<!-- Mobile "More" Menu Sheet -->
	<Sheet bind:open={moreMenuOpen} title="Menu Lainnya" side="bottom">
		<div class="space-y-4 py-2">
			{#each navGroups as group}
				{#if group.items.some((item) => !mobileMainHrefs.has(item.href))}
					<div>
						<h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1 flex items-center gap-1.5">
							<group.icon class="w-3.5 h-3.5" />
							{group.title}
						</h4>
						<div class="grid grid-cols-2 gap-2">
							{#each group.items.filter((item) => !mobileMainHrefs.has(item.href)) as item}
								<a
									href={item.href}
									onclick={() => (moreMenuOpen = false)}
									class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-teal-50 hover:border-teal-200 text-slate-700 hover:text-teal-900 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
								>
									<div class="p-2 rounded-lg bg-white shadow-xs text-teal-600">
										<item.icon class="w-4 h-4" />
									</div>
									<span class="text-xs font-semibold">{item.label}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</Sheet>
</div>
