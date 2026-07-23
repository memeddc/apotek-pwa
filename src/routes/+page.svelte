<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Stethoscope,
		Tag,
		Pill,
		Truck,
		FileSpreadsheet,
		Package,
		History,
		ShoppingCart,
		Printer,
		DollarSign,
		ArrowRight
	} from 'lucide-svelte';

	let counts = $state({ jenisobat: 0, obat: 0, pbf: 0, purchase: 0, resep: 0 });
	let loading = $state(true);

	async function loadCounts() {
		loading = true;
		try {
			const [jenisRes, obatRes, pbfRes, purchaseRes, resepRes] = await Promise.all([
				supabase.from('jenisobat').select('*', { count: 'exact', head: true }),
				supabase.from('obat').select('*', { count: 'exact', head: true }),
				supabase.from('pbf').select('*', { count: 'exact', head: true }),
				supabase.from('purchase').select('*', { count: 'exact', head: true }),
				supabase.from('resep').select('*', { count: 'exact', head: true })
			]);
			counts = {
				jenisobat: jenisRes.count ?? 0,
				obat: obatRes.count ?? 0,
				pbf: pbfRes.count ?? 0,
				purchase: purchaseRes.count ?? 0,
				resep: resepRes.count ?? 0
			};
		} catch (e) {
			console.error('Error loading counts:', e);
		}
		loading = false;
	}

	onMount(loadCounts);

	const cards = [
		{
			href: '/penjualan',
			title: 'Penjualan (POS)',
			desc: 'Kasir & transaksi penjualan obat langsung ke pasien',
			icon: ShoppingCart,
			color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
			badge: 'Kasir Main'
		},
		{
			href: '/resep',
			title: 'Resep Dokter',
			desc: 'Pencarian resep nama pasien dan pembuatan resep baru',
			icon: Stethoscope,
			color: 'bg-sky-50 text-sky-600 border-sky-100',
			countKey: 'resep' as const
		},
		{
			href: '/obat',
			title: 'Obat-obatan',
			desc: 'Kelola data master obat-obatan yang dijual di apotek',
			icon: Pill,
			color: 'bg-purple-50 text-purple-600 border-purple-100',
			countKey: 'obat' as const
		},
		{
			href: '/pbf',
			title: 'PBF / Supplier',
			desc: 'Kelola data Pedagang Besar Farmasi sebagai pemasok obat',
			icon: Truck,
			color: 'bg-amber-50 text-amber-600 border-amber-100',
			countKey: 'pbf' as const
		},
		{
			href: '/mutasi/faktur',
			title: 'Faktur Pembelian',
			desc: 'Catat penerimaan obat dari PBF dan perbarui stok otomatis',
			icon: FileSpreadsheet,
			color: 'bg-blue-50 text-blue-600 border-blue-100',
			countKey: 'purchase' as const
		},
		{
			href: '/stok',
			title: 'Stok Obat',
			desc: 'Lihat jumlah dan ketersediaan stok obat siap jual',
			icon: Package,
			color: 'bg-teal-50 text-teal-600 border-teal-100'
		},
		{
			href: '/mutasi/stok',
			title: 'Kartu Stok',
			desc: 'Audit trail riwayat mutasi obat (masuk, keluar, opname)',
			icon: History,
			color: 'bg-indigo-50 text-indigo-600 border-indigo-100'
		},
		{
			href: '/jenisobat',
			title: 'Jenis / Kategori',
			desc: 'Kelola kategori dan pengelompokan jenis obat',
			icon: Tag,
			color: 'bg-teal-50 text-teal-700 border-teal-100',
			countKey: 'jenisobat' as const
		},
		{
			href: '/cetak_nota',
			title: 'Cetak Nota',
			desc: 'Lihat dan cetak ulang nota bukti pembayaran transaksi',
			icon: Printer,
			color: 'bg-slate-100 text-slate-700 border-slate-200'
		},
		{
			href: '/rubah_harga',
			title: 'Penyesuaian Harga',
			desc: 'Pembaruan dan penyesuaian harga jual & modal PBF',
			icon: DollarSign,
			color: 'bg-amber-50 text-amber-700 border-amber-100'
		}
	];
</script>

<div class="space-y-6">
	<!-- Dashboard Header Banner -->
	<div class="bg-gradient-to-r from-teal-700 to-teal-900 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
		<div class="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
			<Pill class="w-64 h-64 text-white" />
		</div>
		<div class="relative z-10 max-w-xl space-y-2">
			<h2 class="text-2xl md:text-3xl font-bold tracking-tight">Selamat Datang di Apotek PWA</h2>
		</div>
	</div>

	<!-- Dashboard Cards Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each cards as card}
			<a href={card.href} class="block group cursor-pointer">
				<Card class="h-full border-slate-200 hover:border-teal-500 transition-all duration-200 group-hover:shadow-md">
					<CardHeader class="pb-3 flex flex-row items-start justify-between space-y-0">
						<div class="flex items-center gap-3">
							<div class={`w-11 h-11 rounded-xl border flex items-center justify-center ${card.color} shrink-0 transition-transform group-hover:scale-105`}>
								<card.icon class="w-5 h-5" />
							</div>
							<div>
								<CardTitle class="text-base group-hover:text-teal-700 transition-colors">{card.title}</CardTitle>
								{#if card.badge}
									<Badge variant="secondary" class="mt-1 text-[10px]">{card.badge}</Badge>
								{/if}
							</div>
						</div>
						<ArrowRight class="w-4 h-4 text-slate-300 group-hover:text-teal-600 transition-colors shrink-0" />
					</CardHeader>
					<CardContent>
						<CardDescription class="text-xs text-slate-500 leading-relaxed mb-3">
							{card.desc}
						</CardDescription>

						{#if card.countKey}
							<div class="pt-2 border-t border-slate-100 flex items-center justify-between">
								<span class="text-[11px] text-slate-400 font-medium">Total Item</span>
								{#if loading}
									<Skeleton class="h-5 w-12" />
								{:else}
									<span class="text-lg font-bold text-teal-700">{counts[card.countKey]}</span>
								{/if}
							</div>
						{/if}
					</CardContent>
				</Card>
			</a>
		{/each}
	</div>
</div>
