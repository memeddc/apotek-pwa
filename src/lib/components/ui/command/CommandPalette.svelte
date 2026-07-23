<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Search,
		LayoutDashboard,
		ShoppingCart,
		Stethoscope,
		Printer,
		FileSpreadsheet,
		History,
		Pill,
		Tag,
		Truck,
		BarChart3
	} from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let searchQuery = $state('');

	const navCommands = [
		{ name: 'Dashboard', href: '/', icon: LayoutDashboard, category: 'Navigasi' },
		{ name: 'Penjualan / POS', href: '/penjualan', icon: ShoppingCart, category: 'Transaksi' },
		{ name: 'Resep Dokter', href: '/resep', icon: Stethoscope, category: 'Transaksi' },
		{ name: 'Cetak Nota', href: '/cetak_nota', icon: Printer, category: 'Transaksi' },
		{ name: 'Faktur Pembelian', href: '/mutasi/faktur', icon: FileSpreadsheet, category: 'Mutasi' },
		{ name: 'Kartu Stok', href: '/mutasi/stok', icon: History, category: 'Mutasi' },
		{ name: 'Master Obat', href: '/obat', icon: Pill, category: 'Data Master' },
		{ name: 'Master Jenis Obat', href: '/jenisobat', icon: Tag, category: 'Data Master' },
		{ name: 'Master PBF / Supplier', href: '/pbf', icon: Truck, category: 'Data Master' },
		{ name: 'Laporan', href: '/laporan', icon: BarChart3, category: 'Laporan' }
	];

	let filtered = $derived(
		navCommands.filter((cmd) =>
			cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function navigate(href: string) {
		open = false;
		searchQuery = '';
		goto(href);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open = !open;
		} else if (e.key === 'Escape' && open) {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop with fade -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
		onclick={() => (open = false)}
	>
		<!-- Modal Content with scale -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			transition:scale={{ duration: 180, start: 0.96 }}
			class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center px-4 border-b border-slate-100">
				<Search class="w-4 h-4 text-slate-400 shrink-0 mr-2" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cari modul atau perintah... (Ctrl+K)"
					class="w-full py-3.5 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
				/>
				<kbd class="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">ESC</kbd>
			</div>

			<div class="max-h-80 overflow-y-auto p-2">
				{#if filtered.length === 0}
					<div class="p-8 text-center text-sm text-slate-400">
						Tidak ada hasil untuk "{searchQuery}"
					</div>
				{:else}
					<div class="space-y-1">
						{#each filtered as cmd}
							<button
								onclick={() => navigate(cmd.href)}
								class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-teal-50 hover:text-teal-900 transition-colors group cursor-pointer text-left"
							>
								<div class="flex items-center gap-3">
									<cmd.icon class="w-4 h-4 text-slate-400 group-hover:text-teal-600 shrink-0" />
									<span class="font-medium">{cmd.name}</span>
								</div>
								<span class="text-xs text-slate-400 group-hover:text-teal-700 bg-slate-100 group-hover:bg-teal-100 px-2 py-0.5 rounded">
									{cmd.category}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
