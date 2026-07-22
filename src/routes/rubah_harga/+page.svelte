<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { DollarSign, Search, RotateCcw, Edit2, Save, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-svelte';

	type StokRow = {
		obat_id: string;
		obat_nama: string;
		jenis_nama: string;
		qty: number;
		harga_pbf: number;
		harga_jual: number;
		diberikan: 0 | 1;
	};

	let loading = $state(true);
	let saving = $state(false);
	let stokList = $state<StokRow[]>([]);
	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = $state(100);
	let pageSizeStr = $state('100');
	let totalCount = $state(0);
	let searchTimer: ReturnType<typeof setTimeout>;

	// Sheet state
	let showSheet = $state(false);
	let editTarget = $state<StokRow | null>(null);
	let newHargaPbf = $state(0);
	let newHargaJual = $state(0);

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v));
	}

	function totalPages(): number {
		return Math.max(1, Math.ceil(totalCount / pageSize));
	}

	async function loadData() {
		loading = true;
		const queryText = searchQuery.trim().replace(/[,%_]/g, '');
		let query = supabase.from('obat').select('obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)', { count: 'exact' }).order('obat_nama');
		
		if (queryText) {
			query = query.or(`obat_id.ilike.%${queryText}%,obat_nama.ilike.%${queryText}%`);
		}

		const from = (currentPage - 1) * pageSize;
		const { data: obatData, count, error: obatError } = await query.range(from, from + pageSize - 1);

		if (obatError) {
			toast.error(`Gagal memuat data: ${obatError.message}`);
			stokList = [];
			totalCount = 0;
			loading = false;
			return;
		}

		totalCount = count ?? 0;
		if (currentPage > totalPages() && totalPages() > 0) {
			currentPage = totalPages();
			await loadData();
			return;
		}

		if (!obatData || obatData.length === 0) {
			stokList = [];
			loading = false;
			return;
		}

		const obatIds = obatData.map((o) => o.obat_id);
		const { data: stokData } = await supabase
			.from('stok')
			.select('obat_id, qty, harga_pbf, harga_jual, diberikan')
			.in('obat_id', obatIds);

		const stokMap = new Map();
		(stokData ?? []).forEach((s) => stokMap.set(s.obat_id, s));

		stokList = obatData.map((o: any) => {
			const s = stokMap.get(o.obat_id);
			return {
				obat_id: o.obat_id,
				obat_nama: o.obat_nama,
				jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id,
				qty: s?.qty ?? 0,
				harga_pbf: s?.harga_pbf ?? 0,
				harga_jual: s?.harga_jual ?? 0,
				diberikan: (s?.diberikan ?? 0) as 0 | 1
			};
		});

		loading = false;
	}

	function handleSearch() {
		clearTimeout(searchTimer);
		currentPage = 1;
		searchTimer = setTimeout(loadData, 300);
	}

	function changePageSize(event: Event) {
		pageSize = Number((event.currentTarget as HTMLSelectElement).value);
		currentPage = 1;
		loadData();
	}

	function previousPage() {
		if (currentPage > 1) {
			currentPage -= 1;
			loadData();
		}
	}

	function nextPage() {
		if (currentPage < totalPages()) {
			currentPage += 1;
			loadData();
		}
	}

	function openEdit(item: StokRow) {
		editTarget = item;
		newHargaPbf = item.harga_pbf;
		newHargaJual = item.harga_jual;
		showSheet = true;
	}

	async function handleSave() {
		if (!editTarget) return;
		if (newHargaPbf < 0 || newHargaJual < 0) { toast.error('Harga tidak boleh negatif.'); return; }

		saving = true;
		
		const { data: existingStok } = await supabase.from('stok').select('obat_id').eq('obat_id', editTarget.obat_id).maybeSingle();
		
		let error;
		if (existingStok) {
			const res = await supabase
				.from('stok')
				.update({ harga_pbf: newHargaPbf, harga_jual: newHargaJual })
				.eq('obat_id', editTarget.obat_id);
			error = res.error;
		} else {
			const res = await supabase
				.from('stok')
				.insert({ 
					obat_id: editTarget.obat_id, 
					qty: 0, 
					harga_pbf: newHargaPbf, 
					harga_jual: newHargaJual, 
					diberikan: 0,
					expired_date: '2099-12-31' 
				});
			error = res.error;
		}

		if (error) { 
			toast.error(`Gagal menyimpan: ${error.message}`); 
		} else {
			toast.success(`Harga ${editTarget.obat_nama} berhasil diubah`);
			showSheet = false;
			await loadData();
		}
		saving = false;
	}

	function selisih(item: StokRow): number {
		if (item.harga_pbf === 0) return 0;
		return Math.round(((item.harga_jual - item.harga_pbf) / item.harga_pbf) * 100);
	}

	onMount(loadData);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<DollarSign class="w-6 h-6 text-teal-600" />
				Penyesuaian Harga
			</h2>
			<p class="text-xs text-slate-500 mt-1">Kelola harga pokok PBF dan harga jual obat ke konsumen</p>
		</div>

		<Button variant="outline" size="sm" onclick={loadData} disabled={loading}>
			<RotateCcw class="w-3.5 h-3.5 mr-1.5" /> Refresh
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-3 flex-1">
			<div class="relative min-w-[240px] max-w-xs">
				<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
				<Input
					type="search"
					placeholder="Cari nama atau kode obat..."
					bind:value={searchQuery}
					oninput={handleSearch}
					class="pl-9"
				/>
			</div>

			<Select
				bind:value={pageSizeStr}
				onValueChange={(val) => { pageSize = Number(val); currentPage = 1; loadData(); }}
				options={[
					{ value: '100', label: '100 / Hal' },
					{ value: '500', label: '500 / Hal' },
					{ value: '1000', label: '1000 / Hal' }
				]}
				class="w-32"
			/>
		</div>

		<div class="text-xs text-slate-500 font-medium">
			Total: <strong>{totalCount.toLocaleString('id-ID')}</strong> obat
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-28">Kode</TableHead>
				<TableHead>Nama Obat</TableHead>
				<TableHead>Jenis</TableHead>
				<TableHead class="text-center">Stok</TableHead>
				<TableHead class="text-right">Harga PBF</TableHead>
				<TableHead class="text-right">Harga Jual</TableHead>
				<TableHead class="text-center">Margin (%)</TableHead>
				<TableHead class="text-center">Disc PBF</TableHead>
				<TableHead class="w-24 text-right">Aksi</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#if loading}
				{#each Array(6) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-16" /></TableCell>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20" /></TableCell>
						<TableCell><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-14 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16 ml-auto" /></TableCell>
					</TableRow>
				{/each}
			{:else if stokList.length === 0}
				<TableRow>
					<TableCell colspan={9} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada data obat ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each stokList as item}
					<TableRow>
						<TableCell>
							<Badge variant="secondary" class="font-mono text-xs text-purple-700 bg-purple-50">{item.obat_id}</Badge>
						</TableCell>
						<TableCell class="font-semibold text-slate-900 text-xs">{item.obat_nama}</TableCell>
						<TableCell>
							<Badge variant="outline" class="text-[11px] font-normal">{item.jenis_nama}</Badge>
						</TableCell>
						<TableCell class="text-center text-xs font-bold">{item.qty}</TableCell>
						<TableCell class="text-right text-xs text-slate-600">Rp{formatRp(item.harga_pbf)}</TableCell>
						<TableCell class="text-right text-xs font-bold text-teal-700">Rp{formatRp(item.harga_jual)}</TableCell>
						<TableCell class="text-center">
							{#if selisih(item) >= 10}
								<Badge variant="success" class="text-[10px]">{selisih(item)}%</Badge>
							{:else if selisih(item) > 0}
								<Badge variant="warning" class="text-[10px]">{selisih(item)}%</Badge>
							{:else}
								<Badge variant="destructive" class="text-[10px]">{selisih(item)}%</Badge>
							{/if}
						</TableCell>
						<TableCell class="text-center">
							{#if item.diberikan === 1}
								<Badge variant="success" class="text-[10px]">✓ Ada</Badge>
							{:else}
								<span class="text-slate-400 text-xs">✗</span>
							{/if}
						</TableCell>
						<TableCell class="text-right">
							<Button size="sm" variant="outline" class="h-7 text-xs hover:bg-teal-50 hover:text-teal-700" onclick={() => openEdit(item)}>
								<Edit2 class="w-3 h-3 mr-1" /> Ubah
							</Button>
						</TableCell>
					</TableRow>
				{/each}
			{/if}
		</TableBody>
	</Table>

	<!-- Pagination Bar -->
	<div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
		<div>
			Halaman <strong>{currentPage}</strong> dari <strong>{totalPages()}</strong>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" disabled={loading || currentPage === 1} onclick={previousPage}>
				<ChevronLeft class="w-4 h-4 mr-1" /> Sebelumnya
			</Button>
			<Button variant="outline" size="sm" disabled={loading || currentPage === totalPages()} onclick={nextPage}>
				Berikutnya <ChevronRight class="w-4 h-4 ml-1" />
			</Button>
		</div>
	</div>
</div>

<!-- Slide-in Sheet Form -->
<Sheet
	bind:open={showSheet}
	title="Ubah Harga Obat"
	description="Sesuaikan harga pokok PBF dan harga jual obat."
>
	{#if editTarget}
		<div class="space-y-5 pt-2">

			<!-- Target Info Banner -->
			<div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
				<div>
					<span class="font-bold text-slate-900 block">{editTarget.obat_nama}</span>
					<span class="text-slate-400 font-mono text-[10px]">{editTarget.obat_id} · {editTarget.jenis_nama}</span>
				</div>
				<Badge variant="secondary">Stok: {editTarget.qty}</Badge>
			</div>

			<!-- Price Compare Box -->
			<div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-teal-50/50 border border-teal-100 text-xs">
				<div class="space-y-1">
					<span class="text-[10px] font-semibold text-slate-400 uppercase">Harga Saat Ini</span>
					<div class="text-slate-600">PBF: Rp{formatRp(editTarget.harga_pbf)}</div>
					<div class="font-bold text-slate-900">Jual: Rp{formatRp(editTarget.harga_jual)}</div>
				</div>

				<div class="space-y-1 border-l border-teal-200 pl-3">
					<span class="text-[10px] font-semibold text-teal-600 uppercase">Harga Baru</span>
					<div class="text-teal-700">PBF: Rp{formatRp(newHargaPbf)}</div>
					<div class="font-bold text-teal-900">Jual: Rp{formatRp(newHargaJual)}</div>
				</div>
			</div>

			<!-- Input Form -->
			<div class="space-y-3">
				<div class="space-y-1.5">
					<label for="new-harga-pbf" class="text-xs font-semibold text-slate-700">Harga PBF (Modal) Baru</label>
					<Input id="new-harga-pbf" type="number" min="0" bind:value={newHargaPbf} class="h-10 text-sm font-semibold" />
				</div>

				<div class="space-y-1.5">
					<label for="new-harga-jual" class="text-xs font-semibold text-slate-700">Harga Jual Baru</label>
					<Input id="new-harga-jual" type="number" min="0" bind:value={newHargaJual} class="h-10 text-sm font-bold text-teal-700" />
				</div>
			</div>

			<!-- New Margin Preview -->
			{#if newHargaPbf > 0}
				<div class="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center justify-between">
					<span>Estimasi Margin Baru:</span>
					<span class="font-bold text-sm">
						{Math.round(((newHargaJual - newHargaPbf) / newHargaPbf) * 100)}%
						<span class="text-xs font-normal text-sky-700">(+Rp{formatRp(newHargaJual - newHargaPbf)})</span>
					</span>
				</div>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showSheet = false)}>Batal</Button>
		<Button size="sm" onclick={handleSave} disabled={saving}>
			{#if saving}Menyimpan...{:else}<Save class="w-3.5 h-3.5 mr-1" /> Simpan Harga{/if}
		</Button>
	{/snippet}
</Sheet>
