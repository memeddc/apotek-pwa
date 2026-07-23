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
	import { History, Search, RotateCcw, X, ArrowUpRight, ArrowDownRight, RefreshCw, Building2 } from 'lucide-svelte';

	type KartuRow = Ikartu_stok & { obat_nama: string; pbf_nama?: string };
	let rows = $state<KartuRow[]>([]);
	let obatResults = $state<Iobat[]>([]);
	let selectedObat = $state<Iobat | null>(null);
	let obatSearch = $state('');
	let loading = $state(true);
	let searchLoading = $state(false);
	let errorMessage = $state('');
	let limit = $state(100);
	let limitStr = $state('100');
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

			// Load PBF info for incoming transactions (qty > 0 or non-sales/non-opname IDs)
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
	}

	function clearObat() {
		selectedObat = null;
		obatSearch = '';
		obatResults = [];
		loadKartu();
	}

	onMount(loadKartu);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<History class="w-6 h-6 text-teal-600" />
				Kartu Stok
			</h2>
			<p class="text-xs text-slate-500 mt-1">Audit trail riwayat mutasi stok obat (masuk, keluar, & opname)</p>
		</div>

		<Button variant="outline" size="sm" onclick={loadKartu} disabled={loading}>
			<RotateCcw class="w-3.5 h-3.5 mr-1.5" /> Muat Ulang
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-3 flex-1">
			<div class="relative min-w-[240px] max-w-sm">
				<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
				<Input
					type="search"
					bind:value={obatSearch}
					oninput={handleSearchInput}
					placeholder="Filter berdasarkan nama / kode obat..."
					class="pl-9"
				/>

				{#if searchLoading}
					<div class="absolute left-0 right-0 top-full mt-1 bg-white p-2 rounded-lg border border-slate-200 shadow-lg text-xs text-slate-400 z-20">
						Mencari obat...
					</div>
				{:else if !selectedObat && obatResults.length > 0}
					<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto z-30 divide-y divide-slate-100">
						{#each obatResults as obat}
							<button
								type="button"
								onclick={() => pilihObat(obat)}
								class="w-full text-left p-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
							>
								<span class="font-semibold text-slate-900">{obat.obat_nama}</span>
								<Badge variant="secondary" class="text-[10px]">{obat.obat_id}</Badge>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<Select
				bind:value={limitStr}
				onValueChange={(val) => {
					limit = Number(val);
					loadKartu();
				}}
				options={[
					{ value: '100', label: '100 Riwayat' },
					{ value: '250', label: '250 Riwayat' },
					{ value: '500', label: '500 Riwayat' }
				]}
				class="w-36"
			/>

			{#if selectedObat}
				<Button variant="ghost" size="sm" onclick={clearObat} class="text-xs text-slate-600">
					<X class="w-3.5 h-3.5 mr-1" /> Reset Filter ({selectedObat.obat_nama})
				</Button>
			{/if}
		</div>

		<div class="text-xs text-slate-500">
			{selectedObat ? `Riwayat khusus: ${selectedObat.obat_nama}` : 'Menampilkan mutasi terbaru'}
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-44">Waktu</TableHead>
				<TableHead>Nama Obat</TableHead>
				<TableHead class="text-center">Jenis Mutasi</TableHead>
				<TableHead class="text-center">Jumlah Mutasi</TableHead>
				<TableHead>No. Referensi / Supplier PBF</TableHead>
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
					<TableCell colspan={5} class="text-center py-8 text-slate-400 text-xs">
						Belum ada riwayat mutasi kartu stok.
					</TableCell>
				</TableRow>
			{:else}
				{#each rows as row}
					{@const isMasuk = jenisMutasi(row) === 'Masuk'}
					<TableRow>
						<!-- Waktu -->
						<TableCell class="text-xs text-slate-600 font-medium">
							{formatWaktu(row.tanggal_waktu)}
						</TableCell>

						<!-- Nama Obat -->
						<TableCell class="font-semibold text-slate-900 text-xs">
							{row.obat_nama}
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
</div>
