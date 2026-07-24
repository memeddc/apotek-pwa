<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ijenis_obat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { AlertDialog } from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PageHeader } from '$lib/components/ui/page-header';
	import { DataToolbar } from '$lib/components/ui/data-toolbar';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Pill, Plus, Search, Edit2, Trash2, Save, Pause, Play, ChevronLeft, ChevronRight, DollarSign, SearchX } from 'lucide-svelte';

	type ObatMergedRow = {
		obat_id: string;
		obat_nama: string;
		ket_obat?: string;
		isActive: 0 | 1;
		jenis_id: string;
		jenis_nama: string;
		qty: number;
		harga_pbf: number;
		harga_jual: number;
		diberikan: 0 | 1;
	};

	let data = $state<ObatMergedRow[]>([]);
	let jenisObatList = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);
	let currentPage = $state(1);
	let pageSize = $state(25);
	let totalCount = $state(0);
	let searchTimer: ReturnType<typeof setTimeout>;
	let idTimer: ReturnType<typeof setTimeout>;

	// Sheet Form (Tambah / Edit Master & Stok)
	let showSheet = $state(false);
	let isEditing = $state(false);
	let formData = $state<ObatMergedRow>({
		obat_id: '',
		obat_nama: '',
		jenis_id: '',
		jenis_nama: '',
		ket_obat: '',
		isActive: 1,
		qty: 0,
		harga_pbf: 0,
		harga_jual: 0,
		diberikan: 0
	});
	let saving = $state(false);

	// Modal Rubah Harga Cepat
	let showHargaModal = $state(false);
	let hargaTarget = $state<ObatMergedRow | null>(null);
	let quickHargaPbf = $state(0);
	let quickHargaJual = $state(0);
	let quickDiberikan = $state<0 | 1>(0);
	let quickQty = $state(0);
	let savingHarga = $state(false);

	// Delete Confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<ObatMergedRow | null>(null);
	let hasTransactions = $state<Set<string>>(new Set());
	let filterMode = $state<'semua' | 'aktif' | 'nonaktif' | 'bisa_hapus' | 'ada_transaksi'>('semua');

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v || 0));
	}

	function hitungMargin(pbf: number, jual: number): number {
		if (!pbf || pbf <= 0) return 0;
		return Math.round(((jual - pbf) / pbf) * 100);
	}

	function totalPages(): number {
		return Math.max(1, Math.ceil(totalCount / pageSize));
	}

	function getJenisNama(jenisId: string): string {
		return jenisObatList.find((j) => j.jenis_id === jenisId)?.jenis_nama ?? jenisId;
	}

	async function loadJenis() {
		const { data: result, error } = await supabase.from('jenis_obat').select('*').order('jenis_id');
		if (error) toast.error(`Gagal memuat jenis obat: ${error.message}`);
		else jenisObatList = result ?? [];
	}

	async function loadData() {
		loading = true;
		const queryText = searchQuery.trim().replace(/[,%_]/g, '');

		// JOIN Query: obat INNER JOIN jenis_obat, LEFT/INNER JOIN stok
		let query = supabase
			.from('obat')
			.select(
				`
				obat_id,
				obat_nama,
				ket_obat,
				isActive,
				jenis_id,
				jenis_obat!inner(jenis_nama),
				stok(qty, harga_pbf, harga_jual, diberikan)
			`,
				{ count: 'exact' }
			)
			.order('obat_nama');

		if (queryText) {
			query = query.or(`obat_id.ilike.%${queryText}%,obat_nama.ilike.%${queryText}%`);
		}
		if (filterMode === 'aktif') query = query.eq('isActive', 1);
		else if (filterMode === 'nonaktif') query = query.eq('isActive', 0);

		const from = (currentPage - 1) * pageSize;
		const { data: result, count, error } = await query.range(from, from + pageSize - 1);

		if (error) {
			toast.error(`Gagal memuat data obat: ${error.message}`);
			data = [];
			totalCount = 0;
		} else {
			totalCount = count ?? 0;
			if (currentPage > totalPages() && totalPages() > 0) {
				currentPage = totalPages();
				await loadData();
				return;
			}

			// Map returned joined data into flat ObatMergedRow structure
			data = (result ?? []).map((item: any) => {
				const s = Array.isArray(item.stok) ? item.stok[0] : item.stok;
				return {
					obat_id: item.obat_id,
					obat_nama: item.obat_nama,
					ket_obat: item.ket_obat ?? '',
					isActive: (item.isActive ?? 1) as 0 | 1,
					jenis_id: item.jenis_id,
					jenis_nama: item.jenis_obat?.jenis_nama ?? getJenisNama(item.jenis_id),
					qty: s?.qty ?? 0,
					harga_pbf: s?.harga_pbf ?? 0,
					harga_jual: s?.harga_jual ?? 0,
					diberikan: (s?.diberikan ?? 0) as 0 | 1
				};
			});
		}

		loading = false;
		await checkTransactions();
	}

	async function checkTransactions() {
		if (data.length === 0) {
			hasTransactions = new Set();
			return;
		}
		const obatIds = data.map((d) => d.obat_id);
		const [purchaseRes, salesRes] = await Promise.all([
			supabase.from('detail_purchase').select('obat_id').in('obat_id', obatIds),
			supabase.from('detail_penjualan').select('obat_id').in('obat_id', obatIds)
		]);
		const set = new Set<string>();
		(purchaseRes.data ?? []).forEach((r) => set.add(r.obat_id));
		(salesRes.data ?? []).forEach((r) => set.add(r.obat_id));
		hasTransactions = set;
	}

	function getDisplayData(): ObatMergedRow[] {
		if (filterMode === 'bisa_hapus') return data.filter((d) => !hasTransactions.has(d.obat_id));
		if (filterMode === 'ada_transaksi') return data.filter((d) => hasTransactions.has(d.obat_id));
		return data;
	}

	function handleSearch() {
		clearTimeout(searchTimer);
		currentPage = 1;
		searchTimer = setTimeout(loadData, 300);
	}

	function obatPrefix(name: string): string {
		return name
			.toUpperCase()
			.replace(/[^A-Z0-9]/g, '')
			.slice(0, 3)
			.padEnd(3, 'X');
	}

	async function generateObatId() {
		if (isEditing || !formData.obat_nama.trim()) return;
		const prefix = obatPrefix(formData.obat_nama);
		const { data: existing, error } = await supabase
			.from('obat')
			.select('obat_id')
			.like('obat_id', `${prefix}%`)
			.order('obat_id', { ascending: false })
			.limit(1);

		if (error) {
			toast.error(`Gagal membuat kode obat: ${error.message}`);
			return;
		}
		const lastId = existing?.[0]?.obat_id ?? '';
		const lastNumber = Number(lastId.slice(prefix.length)) || 0;
		formData.obat_id = `${prefix}${String(lastNumber + 1).padStart(5, '0')}`;
	}

	function scheduleObatId() {
		clearTimeout(idTimer);
		idTimer = setTimeout(generateObatId, 300);
	}

	function openAdd() {
		isEditing = false;
		formData = {
			obat_id: '',
			obat_nama: '',
			jenis_id: jenisObatList[0]?.jenis_id ?? '',
			jenis_nama: jenisObatList[0]?.jenis_nama ?? '',
			ket_obat: '',
			isActive: 1,
			qty: 0,
			harga_pbf: 0,
			harga_jual: 0,
			diberikan: 0
		};
		showSheet = true;
	}

	function openEdit(item: ObatMergedRow) {
		isEditing = true;
		let matchedJenisId = item.jenis_id;
		const found = jenisObatList.find(
			(j) => j.jenis_id === item.jenis_id || j.jenis_nama === item.jenis_id || j.jenis_nama === item.jenis_nama
		);
		if (found) {
			matchedJenisId = found.jenis_id;
		}
		formData = {
			...item,
			jenis_id: matchedJenisId
		};
		showSheet = true;
	}

	function openRubahHarga(item: ObatMergedRow) {
		hargaTarget = item;
		quickHargaPbf = item.harga_pbf;
		quickHargaJual = item.harga_jual;
		quickDiberikan = item.diberikan;
		showHargaModal = true;
	}

	function confirmDelete(item: ObatMergedRow) {
		deleteTarget = item;
		showDeleteConfirm = true;
	}

	async function setActive(item: ObatMergedRow, isActive: 0 | 1) {
		const { error } = await supabase.from('obat').update({ isActive }).eq('obat_id', item.obat_id);
		if (error) {
			toast.error(`Gagal mengubah status: ${error.message}`);
		} else {
			toast.success(isActive ? 'Obat diaktifkan' : 'Obat dinonaktifkan');
			await loadData();
		}
	}

	async function handleSaveMasterAndStok() {
		if (!formData.obat_nama.trim() || !formData.jenis_id.trim()) {
			toast.error('Nama dan jenis obat wajib diisi.');
			return;
		}
		if (!isEditing) await generateObatId();
		if (!formData.obat_id) {
			toast.error('Kode obat belum dapat dibuat.');
			return;
		}

		saving = true;

		// 1. Upsert table `obat`
		if (isEditing) {
			const { error: obatErr } = await supabase
				.from('obat')
				.update({
					obat_nama: formData.obat_nama,
					jenis_id: formData.jenis_id,
					ket_obat: formData.ket_obat || null
				})
				.eq('obat_id', formData.obat_id);

			if (obatErr) {
				toast.error(`Gagal mengupdate obat: ${obatErr.message}`);
				saving = false;
				return;
			}
		} else {
			const { error: obatErr } = await supabase.from('obat').insert({
				obat_id: formData.obat_id,
				obat_nama: formData.obat_nama,
				jenis_id: formData.jenis_id,
				ket_obat: formData.ket_obat || null,
				isActive: 1
			});

			if (obatErr) {
				toast.error(`Gagal menyimpan obat: ${obatErr.message}`);
				saving = false;
				return;
			}
		}

		// 2. Upsert table `stok`
		const { data: existingStok } = await supabase
			.from('stok')
			.select('obat_id')
			.eq('obat_id', formData.obat_id)
			.maybeSingle();

		if (existingStok) {
			const updatePayload = isEditing
				? { qty: formData.qty }
				: {
						qty: formData.qty,
						harga_pbf: formData.harga_pbf,
						harga_jual: formData.harga_jual,
						diberikan: formData.diberikan
				  };

			const { error: stokErr } = await supabase
				.from('stok')
				.update(updatePayload)
				.eq('obat_id', formData.obat_id);

			if (stokErr) toast.error(`Gagal mengupdate stok: ${stokErr.message}`);
		} else {
			const { error: stokErr } = await supabase.from('stok').insert({
				obat_id: formData.obat_id,
				qty: formData.qty,
				harga_pbf: formData.harga_pbf || 0,
				harga_jual: formData.harga_jual || 0,
				diberikan: formData.diberikan || 0,
				expired_date: '2099-12-31'
			});

			if (stokErr) toast.error(`Gagal membuat stok awal: ${stokErr.message}`);
		}

		saving = false;
		toast.success(`Data obat ${formData.obat_id} berhasil disimpan`);
		showSheet = false;
		await loadData();
	}

	async function handleSaveQuickHarga() {
		if (!hargaTarget) return;
		if (quickHargaPbf < 0 || quickHargaJual < 0) {
			toast.error('Harga tidak boleh negatif.');
			return;
		}

		savingHarga = true;
		const { data: existingStok } = await supabase
			.from('stok')
			.select('obat_id')
			.eq('obat_id', hargaTarget.obat_id)
			.maybeSingle();

		let error;
		if (existingStok) {
			const res = await supabase
				.from('stok')
				.update({
					harga_pbf: quickHargaPbf,
					harga_jual: quickHargaJual,
					diberikan: quickDiberikan
				})
				.eq('obat_id', hargaTarget.obat_id);
			error = res.error;
		} else {
			const res = await supabase.from('stok').insert({
				obat_id: hargaTarget.obat_id,
				qty: 0,
				harga_pbf: quickHargaPbf,
				harga_jual: quickHargaJual,
				diberikan: quickDiberikan,
				expired_date: '2099-12-31'
			});
			error = res.error;
		}

		savingHarga = false;
		if (error) {
			toast.error(`Gagal menyimpan harga: ${error.message}`);
		} else {
			toast.success(`Harga ${hargaTarget.obat_nama} berhasil diperbarui`);
			showHargaModal = false;
			await loadData();
		}
	}

	async function handleDelete() {
		if (!deleteTarget) return;

		// Delete stok entry first if any
		await supabase.from('stok').delete().eq('obat_id', deleteTarget.obat_id);

		const { error } = await supabase.from('obat').delete().eq('obat_id', deleteTarget.obat_id);

		if (error) toast.error(`Gagal menghapus: ${error.message}`);
		else {
			toast.success('Data obat berhasil dihapus');
			await loadData();
		}
		showDeleteConfirm = false;
		deleteTarget = null;
	}

	onMount(async () => {
		await loadJenis();
		await loadData();
	});
