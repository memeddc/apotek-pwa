<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat, Ijenis_obat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { AlertDialog } from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Pill, Plus, Search, Edit2, Trash2, Save, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-svelte';

	let data = $state<Iobat[]>([]);
	let jenisObatList = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);
	let currentPage = $state(1);
	let pageSize = $state(100);
	let pageSizeStr = $state('100');
	let totalCount = $state(0);
	let showSheet = $state(false);
	let isEditing = $state(false);
	let formData = $state<Iobat>({ obat_id: '', obat_nama: '', jenis_id: '', ket_obat: '', isActive: 1 });
	let saving = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;
	let idTimer: ReturnType<typeof setTimeout>;
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Iobat | null>(null);
	let hasTransactions = $state<Set<string>>(new Set());
	let filterMode = $state<'semua' | 'aktif' | 'nonaktif' | 'bisa_hapus' | 'ada_transaksi'>('semua');

	function totalPages(): number { return Math.max(1, Math.ceil(totalCount / pageSize)); }
	function getJenisNama(jenisId: string): string { return jenisObatList.find((j) => j.jenis_id === jenisId)?.jenis_nama ?? jenisId; }

	async function loadJenis() {
		const { data: result, error } = await supabase.from('jenis_obat').select('*').order('jenis_id');
		if (error) toast.error(`Gagal memuat jenis obat: ${error.message}`);
		else jenisObatList = result ?? [];
	}

	async function loadData() {
		loading = true;
		const queryText = searchQuery.trim().replace(/[,%_]/g, '');
		let query = supabase.from('obat').select('*', { count: 'exact' }).order('obat_nama');
		if (queryText) query = query.or(`obat_id.ilike.%${queryText}%,obat_nama.ilike.%${queryText}%`);
		if (filterMode === 'aktif') query = query.eq('isActive', 1);
		else if (filterMode === 'nonaktif') query = query.eq('isActive', 0);
		const from = (currentPage - 1) * pageSize;
		const { data: result, count, error } = await query.range(from, from + pageSize - 1);
		if (error) { toast.error(`Gagal memuat data obat: ${error.message}`); data = []; totalCount = 0; }
		else { data = result ?? []; totalCount = count ?? 0; if (currentPage > totalPages()) { currentPage = totalPages(); await loadData(); return; } }
		loading = false;
		await checkTransactions();
	}

	async function checkTransactions() {
		if (data.length === 0) { hasTransactions = new Set(); return; }
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

	function getDisplayData(): Iobat[] {
		if (filterMode === 'bisa_hapus') return data.filter((d) => !hasTransactions.has(d.obat_id));
		if (filterMode === 'ada_transaksi') return data.filter((d) => hasTransactions.has(d.obat_id));
		return data;
	}

	function handleSearch() { clearTimeout(searchTimer); currentPage = 1; searchTimer = setTimeout(loadData, 300); }
	function handleFilterChange() { currentPage = 1; loadData(); }
	function changePageSize(event: Event) { pageSize = Number((event.currentTarget as HTMLSelectElement).value); currentPage = 1; loadData(); }
	function previousPage() { if (currentPage > 1) { currentPage -= 1; loadData(); } }
	function nextPage() { if (currentPage < totalPages()) { currentPage += 1; loadData(); } }

	function obatPrefix(name: string): string { return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'X'); }
	async function generateObatId() {
		if (isEditing || !formData.obat_nama.trim()) return;
		const prefix = obatPrefix(formData.obat_nama);
		const { data: existing, error } = await supabase.from('obat').select('obat_id').like('obat_id', `${prefix}%`).order('obat_id', { ascending: false }).limit(1);
		if (error) { toast.error(`Gagal membuat kode obat: ${error.message}`); return; }
		const lastId = existing?.[0]?.obat_id ?? '';
		const lastNumber = Number(lastId.slice(prefix.length)) || 0;
		formData.obat_id = `${prefix}${String(lastNumber + 1).padStart(5, '0')}`;
	}
	function scheduleObatId() { clearTimeout(idTimer); idTimer = setTimeout(generateObatId, 300); }

	function openAdd() { isEditing = false; formData = { obat_id: '', obat_nama: '', jenis_id: jenisObatList[0]?.jenis_id ?? '', ket_obat: '', isActive: 1 }; showSheet = true; }
	function openEdit(item: Iobat) { isEditing = true; formData = { ...item }; showSheet = true; }
	function confirmDelete(item: Iobat) { deleteTarget = item; showDeleteConfirm = true; }

	async function setActive(item: Iobat, isActive: 0 | 1) {
		const { error } = await supabase.from('obat').update({ isActive }).eq('obat_id', item.obat_id);
		if (error) toast.error(`Gagal mengubah status: ${error.message}`);
		else { toast.success(isActive ? 'Obat diaktifkan' : 'Obat dinonaktifkan'); await loadData(); }
	}

	async function handleSave() {
		if (!formData.obat_nama.trim() || !formData.jenis_id.trim()) { toast.error('Nama dan jenis obat wajib diisi.'); return; }
		if (!isEditing) await generateObatId();
		if (!formData.obat_id) { toast.error('Kode obat belum dapat dibuat.'); return; }
		saving = true;
		if (isEditing) {
			const { error } = await supabase.from('obat').update({ obat_nama: formData.obat_nama, jenis_id: formData.jenis_id, ket_obat: formData.ket_obat || null }).eq('obat_id', formData.obat_id);
			if (error) toast.error(`Gagal mengupdate: ${error.message}`); else toast.success('Data obat berhasil diupdate');
		} else {
			const { error } = await supabase.from('obat').insert({ obat_id: formData.obat_id, obat_nama: formData.obat_nama, jenis_id: formData.jenis_id, ket_obat: formData.ket_obat || null, isActive: 1 });
			if (error) toast.error(`Gagal menyimpan: ${error.message}`); else { toast.success(`Data obat ${formData.obat_id} berhasil ditambahkan`); showSheet = false; currentPage = 1; await loadData(); }
		}
		saving = false;
		if (isEditing) { showSheet = false; await loadData(); }
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase.from('obat').delete().eq('obat_id', deleteTarget.obat_id);
		if (error) toast.error(`Gagal menghapus: ${error.message}`); else { toast.success('Data obat berhasil dihapus'); await loadData(); }
		showDeleteConfirm = false; deleteTarget = null;
	}

	onMount(async () => { await loadJenis(); await loadData(); });
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<Pill class="w-6 h-6 text-teal-600" />
				Master Obat
			</h2>
			<p class="text-xs text-slate-500 mt-1">Kelola data produk obat-obatan apotek</p>
		</div>

		<Button onclick={openAdd}>
			<Plus class="w-4 h-4 mr-2" /> Tambah Obat
		</Button>
	</div>

	<!-- Toolbar & Filters -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-3 flex-1">
			<div class="relative min-w-[240px] max-w-xs">
				<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
				<Input
					type="search"
					placeholder="Cari nama atau kode..."
					bind:value={searchQuery}
					oninput={handleSearch}
					class="pl-9"
				/>
			</div>

			<Select
				bind:value={filterMode}
				onValueChange={() => { currentPage = 1; loadData(); }}
				options={[
					{ value: 'semua', label: 'Semua Status' },
					{ value: 'aktif', label: 'Status: Aktif' },
					{ value: 'nonaktif', label: 'Status: Nonaktif' },
					{ value: 'bisa_hapus', label: 'Bisa Dihapus' },
					{ value: 'ada_transaksi', label: 'Ada Transaksi' }
				]}
				class="w-40"
			/>

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
				<TableHead class="w-24">Status</TableHead>
				<TableHead>Keterangan</TableHead>
				<TableHead class="w-36 text-right">Aksi</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#if loading}
				{#each Array(6) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-16" /></TableCell>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-24" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16" /></TableCell>
						<TableCell><Skeleton class="h-5 w-32" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20 ml-auto" /></TableCell>
					</TableRow>
				{/each}
			{:else if getDisplayData().length === 0}
				<TableRow>
					<TableCell colspan={6} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada data obat ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each getDisplayData() as item}
					<TableRow class={item.isActive === 0 ? 'opacity-60 bg-slate-50/50' : ''}>
						<TableCell>
							<Badge variant="secondary" class="font-mono text-xs text-purple-700 bg-purple-50">{item.obat_id}</Badge>
						</TableCell>
						<TableCell class="font-semibold text-slate-900 text-xs">
							<span class={item.isActive === 0 ? 'line-through text-slate-400' : ''}>{item.obat_nama}</span>
						</TableCell>
						<TableCell>
							<Badge variant="outline" class="text-[11px] font-normal">{getJenisNama(item.jenis_id)}</Badge>
						</TableCell>
						<TableCell>
							{#if item.isActive === 1}
								<Badge variant="success" class="text-[10px]">Aktif</Badge>
							{:else}
								<Badge variant="destructive" class="text-[10px]">Nonaktif</Badge>
							{/if}
						</TableCell>
						<TableCell class="text-xs text-slate-500 truncate max-w-xs">{item.ket_obat || '—'}</TableCell>
						<TableCell class="text-right">
							<div class="flex items-center justify-end gap-1">
								<Button variant="ghost" size="icon" class="h-7 w-7 text-slate-600 hover:text-teal-600" title="Edit" onclick={() => openEdit(item)}>
									<Edit2 class="w-3.5 h-3.5" />
								</Button>

								{#if hasTransactions.has(item.obat_id)}
									{#if item.isActive === 1}
										<Button variant="outline" size="sm" class="h-7 text-[10px] text-amber-700 hover:bg-amber-50" onclick={() => setActive(item, 0)}>
											<Pause class="w-3 h-3 mr-1" /> Nonaktifkan
										</Button>
									{:else}
										<Button variant="outline" size="sm" class="h-7 text-[10px] text-emerald-700 hover:bg-emerald-50" onclick={() => setActive(item, 1)}>
											<Play class="w-3 h-3 mr-1" /> Aktifkan
										</Button>
									{/if}
								{:else}
									{#if item.isActive === 0}
										<Button variant="outline" size="sm" class="h-7 text-[10px] text-emerald-700 hover:bg-emerald-50" onclick={() => setActive(item, 1)}>
											<Play class="w-3 h-3 mr-1" /> Aktifkan
										</Button>
									{/if}
									<Button variant="ghost" size="icon" class="h-7 w-7 text-slate-400 hover:text-red-600" title="Hapus" onclick={() => confirmDelete(item)}>
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

<!-- Slide-in Form Sheet -->
<Sheet
	bind:open={showSheet}
	title={isEditing ? 'Edit Master Obat' : 'Tambah Master Obat'}
	description="Kelola informasi obat dan kategori."
>
	<div class="space-y-4 pt-2">
		<div class="space-y-1.5">
			<label for="obat-id" class="text-xs font-semibold text-slate-700">Kode Obat</label>
			<Input id="obat-id" value={formData.obat_id || 'Akan dibuat otomatis'} disabled class="font-mono bg-slate-50" />
		</div>
		<div class="space-y-1.5">
			<label for="obat-nama" class="text-xs font-semibold text-slate-700">Nama Obat</label>
			<Input id="obat-nama" bind:value={formData.obat_nama} oninput={scheduleObatId} placeholder="Contoh: Amoxicillin 500mg" />
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
		<div class="space-y-1.5">
			<label for="ket-obat" class="text-xs font-semibold text-slate-700">Keterangan (Opsional)</label>
			<textarea
				id="ket-obat"
				bind:value={formData.ket_obat}
				rows="3"
				class="w-full p-3 rounded-md border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-1 focus:ring-teal-600 resize-y"
			></textarea>
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showSheet = false)}>Batal</Button>
		<Button size="sm" onclick={handleSave} disabled={saving}>
			{#if saving}Menyimpan...{:else}<Save class="w-3.5 h-3.5 mr-1" /> Simpan{/if}
		</Button>
	{/snippet}
</Sheet>

<!-- AlertDialog Delete -->
<AlertDialog
	bind:open={showDeleteConfirm}
	title="Hapus Master Obat"
	description={`Apakah Anda yakin ingin menghapus permanen obat "${deleteTarget?.obat_nama}"?`}
	onConfirm={handleDelete}
/>
