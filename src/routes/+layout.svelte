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
		MoreHorizontal,
		PanelLeftClose,
		PanelLeftOpen
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

	const mobileMainHrefs = new Set(mobileMainTabs.map((t) => t.href));

	function isActive(href: string): boolean {
		if (href === '/') return page.url.pathname === '/';
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Sistem Manajemen Apotek</title>
</svelte:head>

<!-- Global Toast -->
<Toaster />

<!-- Command Palette -->
<CommandPalette bind:open={commandPaletteOpen} />

<div class="min-h-screen bg-slate-50 text-slate-900 flex antialiased">
	<!-- Desktop Full-Height Sidebar -->
	<aside
		class={cn(
			"hidden md:flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300 ease-in-out sticky top-0 h-screen shrink-0 z-30 overflow-hidden select-none",
			sidebarCollapsed ? "w-16" : "w-64"
		)}
	>
		<!-- Brand Header inside Sidebar -->
		<div class={cn("h-16 flex items-center border-b border-slate-100 shrink-0 transition-all duration-300", sidebarCollapsed ? "justify-center px-0" : "px-4")}>
			<a href="/" class="flex items-center gap-3 overflow-hidden group">
				<div class="w-9 h-9 rounded-xl bg-mint-500 flex items-center justify-center text-white text-lg shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105">
					💊
				</div>
				{#if !sidebarCollapsed}
					<div class="truncate">
						<h1 class="text-sm font-extrabold text-slate-900 leading-tight tracking-tight">Sistem Apotek</h1>
						<p class="text-[10px] font-medium text-slate-400 truncate">Manajemen Operasional</p>
					</div>
				{/if}
			</a>
		</div>

		<!-- Navigation Menu -->
		<nav class="p-3 space-y-3 overflow-y-auto flex-1 scrollbar-none">
			<!-- Dashboard -->
			<div>
				<a
					href={standaloneTop.href}
					class={cn(
						"flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative group",
						isActive(standaloneTop.href)
							? "bg-mint-50 text-mint-700 shadow-2xs font-bold"
							: "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900"
					)}
					title={sidebarCollapsed ? standaloneTop.label : undefined}
				>
					{#if isActive(standaloneTop.href)}
						<span class="absolute left-0 top-2 bottom-2 w-1 bg-mint-500 rounded-r-full"></span>
					{/if}
					<standaloneTop.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(standaloneTop.href) ? "text-mint-600" : "text-slate-400 group-hover:text-slate-600")} />
					{#if !sidebarCollapsed}
						<span class="truncate">{standaloneTop.label}</span>
					{/if}
				</a>
			</div>

			<!-- Nav Groups -->
			{#each navGroups as group}
				<div class="pt-2 border-t border-slate-100/80">
					{#if !sidebarCollapsed}
						<!-- Group Title Header -->
						<button
							type="button"
							onclick={() => toggleGroup(group.id)}
							class="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer rounded-md group"
						>
							<div class="flex items-center gap-2">
								<group.icon class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
								<span>{group.title}</span>
							</div>
							<ChevronDown
								class={cn(
									"w-3 h-3 transition-transform duration-200 text-slate-400",
									groupOpenStates[group.id] ? "rotate-0" : "-rotate-90"
								)}
							/>
						</button>
					{/if}

					{#if sidebarCollapsed}
						<!-- Collapsed Item Icons -->
						<div class="space-y-1 mt-1">
							{#each group.items as item}
								<a
									href={item.href}
									class={cn(
										"flex items-center justify-center p-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative group",
										isActive(item.href) ? "bg-mint-50 text-mint-700 shadow-2xs font-bold" : "hover:bg-slate-100/80 text-slate-600"
									)}
									title={item.label}
								>
									{#if isActive(item.href)}
										<span class="absolute left-0 top-2 bottom-2 w-1 bg-mint-500 rounded-r-full"></span>
									{/if}
									<item.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(item.href) ? "text-mint-600" : "text-slate-400 group-hover:text-slate-600")} />
								</a>
							{/each}
						</div>
					{:else if groupOpenStates[group.id]}
						<!-- Expanded Menu List -->
						<div transition:slide={{ duration: 180 }} class="space-y-0.5 mt-1 overflow-hidden">
							{#each group.items as item}
								<a
									href={item.href}
									class={cn(
										"flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 relative group",
										isActive(item.href)
											? "bg-mint-50 text-mint-700 shadow-2xs font-bold"
											: "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900"
									)}
								>
									{#if isActive(item.href)}
										<span class="absolute left-0 top-2 bottom-2 w-1 bg-mint-500 rounded-r-full"></span>
									{/if}
									<item.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(item.href) ? "text-mint-600" : "text-slate-400 group-hover:text-slate-600")} />
									<span class="truncate">{item.label}</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			<!-- Laporan -->
			<div class="pt-2 border-t border-slate-100/80">
				<a
					href={standaloneBottom.href}
					class={cn(
						"flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 relative group",
						isActive(standaloneBottom.href)
							? "bg-mint-50 text-mint-700 shadow-2xs font-bold"
							: "hover:bg-slate-100/80 text-slate-600 hover:text-slate-900"
					)}
					title={sidebarCollapsed ? standaloneBottom.label : undefined}
				>
					{#if isActive(standaloneBottom.href)}
						<span class="absolute left-0 top-2 bottom-2 w-1 bg-mint-500 rounded-r-full"></span>
					{/if}
					<standaloneBottom.icon class={cn("w-4 h-4 shrink-0 transition-colors duration-150", isActive(standaloneBottom.href) ? "text-mint-600" : "text-slate-400 group-hover:text-slate-600")} />
					{#if !sidebarCollapsed}
						<span class="truncate">{standaloneBottom.label}</span>
					{/if}
				</a>
			</div>
		</nav>

		<!-- Sidebar Bottom Footer & Collapse Toggle Button -->
		<div class="p-3 border-t border-slate-100 shrink-0 flex items-center justify-end">
			<button
				onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
				class={cn(
					"p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0",
					sidebarCollapsed && "mx-auto"
				)}
				aria-label="Toggle Sidebar"
				title={sidebarCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
			>
				{#if sidebarCollapsed}
					<PanelLeftOpen class="w-4 h-4" />
				{:else}
					<PanelLeftClose class="w-4 h-4" />
				{/if}
			</button>
		</div>
	</aside>

	<!-- Main Wrapper -->
	<div class="flex-1 flex flex-col min-w-0">
		<!-- Content Area Top Bar (Breadcrumbs + Quick Search) -->
		<header class="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between gap-4">
			<!-- Mobile Brand (shown only on mobile screens) -->
			<div class="flex items-center gap-2 md:hidden">
				<div class="w-7 h-7 rounded-lg bg-mint-500 flex items-center justify-center text-white text-sm">
					💊
				</div>
				<span class="text-xs font-bold text-slate-900">Sistem Apotek</span>
			</div>

			<!-- Desktop Breadcrumb -->
			<div class="hidden md:flex items-center">
				<Breadcrumb />
			</div>

			<!-- Quick Search Trigger -->
			<button
				onclick={() => (commandPaletteOpen = true)}
				class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/60 text-slate-500 text-xs transition-all duration-200 hover:shadow-2xs cursor-pointer ml-auto md:ml-0"
			>
				<Search class="w-3.5 h-3.5 text-slate-400" />
				<span class="hidden sm:inline font-medium">Cari modul...</span>
				<kbd class="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-slate-400 shadow-2xs">Ctrl+K</kbd>
			</button>
		</header>

		<!-- Main Content Page -->
		<main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-8">
			{@render children()}
		</main>
	</div>

	<!-- Mobile Bottom Navigation Bar -->
	<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
		{#each mobileMainTabs as tab}
			<a
				href={tab.href}
				class={cn(
					"flex flex-col items-center justify-center py-1 px-3 rounded-xl text-xs font-medium transition-all duration-150",
					isActive(tab.href) ? "text-mint-600 font-bold scale-105" : "text-slate-500 hover:text-slate-700"
				)}
			>
				<tab.icon class="w-5 h-5 mb-0.5" />
				<span class="text-[10px]">{tab.label}</span>
			</a>
		{/each}

		<button
			onclick={() => (moreMenuOpen = true)}
			class="flex flex-col items-center justify-center py-1 px-3 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 transition-all duration-150 cursor-pointer"
		>
			<MoreHorizontal class="w-5 h-5 mb-0.5" />
			<span class="text-[10px]">Lainnya</span>
		</button>
	</nav>

	<!-- Mobile "More" Menu Sheet -->
	<Sheet bind:open={moreMenuOpen} title="Menu Lainnya" side="bottom">
		<div class="space-y-4 py-2">
			{#each navGroups as group}
				{#if group.items.some((item) => !mobileMainHrefs.has(item.href))}
					<div>
						<h4 class="text-[11px] font-bold text-slate-400 mb-2 px-1 flex items-center gap-1.5">
							<group.icon class="w-3.5 h-3.5" />
							{group.title}
						</h4>
						<div class="grid grid-cols-2 gap-2">
							{#each group.items.filter((item) => !mobileMainHrefs.has(item.href)) as item}
								<a
									href={item.href}
									onclick={() => (moreMenuOpen = false)}
									class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-mint-50 hover:border-mint-200 text-slate-700 hover:text-mint-900 transition-all duration-150"
								>
									<div class="p-2 rounded-lg bg-white shadow-2xs text-mint-600">
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
