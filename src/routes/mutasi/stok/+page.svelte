<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ikartu_stok, Iobat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PageHeader } from '$lib/components/ui/page-header';
	import { DataToolbar } from '$lib/components/ui/data-toolbar';
	import { Pagination } from '$lib/components/ui/pagination';
	import { History, Search, RotateCcw, X, ArrowUpRight, ArrowDownRight, RefreshCw, Building2, SearchX } from 'lucide-svelte';

	type KartuRow = Ikartu_stok & { obat_nama: string; pbf_nama?: string };
	let rows = $state<KartuRow[]>([]);
	let obatResults = $state<Iobat[]>([]);
	let selectedObat = $state<Iobat | null>(null);
	let obatSearch = $state('');
	let loading = $state(true);
	let searchLoading = $state(false);
	let errorMessage = $state('');
	let limit = $state(500);

	// Pagination states
	let currentPage = $state(1);
	let pageSize = $state(25);

	let pagedRows = $derived(
		rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	let searchTimer: ReturnType<typeof setTimeout>;
	let searchRequest = 0;

	function formatJumlah(value: number): string {
		return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, signDisplay: 'always' }).format(value);
	}
	function formatWaktu(value: string): string {
		if (!value) return '-';
		const d = new Date(value);
		if (isNaN(d.getTime())) return value;
		return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
	}
	function jenisMutasi(row: Ikartu_stok): 'Masuk' | 'Keluar' | 'Stok Opname' {
		if (/^(SO|O)/i.test(row.trans_id)) return 'Stok Opname';
		return row.qty >= 0 ? 'Masuk' : 'Keluar';
	}

	async function searchObat() {
		const query = obatSearch.trim();
		selectedObat = null;
		if (query.length < 2) {
			obatResults = [];
			searchLoading = false;
			return;
		}
		const request = ++searchRequest;
		searchLoading = true;
		const safe = query.replace(/[,%_]/g, '');
		const { data, error } = await supabase
			.from('obat')
			.select('obat_id, obat_nama, jenis_id')
			.or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`)
			.order('obat_nama')
			.limit(20);
		if (request !== searchRequest) return;
		searchLoading = false;
		if (error) {
			errorMessage = error.message;
			toast.error(errorMessage);
			return;
		}
		obatResults = (data ?? []) as Iobat[];
	}

	function handleSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(searchObat, 300);
	}

	function pilihObat(obat: Iobat) {
		selectedObat = obat;
		obatSearch = obat.obat_nama;
		obatResults = [];
		loadKartu();
	}

	async function medicineMap(ids: string[]): Promise<Map<string, string>> {
		if (!ids.length) return new Map();
		const { data, error } = await supabase.from('obat').select('obat_id, obat_nama').in('obat_id', ids);
		if (error) throw new Error(error.message);
		return new Map((data ?? []).map((item) => [item.obat_id, item.obat_nama]));
	}

	async function loadPbfMap(transIds: string[]): Promise<Map<string, string>> {
		if (!transIds.length) return new Map();
		const uniqueIds = [...new Set(transIds)];
		const { data, error } = await supabase
			.from('purchase')
			.select('trans_id, pbf(pbf_nama)')
			.in('trans_id', uniqueIds);

		if (error) return new Map();
		const map = new Map<string, string>();
		(data ?? []).forEach((p: any) => {
			if (p.trans_id && p.pbf?.pbf_nama) {
				map.set(p.trans_id, p.pbf.pbf_nama);
			}
		});
		return map;
	}

	async function loadKartu() {
		loading = true;
		errorMessage = '';
		try {
			let query = supabase.from('kartu_stok').select('*').order('tanggal_waktu', { ascending: false }).limit(limit);
			if (selectedObat) query = query.eq('obat_id', selectedObat.obat_id);
			const { data, error } = await query;
			if (error) throw new Error(error.message);
			const kartu = (data ?? []) as Ikartu_stok[];

			const names = await medicineMap(kartu.map((item) => item.obat_id));

			const incomingTransIds = kartu
				.filter((item) => item.qty > 0 || !/^(J|SO|O)/i.test(item.trans_id))
				.map((item) => item.trans_id);

			const pbfs = await loadPbfMap(incomingTransIds);

			rows = kartu.map((item) => ({
				...item,
				obat_nama: names.get(item.obat_id) ?? item.obat_id,
				pbf_nama: pbfs.get(item.trans_id)
			}));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Gagal memuat kartu stok.';
			toast.error(errorMessage);
		}
		loading = false;
		currentPage = 1;
	}

	function clearObat() {
		selectedObat = null;
		obatSearch = '';
		obatResults = [];
		loadKartu();
	}

	onMount(loadKartu);
</script>

<div class="space-y-4">
	<!-- Page Header -->
	<PageHeader
		title="Kartu Stok"
		description="Audit trail riwayat mutasi stok obat (masuk, keluar, & opname)"
		badge={`${rows.length} Mutasi`}
	>
		{#snippet actions()}
			<Button variant="outline" size="sm" onclick={loadKartu} disabled={loading} class="rounded-xl border-slate-200 cursor-pointer text-xs">
				<RotateCcw class="w-3.5 h-3.5 mr-1.5" /> Muat Ulang
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Data Toolbar -->
	<DataToolbar
		searchPlaceholder="Filter berdasarkan nama / kode obat..."
		bind:searchValue={obatSearch}
		onSearchInput={handleSearchInput}
		totalItems={rows.length}
		filteredCount={rows.length}
		itemLabel="mutasi"
	>
		{#snippet filters()}
			{#if selectedObat}
				<Button variant="ghost" size="sm" onclick={clearObat} class="h-9 text-xs text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer">
					<X class="w-3.5 h-3.5 mr-1" /> Reset Filter ({selectedObat.obat_nama})
				</Button>
			{/if}
		{/snippet}
	</DataToolbar>

	<!-- Data Table Container -->
	<div class="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
		<Table class="table-compact table-striped">
			<TableHeader class="bg-slate-50/80 border-b border-slate-200/80">
				<TableRow class="hover:bg-transparent">
					<TableHead class="w-44 font-semibold text-slate-700">Waktu</TableHead>
					<TableHead class="font-semibold text-slate-700">Nama Obat</TableHead>
					<TableHead class="text-center font-semibold text-slate-700">Jenis Mutasi</TableHead>
					<TableHead class="text-center font-semibold text-slate-700">Jumlah Mutasi</TableHead>
					<TableHead class="font-semibold text-slate-700">No. Referensi / Supplier PBF</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
			{#if loading}
				{#each Array(6) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-28" /></TableCell>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-36" /></TableCell>
					</TableRow>
				{/each}
			{:else if rows.length === 0}
				<TableRow>
					<TableCell colspan={5} class="text-center py-12 text-slate-400">
						<div class="flex flex-col items-center justify-center gap-2">
							<SearchX class="w-8 h-8 text-slate-300" />
							<p class="text-xs font-semibold text-slate-600">Belum ada riwayat mutasi kartu stok</p>
							<p class="text-[11px] text-slate-400">Pilih obat di atas untuk melihat audit trail riwayat mutasi spesifik.</p>
						</div>
					</TableCell>
				</TableRow>
			{:else}
				{#each pagedRows as row}
					{@const isMasuk = jenisMutasi(row) === 'Masuk'}
					<TableRow class="transition-colors">
						<!-- Waktu -->
						<TableCell class="text-xs text-slate-600 font-medium">
							{formatWaktu(row.tanggal_waktu)}
						</TableCell>

						<!-- Nama Obat -->
						<TableCell class="font-medium text-slate-800 text-xs">
							<span class="font-semibold text-slate-900">{row.obat_nama}</span>
							<span class="block text-[10px] font-mono text-purple-700">{row.obat_id}</span>
						</TableCell>

						<!-- Jenis Mutasi -->
						<TableCell class="text-center">
							{#if isMasuk}
								<Badge variant="success" class="text-[10px] inline-flex items-center gap-1">
									<ArrowDownRight class="w-3 h-3" /> Masuk
								</Badge>
							{:else if jenisMutasi(row) === 'Keluar'}
								<Badge variant="destructive" class="text-[10px] inline-flex items-center gap-1">
									<ArrowUpRight class="w-3 h-3" /> Keluar
								</Badge>
							{:else}
								<Badge variant="warning" class="text-[10px] inline-flex items-center gap-1">
									<RefreshCw class="w-3 h-3" /> Opname
								</Badge>
							{/if}
						</TableCell>

						<!-- Jumlah Mutasi -->
						<TableCell class="text-center font-bold text-xs">
							{#if row.qty > 0}
								<span class="text-emerald-700">{formatJumlah(row.qty)}</span>
							{:else if row.qty < 0}
								<span class="text-red-600">{formatJumlah(row.qty)}</span>
							{:else}
								<span class="text-slate-500">0</span>
							{/if}
						</TableCell>

						<!-- No. Referensi & PBF Supplier -->
						<TableCell>
							<div class="flex flex-col gap-1">
								<Badge variant="secondary" class="font-mono text-xs text-slate-700 bg-slate-100 w-fit">{row.trans_id}</Badge>

								{#if isMasuk && row.pbf_nama}
									<span class="inline-flex items-center gap-1 text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-100 w-fit">
										<Building2 class="w-3 h-3 text-purple-600" /> {row.pbf_nama}
									</span>
								{/if}
							</div>
						</TableCell>
					</TableRow>
				{/each}
			{/if}
		</TableBody>
	</Table>

	<!-- Pagination Footer -->
	{#if !loading && rows.length > 0}
		<Pagination
			currentPage={currentPage}
			totalItems={rows.length}
			pageSize={pageSize}
			onPageChange={(page) => (currentPage = page)}
			onPageSizeChange={(size) => {
				pageSize = size;
				currentPage = 1;
			}}
		/>
	{/if}
</div>
</div>