</script>

<div class="space-y-4">
	<!-- Page Header -->
	<PageHeader
		title="Data & Stok Obat"
		description="Kelola master obat, persediaan stok, serta penyesuaian harga PBF dan harga jual"
		badge={`${totalCount} Item`}
	>
		{#snippet actions()}
			<Button onclick={openAdd} class="bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-xl gap-2 shadow-xs cursor-pointer">
				<Plus class="w-4 h-4" /> Tambah Obat & Stok
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Data Toolbar -->
	<DataToolbar
		searchPlaceholder="Cari nama atau kode obat..."
		bind:searchValue={searchQuery}
		onSearchInput={handleSearch}
		totalItems={totalCount}
		filteredCount={getDisplayData().length}
		itemLabel="obat"
	>
		{#snippet filters()}
			<Select
				bind:value={filterMode}
				onValueChange={() => {
					currentPage = 1;
					loadData();
				}}
				options={[
					{ value: 'semua', label: 'Semua Status' },
					{ value: 'aktif', label: 'Status: Aktif' },
					{ value: 'nonaktif', label: 'Status: Nonaktif' },
					{ value: 'bisa_hapus', label: 'Bisa Dihapus' },
					{ value: 'ada_transaksi', label: 'Ada Transaksi' }
				]}
				class="w-36 h-9 text-xs rounded-xl border-slate-200"
			/>
		{/snippet}
	</DataToolbar>

	<!-- Merged Data Table Container -->
	<div class="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
		<Table class="table-compact table-striped">
			<TableHeader class="bg-slate-50/80 border-b border-slate-200/80">
				<TableRow class="hover:bg-transparent">
					<TableHead class="w-24 font-bold text-slate-700">Kode</TableHead>
					<TableHead class="font-bold text-slate-700">Nama Obat</TableHead>
					<TableHead class="font-bold text-slate-700">Jenis</TableHead>
					<TableHead class="w-20 text-center font-bold text-slate-700">Stok</TableHead>
					<TableHead class="text-right font-bold text-slate-700">Harga PBF</TableHead>
					<TableHead class="text-right font-bold text-slate-700">Harga Jual</TableHead>
					<TableHead class="text-center font-bold text-slate-700">Margin</TableHead>
					<TableHead class="text-center w-16 font-bold text-slate-700">Disc PBF</TableHead>
					<TableHead class="w-20 text-center font-bold text-slate-700">Status</TableHead>
					<TableHead class="w-32 text-right font-bold text-slate-700">Aksi</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					{#each Array(6) as _}
						<TableRow>
							<TableCell><Skeleton class="h-5 w-16" /></TableCell>
							<TableCell><Skeleton class="h-5 w-36" /></TableCell>
							<TableCell><Skeleton class="h-5 w-20" /></TableCell>
							<TableCell><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-12 mx-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-8 mx-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-14 mx-auto" /></TableCell>
							<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
						</TableRow>
					{/each}
				{:else if getDisplayData().length === 0}
					<TableRow>
						<TableCell colspan={10} class="text-center py-12 text-slate-400">
							<div class="flex flex-col items-center justify-center gap-2">
								<SearchX class="w-8 h-8 text-slate-300" />
								<p class="text-xs font-semibold text-slate-600">Tidak ada data obat ditemukan</p>
								<p class="text-[11px] text-slate-400">Coba sesuaikan kata kunci atau filter status yang dipilih.</p>
							</div>
						</TableCell>
					</TableRow>
				{:else}
					{#each getDisplayData() as item}
						{@const marginPct = hitungMargin(item.harga_pbf, item.harga_jual)}
						<TableRow class={item.isActive === 0 ? 'opacity-60 bg-slate-50/50' : ''}>
							<!-- Kode Obat -->
							<TableCell>
								<Badge variant="secondary" class="font-mono text-xs text-purple-700 bg-purple-50">{item.obat_id}</Badge>
							</TableCell>

							<!-- Nama Obat -->
							<TableCell class="font-medium text-slate-800 text-xs">
								<span class={item.isActive === 0 ? 'line-through text-slate-400' : 'font-semibold text-slate-900'}>{item.obat_nama}</span>
								{#if item.ket_obat}
									<span class="block text-[10px] text-slate-400 font-normal truncate max-w-xs">{item.ket_obat}</span>
								{/if}
							</TableCell>

							<!-- Jenis -->
							<TableCell>
								<Badge variant="outline" class="text-[11px] font-normal">{item.jenis_nama}</Badge>
							</TableCell>

							<!-- Stok Qty -->
							<TableCell class="text-center font-bold text-xs">
								{#if item.qty <= 0}
									<Badge variant="destructive" class="text-[10px]">0</Badge>
								{:else if item.qty < 10}
									<Badge variant="secondary" class="text-[10px] bg-amber-50 text-amber-700 border-amber-200">{item.qty}</Badge>
								{:else}
									<span class="text-slate-800">{item.qty}</span>
								{/if}
							</TableCell>

							<!-- Harga PBF -->
							<TableCell class="text-right text-xs text-slate-600 font-mono">
								Rp{formatRp(item.harga_pbf)}
							</TableCell>

							<!-- Harga Jual -->
							<TableCell class="text-right text-xs font-bold text-mint-700 font-mono">
								Rp{formatRp(item.harga_jual)}
							</TableCell>

							<!-- Margin (%) -->
							<TableCell class="text-center text-xs">
								{#if marginPct >= 10}
									<Badge variant="success" class="text-[10px]">+{marginPct}%</Badge>
								{:else if marginPct > 0}
									<Badge variant="secondary" class="text-[10px] bg-amber-50 text-amber-700">+{marginPct}%</Badge>
								{:else}
									<Badge variant="destructive" class="text-[10px]">{marginPct}%</Badge>
								{/if}
							</TableCell>

							<!-- Diskon PBF (Diberikan) -->
							<TableCell class="text-center text-xs">
								{#if item.diberikan === 1}
									<span class="text-mint-600 font-bold" title="Diskon PBF Diberikan">✓</span>
								{:else}
									<span class="text-slate-300" title="Tidak Diberikan">✗</span>
								{/if}
							</TableCell>

							<!-- Status (isActive) -->
							<TableCell class="text-center">
								{#if item.isActive === 1}
									<Badge variant="success" class="text-[10px]">Aktif</Badge>
								{:else}
									<Badge variant="destructive" class="text-[10px]">Nonaktif</Badge>
								{/if}
							</TableCell>

							<!-- Aksi -->
							<TableCell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<!-- Rubah Harga Quick Button -->
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 text-mint-600 hover:bg-mint-50 cursor-pointer"
										title="Rubah Harga & Stok"
										onclick={() => openRubahHarga(item)}
									>
										<DollarSign class="w-3.5 h-3.5" />
									</Button>

									<!-- Edit Master Obat & Stok Sheet Button -->
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 text-slate-600 hover:text-mint-600 cursor-pointer"
										title="Edit Detail Obat"
										onclick={() => openEdit(item)}
									>
										<Edit2 class="w-3.5 h-3.5" />
									</Button>

									<!-- Toggle Aktif/Nonaktif atau Hapus -->
									{#if hasTransactions.has(item.obat_id)}
										{#if item.isActive === 1}
											<Button
												variant="outline"
												size="sm"
												class="h-7 text-[10px] text-amber-700 hover:bg-amber-50"
												onclick={() => setActive(item, 0)}
											>
												<Pause class="w-3 h-3 mr-1" /> Nonaktifkan
											</Button>
										{:else}
											<Button
												variant="outline"
												size="sm"
												class="h-7 text-[10px] text-emerald-700 hover:bg-emerald-50"
												onclick={() => setActive(item, 1)}
											>
												<Play class="w-3 h-3 mr-1" /> Aktifkan
											</Button>
										{/if}
									{:else}
										{#if item.isActive === 0}
											<Button
												variant="outline"
												size="sm"
												class="h-7 text-[10px] text-emerald-700 hover:bg-emerald-50"
												onclick={() => setActive(item, 1)}
											>
												<Play class="w-3 h-3 mr-1" /> Aktifkan
											</Button>
										{/if}
										<Button
											variant="ghost"
											size="icon"
											class="h-7 w-7 text-slate-400 hover:text-red-600"
											title="Hapus Obat"
											onclick={() => confirmDelete(item)}
										>
											<Trash2 class="w-3.5 h-3.5" />
										</Button>
									{/if}
								</div>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>

		<!-- Pagination Footer -->
		{#if !loading && totalCount > 0}
			<Pagination
				currentPage={currentPage}
				totalItems={totalCount}
				pageSize={pageSize}
				onPageChange={(page) => {
					currentPage = page;
					loadData();
				}}
				onPageSizeChange={(size) => {
					pageSize = size;
					currentPage = 1;
					loadData();
				}}
			/>
		{/if}
	</div>
</div>

<!-- Slide-in Sheet: Tambah / Edit Obat & Stok -->
<Sheet
	bind:open={showSheet}
	title={isEditing ? 'Edit Data & Stok Obat' : 'Tambah Obat & Stok Baru'}
	description="Kelola informasi master obat beserta persediaan stok dan harganya."
>
	<div class="space-y-4 pt-2">
		<!-- Master Obat Fields -->
		<div class="space-y-1.5">
			<label for="obat-id" class="text-xs font-semibold text-slate-700">Kode Obat</label>
			<Input id="obat-id" value={formData.obat_id || 'Akan dibuat otomatis'} disabled class="font-mono bg-slate-50 text-xs" />
		</div>
		<div class="space-y-1.5">
			<label for="obat-nama" class="text-xs font-semibold text-slate-700">Nama Obat</label>
			<Input id="obat-nama" bind:value={formData.obat_nama} oninput={scheduleObatId} placeholder="Contoh: Amoxicillin 500mg" class="text-xs" />
		</div>
		<div class="space-y-1.5">
			<label for="jenis-id" class="text-xs font-semibold text-slate-700">Jenis Obat</label>
			<Select
				id="jenis-id"
				bind:value={formData.jenis_id}
				placeholder="Pilih jenis obat..."
				options={jenisObatList.map((j) => ({ value: j.jenis_id, label: j.jenis_nama }))}
			/>
		</div>

		<!-- Stok & Harga Fields -->
		<div class="border-t border-slate-100 pt-3 mt-3">
			<h4 class="text-xs font-bold text-teal-800 mb-3">
				Informasi Stok {isEditing ? '' : '& Harga Awal'}
			</h4>
			<div class="space-y-3">
				<div class="space-y-1.5">
					<label for="qty" class="text-xs font-semibold text-slate-700">Qty Stok Saat Ini</label>
					<Input id="qty" type="number" min="0" bind:value={formData.qty} class="text-xs font-mono" />
				</div>

				{#if !isEditing}
					<div class="grid grid-cols-2 gap-3 pt-2">
						<div class="space-y-1.5">
							<label for="diberikan" class="text-xs font-semibold text-slate-700">Diskon PBF</label>
							<Select
								id="diberikan"
								value={String(formData.diberikan)}
								onValueChange={(val) => (formData.diberikan = val === '1' ? 1 : 0)}
								options={[
									{ value: '1', label: 'Diberikan' },
									{ value: '0', label: 'Tidak Diberikan' }
								]}
							/>
						</div>
						<div class="space-y-1.5">
							<label for="harga-pbf" class="text-xs font-semibold text-slate-700">Harga PBF (Modal)</label>
							<Input id="harga-pbf" type="number" min="0" bind:value={formData.harga_pbf} class="text-xs font-mono" />
						</div>
						<div class="space-y-1.5 col-span-2">
							<label for="harga-jual" class="text-xs font-semibold text-slate-700">Harga Jual</label>
							<Input id="harga-jual" type="number" min="0" bind:value={formData.harga_jual} class="text-xs font-mono" />
						</div>
					</div>
				{/if}
			</div>
		</div>

		<div class="space-y-1.5 border-t border-slate-100 pt-3">
			<label for="ket-obat" class="text-xs font-semibold text-slate-700">Keterangan (Opsional)</label>
			<textarea
				id="ket-obat"
				bind:value={formData.ket_obat}
				rows="2"
				class="w-full p-3 rounded-md border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-600 resize-y"
			></textarea>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showSheet = false)}>Batal</Button>
		<Button size="sm" onclick={handleSaveMasterAndStok} disabled={saving}>
			{#if saving}Menyimpan...{:else}<Save class="w-3.5 h-3.5 mr-1" /> Simpan All Data{/if}
		</Button>
	{/snippet}
</Sheet>

<!-- Modal Quick Rubah Harga -->
{#if showHargaModal && hargaTarget}
	<div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
		<div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
			<div class="flex items-center justify-between border-b border-slate-100 pb-3">
				<div>
					<h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
						<DollarSign class="w-5 h-5 text-teal-600" /> Rubah Harga Obat
					</h3>
					<p class="text-xs text-slate-500 mt-0.5">
						<span class="font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded mr-1">{hargaTarget.obat_id}</span>
						<strong>{hargaTarget.obat_nama}</strong>
					</p>
				</div>
			</div>

			<!-- Price Comparison -->
			<div class="grid grid-cols-2 gap-3 text-xs">
				<div class="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
					<div class="text-[10px] font-bold text-slate-400">Saat Ini</div>
					<div class="flex justify-between"><span>PBF:</span><span class="font-mono font-medium">Rp{formatRp(hargaTarget.harga_pbf)}</span></div>
					<div class="flex justify-between"><span>Jual:</span><span class="font-mono font-bold text-teal-700">Rp{formatRp(hargaTarget.harga_jual)}</span></div>
					<div class="flex justify-between text-slate-500"><span>Diskon PBF:</span><span class="font-semibold text-purple-700">{hargaTarget.diberikan === 1 ? 'Diberikan' : 'Tidak Diberikan'}</span></div>
				</div>
				<div class="bg-teal-50/70 p-3 rounded-lg border border-teal-200 space-y-1">
					<div class="text-[10px] font-bold text-teal-700">Harga Baru</div>
					<div class="flex justify-between"><span>PBF:</span><span class="font-mono font-medium">Rp{formatRp(quickHargaPbf)}</span></div>
					<div class="flex justify-between"><span>Jual:</span><span class="font-mono font-bold text-teal-700">Rp{formatRp(quickHargaJual)}</span></div>
					<div class="flex justify-between text-slate-500"><span>Diskon PBF:</span><span class="font-semibold text-purple-700">{quickDiberikan === 1 ? 'Diberikan' : 'Tidak Diberikan'}</span></div>
				</div>
			</div>

			<!-- Input Fields (Harga PBF, Harga Jual, Diskon PBF) -->
			<div class="space-y-3 pt-1">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<label for="quick-harga-pbf" class="text-xs font-semibold text-slate-700">Harga PBF Baru</label>
						<Input id="quick-harga-pbf" type="number" min="0" bind:value={quickHargaPbf} class="text-xs font-mono" />
					</div>
					<div class="space-y-1">
						<label for="quick-harga-jual" class="text-xs font-semibold text-slate-700">Harga Jual Baru</label>
						<Input id="quick-harga-jual" type="number" min="0" bind:value={quickHargaJual} class="text-xs font-mono" />
					</div>
				</div>

				<div class="space-y-1">
					<label for="quick-diberikan" class="text-xs font-semibold text-slate-700">Diskon PBF</label>
					<Select
						id="quick-diberikan"
						value={String(quickDiberikan)}
						onValueChange={(val) => (quickDiberikan = val === '1' ? 1 : 0)}
						options={[
							{ value: '1', label: 'Diberikan' },
							{ value: '0', label: 'Tidak Diberikan' }
						]}
					/>
				</div>

				{#if quickHargaPbf > 0}
					<div class="text-[11px] text-teal-700 font-medium bg-teal-50 p-2.5 rounded-lg border border-teal-100">
						Margin Baru: <strong>+{hitungMargin(quickHargaPbf, quickHargaJual)}%</strong> (Rp{formatRp(quickHargaJual - quickHargaPbf)})
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
				<Button variant="outline" size="sm" onclick={() => (showHargaModal = false)}>Batal</Button>
				<Button size="sm" onclick={handleSaveQuickHarga} disabled={savingHarga}>
					{savingHarga ? 'Menyimpan...' : '💾 Simpan Harga'}
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- AlertDialog Delete -->
<AlertDialog
	bind:open={showDeleteConfirm}
	title="Hapus Master & Stok Obat"
	description={`Apakah Anda yakin ingin menghapus permanen obat "${deleteTarget?.obat_nama}" beserta data stoknya?`}
	onConfirm={handleDelete}
/>
