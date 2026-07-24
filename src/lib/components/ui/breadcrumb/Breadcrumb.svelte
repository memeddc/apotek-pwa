<script lang="ts">
	import { page } from '$app/state';
	import { ChevronRight, Home } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { class: className = '' }: { class?: string } = $props();

	const routeNames: Record<string, string> = {
		'': 'Dashboard',
		'penjualan': 'Penjualan (POS)',
		'cetak_nota': 'Cetak Nota',
		'mutasi': 'Mutasi',
		'faktur': 'Faktur Pembelian',
		'history': 'Riwayat',
		'stok': 'Kartu Stok',
		'rubah_harga': 'Penyesuaian Harga',
		'resep': 'Resep Dokter',
		'jenisobat': 'Jenis Obat',
		'obat': 'Master Obat',
		'pbf': 'Master PBF / Supplier'
	};

	let segments = $derived.by(() => {
		const path = page.url.pathname.split('/').filter(Boolean);
		return path.map((seg, idx) => {
			const href = '/' + path.slice(0, idx + 1).join('/');
			const name = routeNames[seg] || seg;
			return { name, href };
		});
	});
</script>

<nav aria-label="Breadcrumb" class={cn("flex items-center space-x-1 text-xs text-slate-500", className)}>
	<a href="/" class="flex items-center hover:text-teal-600 transition-colors">
		<Home class="w-3.5 h-3.5 mr-1" />
		<span>Home</span>
	</a>

	{#each segments as seg}
		<ChevronRight class="w-3.5 h-3.5 text-slate-400 shrink-0" />
		<a href={seg.href} class="hover:text-teal-600 transition-colors font-medium text-slate-700">
			{seg.name}
		</a>
	{/each}
</nav>
