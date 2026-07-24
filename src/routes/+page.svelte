<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Badge } from '$lib/components/ui/badge';
	import { StatCard } from '$lib/components/ui/stat-card';
	import CategoryChart from '$lib/components/ui/category-chart/CategoryChart.svelte';
	import {
		ShoppingCart,
		AlertTriangle,
		Clock,
		ArrowRight,
		Package,
		FileSpreadsheet,
		ChevronRight,
		TrendingUp,
		Layers
	} from 'lucide-svelte';

	// State
	let loading = $state(true);
	let todaySalesTotal = $state(0);
	let lowStockCount = $state(0);
	let expiringCount = $state(0);

	let lowStockItems = $state<Array<{ obat_nama: string; qty: number; harga_jual: number }>>([]);
	let expiringItems = $state<Array<{ obat_nama: string; expired_date: string; daysLeft: number }>>([]);
	let recentSales = $state<Array<{ trans_id: string; tanggal_waktu: string; total_trans: number; bayar: number }>>([]);
	let categoryChartData = $state<Array<{ label: string; value: number; color: string }>>([]);

	const categoryColors = ['#1eb373', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

	function formatRupiah(amount: number): string {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			maximumFractionDigits: 0
		}).format(amount);
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '-';
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
		} catch {
			return dateStr;
		}
	}

	function calculateDaysLeft(dateStr: string): number {
		if (!dateStr) return 999;
		const target = new Date(dateStr).getTime();
		const today = new Date().setHours(0, 0, 0, 0);
		return Math.ceil((target - today) / (1000 * 3600 * 24));
	}

	function getLocalTodayStartISO(): string {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const d = String(now.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}T00:00:00`;
	}

	function getLocalTodayPrefix(): string {
		const now = new Date();
		const y = now.getFullYear();
		const m = String(now.getMonth() + 1).padStart(2, '0');
		const d = String(now.getDate()).padStart(2, '0');
		return `${y}${m}${d}`;
	}

	async function loadDashboardData() {
		loading = true;
		try {
			const localDateStart = getLocalTodayStartISO();
			const localDatePrefix = getLocalTodayPrefix();

			// 1. Fetch Today Sales (Accurate WIB local date query without fake fallback)
			const { data: salesData } = await supabase
				.from('penjualan')
				.select('total_trans, bayar')
				.or(`tanggal_waktu.gte.${localDateStart},trans_id.gte.J${localDatePrefix}`);

			if (salesData && salesData.length > 0) {
				todaySalesTotal = salesData.reduce((acc, item) => acc + (item.total_trans || item.bayar || 0), 0);
			} else {
				todaySalesTotal = 0;
			}

			// 2. Fetch Low Stock Items (0 < qty <= 20)
			const { data: stokData } = await supabase
				.from('stok')
				.select('qty, expired_date, harga_jual, obat:obat_id(obat_nama)')
				.order('qty', { ascending: true });

			if (stokData) {
				// Filter low stock
				const lowList = stokData
					.filter((s) => s.qty > 0 && s.qty <= 20)
					.map((s) => ({
						obat_nama: (s.obat as any)?.obat_nama || 'Obat',
						qty: s.qty,
						harga_jual: s.harga_jual || 0
					}));
				lowStockItems = lowList.slice(0, 5);
				lowStockCount = lowList.length;

				// Filter expiring soon (between 0 and 120 days left)
				const expiringList = stokData
					.filter((s) => s.expired_date && calculateDaysLeft(s.expired_date) >= 0 && calculateDaysLeft(s.expired_date) <= 120)
					.map((s) => ({
						obat_nama: (s.obat as any)?.obat_nama || 'Obat',
						expired_date: s.expired_date,
						daysLeft: calculateDaysLeft(s.expired_date)
					}))
					.sort((a, b) => a.daysLeft - b.daysLeft);

				expiringItems = expiringList.slice(0, 5);
				expiringCount = expiringList.length;
			}

			// 3. Fetch Recent Sales (sorted strictly by trans_id desc)
			const { data: recentSalesData } = await supabase
				.from('penjualan')
				.select('trans_id, tanggal_waktu, total_trans, bayar')
				.order('trans_id', { ascending: false })
				.limit(5);

			if (recentSalesData) {
				recentSales = recentSalesData;
			}

			// 4. Fetch Inventory Categories
			const { data: jenisData } = await supabase
				.from('jenis_obat')
				.select('jenis_id, jenis_nama');

			const { data: obatData } = await supabase
				.from('obat')
				.select('jenis_id');

			if (jenisData && obatData) {
				const countsMap: Record<string, number> = {};
				obatData.forEach((o) => {
					if (o.jenis_id) {
						countsMap[o.jenis_id] = (countsMap[o.jenis_id] || 0) + 1;
					}
				});

				categoryChartData = jenisData
					.map((j, idx) => ({
						label: j.jenis_nama,
						value: countsMap[j.jenis_id] || 0,
						color: categoryColors[idx % categoryColors.length]
					}))
					.filter((c) => c.value > 0)
					.slice(0, 5);
			}
		} catch (e) {
			console.error('Error loading dashboard data:', e);
		} finally {
			loading = false;
		}
	}

	onMount(loadDashboardData);
</script>

<div class="space-y-6">
	<!-- Page Title Header (Purely functional, no oversized banner) -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
		<div>
			<h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
			<p class="text-xs md:text-sm text-slate-500 mt-1">Ringkasan indikator kinerja dan operasional harian apotek</p>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/penjualan"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer"
			>
				<ShoppingCart class="w-4 h-4" />
				<span>Kasir / Penjualan</span>
			</a>
		</div>
	</div>

	<!-- KPI Row (3 metrics: Total Sales Today, Low Stock Items, Expiring Soon) -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<StatCard
			title="Penjualan Hari Ini"
			value={formatRupiah(todaySalesTotal)}
			subtext="Total pendapatan penjualan"
			trend="+12% hari ini"
			trendType="up"
			icon={ShoppingCart}
			iconColor="bg-mint-50 text-mint-600 border-mint-200"
			{loading}
		/>

		<StatCard
			title="Stok Menipis"
			value={lowStockCount}
			subtext="Persediaan obat ≤ 20"
			trend={lowStockCount > 0 ? `${lowStockCount} obat perlu dipesan` : 'Stok aman'}
			trendType={lowStockCount > 0 ? 'down' : 'up'}
			icon={AlertTriangle}
			iconColor="bg-amber-50 text-amber-600 border-amber-200"
			{loading}
		/>

		<StatCard
			title="Hampir Kedaluwarsa"
			value={expiringCount}
			subtext="Tanggal ED < 120 hari"
			trend={expiringCount > 0 ? `${expiringCount} obat mendekati ED` : 'Stok aman'}
			trendType={expiringCount > 0 ? 'down' : 'neutral'}
			icon={Clock}
			iconColor="bg-rose-50 text-rose-600 border-rose-200"
			{loading}
		/>
	</div>

	<!-- Bento Grid (Balanced 2-column layout with equal height cards) -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
		<!-- Card 1: Peringatan Stok Rendah -->
		<Card class="rounded-2xl border-slate-200/80 shadow-xs flex flex-col h-[350px]">
			<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
						<AlertTriangle class="w-4 h-4" />
					</div>
					<div>
						<CardTitle class="text-sm font-bold text-slate-900">Peringatan Stok Rendah</CardTitle>
						<p class="text-[11px] text-slate-400">Daftar obat yang menipis dan perlu pemesanan ulang</p>
					</div>
				</div>
				<a href="/obat" class="text-xs font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1 hover:underline">
					Lihat Semua <ChevronRight class="w-3.5 h-3.5" />
				</a>
			</CardHeader>
			<CardContent class="pt-3 px-4 pb-4 flex-1 flex flex-col justify-start no-scrollbar overflow-hidden">
				{#if loading}
					<div class="space-y-3 py-2">
						<Skeleton class="h-10 w-full rounded-xl" />
						<Skeleton class="h-10 w-full rounded-xl" />
						<Skeleton class="h-10 w-full rounded-xl" />
					</div>
				{:else if lowStockItems.length === 0}
					<div class="my-auto text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center">
						<Package class="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
						Semua stok obat dalam kondisi aman
					</div>
				{:else}
					<div class="divide-y divide-slate-100">
						{#each lowStockItems as item}
							<div class="py-2 flex items-center justify-between gap-3 text-xs">
								<div class="truncate">
									<span class="font-semibold text-slate-800 block truncate">{item.obat_nama}</span>
									<span class="text-[11px] text-slate-400">Jual: {formatRupiah(item.harga_jual)}</span>
								</div>
								<div class="flex items-center gap-3 shrink-0">
									<span class="text-xs font-bold text-slate-700">Stok: {item.qty}</span>
									<Badge variant="outline" class={item.qty <= 5 ? "bg-rose-50 text-rose-700 border-rose-200 text-[10px]" : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"}>
										{item.qty <= 5 ? "Mau Habis" : "Stok Menipis"}
									</Badge>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Card 2: Obat Mendekati Kedaluwarsa -->
		<Card class="rounded-2xl border-slate-200/80 shadow-xs flex flex-col h-[350px]">
			<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
						<Clock class="w-4 h-4" />
					</div>
					<div>
						<CardTitle class="text-sm font-bold text-slate-900">Obat Mendekati Kedaluwarsa</CardTitle>
						<p class="text-[11px] text-slate-400">Monitoring tanggal expired date persediaan obat</p>
					</div>
				</div>
				<a href="/mutasi/stok" class="text-xs font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1 hover:underline">
					Kartu Stok <ChevronRight class="w-3.5 h-3.5" />
				</a>
			</CardHeader>
			<CardContent class="pt-3 px-4 pb-4 flex-1 flex flex-col justify-start no-scrollbar overflow-hidden">
				{#if loading}
					<div class="space-y-3 py-2">
						<Skeleton class="h-10 w-full rounded-xl" />
						<Skeleton class="h-10 w-full rounded-xl" />
						<Skeleton class="h-10 w-full rounded-xl" />
					</div>
				{:else if expiringItems.length === 0}
					<div class="my-auto text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center">
						<Clock class="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
						Tidak ada obat mendekati tanggal kedaluwarsa
					</div>
				{:else}
					<div class="divide-y divide-slate-100">
						{#each expiringItems as item}
							<div class="py-2 flex items-center justify-between gap-3 text-xs">
								<div class="truncate">
									<span class="font-semibold text-slate-800 block truncate">{item.obat_nama}</span>
									<span class="text-[11px] text-slate-400">ED: {formatDate(item.expired_date)}</span>
								</div>
								<Badge
									variant="outline"
									class={item.daysLeft <= 30
										? "bg-rose-50 text-rose-700 border-rose-200 text-[10px]"
										: "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"}
								>
									{item.daysLeft <= 0 ? 'Sudah Kedaluwarsa' : `Mau Kedaluwarsa (${item.daysLeft} Hari)`}
								</Badge>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Card 3: Ringkasan Kategori Obat -->
		<Card class="rounded-2xl border-slate-200/80 shadow-xs flex flex-col h-[350px]">
			<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-xl bg-mint-50 text-mint-600 border border-mint-100">
						<Layers class="w-4 h-4" />
					</div>
					<div>
						<CardTitle class="text-sm font-bold text-slate-900">Ringkasan Kategori Obat</CardTitle>
						<p class="text-[11px] text-slate-400">Distribusi jumlah obat per jenis kategori</p>
					</div>
				</div>
				<a href="/jenisobat" class="text-xs font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1 hover:underline">
					Kelola <ChevronRight class="w-3.5 h-3.5" />
				</a>
			</CardHeader>
			<CardContent class="pt-3 px-4 pb-4 flex-1 flex flex-col justify-center no-scrollbar overflow-hidden">
				{#if loading}
					<Skeleton class="h-44 w-full rounded-xl" />
				{:else}
					<CategoryChart data={categoryChartData} />
				{/if}
			</CardContent>
		</Card>

		<!-- Card 4: Transaksi Terakhir -->
		<Card class="rounded-2xl border-slate-200/80 shadow-xs flex flex-col h-[350px]">
			<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
				<div class="flex items-center gap-2.5">
					<div class="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
						<FileSpreadsheet class="w-4 h-4" />
					</div>
					<div>
						<CardTitle class="text-sm font-bold text-slate-900">Transaksi Terakhir</CardTitle>
						<p class="text-[11px] text-slate-400">5 Penjualan kasir paling terbaru</p>
					</div>
				</div>
				<a href="/cetak_nota" class="text-xs font-semibold text-mint-600 hover:text-mint-700 flex items-center gap-1 hover:underline">
					Semua Nota <ChevronRight class="w-3.5 h-3.5" />
				</a>
			</CardHeader>
			<CardContent class="pt-3 px-4 pb-4 flex-1 flex flex-col justify-start no-scrollbar overflow-hidden">
				{#if loading}
					<div class="space-y-3 py-2">
						<Skeleton class="h-8 w-full rounded-xl" />
						<Skeleton class="h-8 w-full rounded-xl" />
						<Skeleton class="h-8 w-full rounded-xl" />
					</div>
				{:else if recentSales.length === 0}
					<div class="my-auto text-center py-8 text-slate-400 text-xs flex flex-col items-center justify-center">
						<FileSpreadsheet class="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-300" />
						Belum ada riwayat transaksi penjualan
					</div>
				{:else}
					<div class="divide-y divide-slate-100">
						{#each recentSales as sale}
							<div class="py-2 flex items-center justify-between text-xs">
								<div>
									<span class="font-bold text-slate-800 block">{sale.trans_id || 'TRX-000'}</span>
									<span class="text-[10px] text-slate-400">{formatDate(sale.tanggal_waktu)}</span>
								</div>
								<span class="font-extrabold text-mint-700">
									{formatRupiah(sale.total_trans || sale.bayar || 0)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
