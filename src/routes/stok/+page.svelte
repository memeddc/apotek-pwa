<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat, Istok } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Package, Search, RotateCcw, Calendar, AlertTriangle } from 'lucide-svelte';

	type StokRow = Istok & { obat_nama: string; jenis_id: string };

	let rows = $state<StokRow[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);
	let errorMessage = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;

	function rupiah(value: number): string { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value || 0); }
	function formatTanggal(value: string): string { return value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'; }

	async function loadMedicineMap(ids: string[]): Promise<Map<string, Iobat>> {
		if (ids.length === 0) return new Map();
		const { data, error } = await supabase.from('obat').select('obat_id, obat_nama, jenis_id').in('obat_id', ids);
		if (error) throw new Error(error.message);
		return new Map((data ?? []).map((obat) => [obat.obat_id, obat as Iobat]));
	}

	async function loadStok() {
		loading = true;
		errorMessage = '';
		try {
			const query = searchQuery.trim();
			let stok: Istok[] = [];
			if (query.length >= 2) {
				const safe = query.replace(/[,%_]/g, '');
				const { data: obat, error: obatError } = await supabase.from('obat').select('obat_id, obat_nama, jenis_id').or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`).limit(100);
				if (obatError) throw new Error(obatError.message);
				if (!obat || obat.length === 0) { rows = []; loading = false; return; }
				const { data, error } = await supabase.from('stok').select('*').in('obat_id', obat.map((item) => item.obat_id)).order('obat_id').limit(100);
				if (error) throw new Error(error.message);
				const obatMap = new Map(obat.map((item) => [item.obat_id, item]));
				stok = (data ?? []).map((item) => ({ ...item, obat_nama: obatMap.get(item.obat_id)?.obat_nama ?? item.obat_id, jenis_id: obatMap.get(item.obat_id)?.jenis_id ?? '-' }));
				rows = stok as StokRow[];
			} else {
				const { data, error } = await supabase.from('stok').select('*').order('obat_id').limit(100);
				if (error) throw new Error(error.message);
				stok = data ?? [];
				const obatMap = await loadMedicineMap(stok.map((item) => item.obat_id));
				rows = stok.map((item) => ({ ...item, obat_nama: obatMap.get(item.obat_id)?.obat_nama ?? item.obat_id, jenis_id: obatMap.get(item.obat_id)?.jenis_id ?? '-' }));
			}
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat stok.';
			toast.error(errorMessage);
		}
		loading = false;
	}

	function handleSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(loadStok, 300);
	}

	onMount(loadStok);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<Package class="w-6 h-6 text-teal-600" />
				Stok Obat
			</h2>
			<p class="text-xs text-slate-500 mt-1">Status ketersediaan persediaan obat saat ini</p>
		</div>

		<Button variant="outline" size="sm" onclick={loadStok} disabled={loading}>
			<RotateCcw class="w-3.5 h-3.5 mr-1.5" /> Muat Ulang
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div class="relative w-full max-w-sm">
			<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
			<Input
				type="search"
				bind:value={searchQuery}
				oninput={handleSearch}
				placeholder="Cari nama atau kode obat..."
				class="pl-9"
			/>
		</div>

		<div class="text-xs text-slate-400">
			{searchQuery.trim().length >= 2 ? 'Hasil pencarian obat' : 'Menampilkan 100 stok terbanyak'}
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>Nama Obat</TableHead>
				<TableHead>Jenis</TableHead>
				<TableHead class="text-center">Jumlah Stok</TableHead>
				<TableHead>Tgl. Kedaluwarsa</TableHead>
				<TableHead class="text-right">Harga PBF</TableHead>
				<TableHead class="text-right">Harga Jual</TableHead>
				<TableHead class="text-center">Status Disc</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#if loading}
				{#each Array(6) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20" /></TableCell>
						<TableCell><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-24" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16 mx-auto" /></TableCell>
					</TableRow>
				{/each}
			{:else if rows.length === 0}
				<TableRow>
					<TableCell colspan={7} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada stok obat yang ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each rows as row}
					<TableRow>
						<TableCell class="font-semibold text-slate-900 text-xs">
							{row.obat_nama}
							<span class="block text-[10px] font-mono text-purple-700">{row.obat_id}</span>
						</TableCell>
						<TableCell class="text-xs text-slate-600">
							<Badge variant="outline" class="text-[11px] font-normal">{row.jenis_id}</Badge>
						</TableCell>
						<TableCell class="text-center font-bold text-xs">
							{#if row.qty <= 0}
								<span class="text-red-600 font-extrabold flex items-center justify-center gap-1">
									<AlertTriangle class="w-3 h-3 shrink-0" /> {rupiah(row.qty)}
								</span>
							{:else}
								<span class="text-emerald-700">{rupiah(row.qty)}</span>
							{/if}
						</TableCell>
						<TableCell class="text-xs text-slate-600">
							<span class="flex items-center gap-1">
								<Calendar class="w-3 h-3 text-slate-400 shrink-0" /> {formatTanggal(row.expired_date)}
							</span>
						</TableCell>
						<TableCell class="text-right text-xs text-slate-600">Rp {rupiah(row.harga_pbf)}</TableCell>
						<TableCell class="text-right text-xs font-bold text-teal-700">Rp {rupiah(row.harga_jual)}</TableCell>
						<TableCell class="text-center">
							{#if row.diberikan === 1}
								<Badge variant="success" class="text-[10px]">Diberikan</Badge>
							{:else}
								<Badge variant="secondary" class="text-[10px]">Tidak</Badge>
							{/if}
						</TableCell>
					</TableRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
</div>
