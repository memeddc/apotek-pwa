<script lang="ts">
	import { goto } from '$app/navigation';
	import { Search, LayoutDashboard, ShoppingCart, Receipt, FileSpreadsheet, Package, History, Tag, Pill, Building2, ClipboardList, DollarSign } from 'lucide-svelte';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let searchQuery = $state('');

	const navCommands = [
		{ name: 'Dashboard', href: '/', icon: LayoutDashboard, category: 'Navigasi' },
		{ name: 'Penjualan / POS', href: '/penjualan', icon: ShoppingCart, category: 'Transaksi' },
		{ name: 'Cetak Nota', href: '/cetak_nota', icon: Receipt, category: 'Transaksi' },
		{ name: 'Faktur Pembelian', href: '/faktur', icon: FileSpreadsheet, category: 'Transaksi' },
		{ name: 'Stok Obat', href: '/stok', icon: Package, category: 'Inventaris' },
		{ name: 'Kartu Stok', href: '/kartu_stok', icon: History, category: 'Inventaris' },
		{ name: 'Rubah Harga', href: '/rubah_harga', icon: DollarSign, category: 'Inventaris' },
		{ name: 'Resep Dokter', href: '/resep', icon: ClipboardList, category: 'Layanan' },
		{ name: 'Master Jenis Obat', href: '/jenisobat', icon: Tag, category: 'Data Master' },
		{ name: 'Master Obat', href: '/obat', icon: Pill, category: 'Data Master' },
		{ name: 'Master PBF / Supplier', href: '/pbf', icon: Building2, category: 'Data Master' }
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-200"
		onclick={() => (open = false)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden animate-in zoom-in-95 duration-200"
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
