<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ijenis_obat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { AlertDialog } from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PageHeader } from '$lib/components/ui/page-header';
	import { DataToolbar } from '$lib/components/ui/data-toolbar';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Plus, Edit2, Trash2, Save, SearchX, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';

	let data = $state<Ijenis_obat[]>([]);
	let filtered = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);

	// Pagination & Sorting states
	let currentPage = $state(1);
	let pageSize = $state(25);
	let sortField = $state<'jenis_id' | 'jenis_nama'>('jenis_id');
	let sortOrder = $state<'asc' | 'desc'>('asc');

	// Derived sorted and paginated data
	let sortedData = $derived(
		[...filtered].sort((a, b) => {
			const valA = a[sortField]?.toLowerCase() || '';
			const valB = b[sortField]?.toLowerCase() || '';
			if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
			if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
			return 0;
		})
	);

	let pagedData = $derived(
		sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	// Sheet state
	let showSheet = $state(false);
	let isEditing = $state(false);
	let formData = $state<Ijenis_obat>({ jenis_id: '', jenis_nama: '' });
	let saving = $state(false);

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Ijenis_obat | null>(null);

	async function loadData() {
		loading = true;
		const { data: result, error } = await supabase
			.from('jenis_obat')
			.select('*')
			.order('jenis_id');
		if (error) {
			toast.error('Gagal memuat data: ' + error.message);
		} else {
			data = result ?? [];
		}
		loading = false;
		applyFilter();
	}

	function applyFilter() {
		const q = searchQuery.toLowerCase().trim();
		filtered = data.filter(
			(d) => d.jenis_id.toLowerCase().includes(q) || d.jenis_nama.toLowerCase().includes(q)
		);
		currentPage = 1;
	}

	function toggleSort(field: 'jenis_id' | 'jenis_nama') {
		if (sortField === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortOrder = 'asc';
		}
	}

	function openAdd() {
		isEditing = false;
		formData = { jenis_id: '', jenis_nama: '' };
		showSheet = true;
	}

	function openEdit(item: Ijenis_obat) {
		isEditing = true;
		formData = { ...item };
		showSheet = true;
	}

	function confirmDelete(item: Ijenis_obat) {
		deleteTarget = item;
		showDeleteConfirm = true;
	}

	async function handleSave() {
		if (!formData.jenis_id.trim() || !formData.jenis_nama.trim()) {
			toast.error('Semua field wajib diisi!');
			return;
		}
		saving = true;
		if (isEditing) {
			const { error } = await supabase
				.from('jenis_obat')
				.update({ jenis_nama: formData.jenis_nama })
				.eq('jenis_id', formData.jenis_id);
			if (error) {
				toast.error('Gagal mengupdate: ' + error.message);
			} else {
				toast.success('Data jenis obat berhasil diupdate');
			}
		} else {
			const { error } = await supabase.from('jenis_obat').insert([formData]);
			if (error) {
				toast.error('Gagal menyimpan: ' + error.message);
			} else {
				toast.success('Data jenis obat berhasil ditambahkan');
			}
		}
		saving = false;
		showSheet = false;
		await loadData();
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase
			.from('jenis_obat')
			.delete()
			.eq('jenis_id', deleteTarget.jenis_id);
		if (error) {
			toast.error('Gagal menghapus: ' + error.message);
		} else {
			toast.success('Data jenis obat berhasil dihapus');
		}
		showDeleteConfirm = false;
		deleteTarget = null;
		await loadData();
	}

	$effect(() => {
		searchQuery;
		applyFilter();
	});

	onMount(loadData);
</script>

<div class="space-y-4">
	<!-- Page Header -->
	<PageHeader
		title="Master Jenis Obat"
		description="Kelola kategori dan pengelompokan jenis obat yang tersedia di apotek"
		badge={`${data.length} Kategori`}
	>
		{#snippet actions()}
			<Button onclick={openAdd} class="bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-xl gap-2 shadow-xs cursor-pointer">
				<Plus class="w-4 h-4" /> Tambah Jenis
			</Button>
		{/snippet}
	</PageHeader>

	<!-- Data Toolbar -->
	<DataToolbar
		searchPlaceholder="Cari kode atau nama jenis obat..."
		bind:searchValue={searchQuery}
		onSearchInput={applyFilter}
		totalItems={data.length}
		filteredCount={filtered.length}
		itemLabel="kategori"
	/>

	<!-- Data Table Container -->
	<div class="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
		<Table class="table-compact table-striped">
			<TableHeader class="bg-slate-50/80 border-b border-slate-200/80">
				<TableRow class="hover:bg-transparent">
					<TableHead class="w-36 font-semibold text-slate-700">
						<button type="button" onclick={() => toggleSort('jenis_id')} class="flex items-center gap-1.5 hover:text-mint-600 cursor-pointer font-bold text-xs">
							Kode Jenis
							{#if sortField === 'jenis_id'}
								{#if sortOrder === 'asc'}<ArrowUp class="w-3.5 h-3.5 text-mint-600" />{:else}<ArrowDown class="w-3.5 h-3.5 text-mint-600" />{/if}
							{:else}
								<ArrowUpDown class="w-3 h-3 text-slate-400" />
							{/if}
						</button>
					</TableHead>
					<TableHead class="font-semibold text-slate-700">
						<button type="button" onclick={() => toggleSort('jenis_nama')} class="flex items-center gap-1.5 hover:text-mint-600 cursor-pointer font-bold text-xs">
							Nama Jenis Obat
							{#if sortField === 'jenis_nama'}
								{#if sortOrder === 'asc'}<ArrowUp class="w-3.5 h-3.5 text-mint-600" />{:else}<ArrowDown class="w-3.5 h-3.5 text-mint-600" />{/if}
							{:else}
								<ArrowUpDown class="w-3 h-3 text-slate-400" />
							{/if}
						</button>
					</TableHead>
					<TableHead class="w-24 text-right font-bold text-slate-700">Aksi</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					{#each Array(5) as _}
						<TableRow>
							<TableCell><Skeleton class="h-5 w-16" /></TableCell>
							<TableCell><Skeleton class="h-5 w-48" /></TableCell>
							<TableCell><Skeleton class="h-5 w-16 ml-auto" /></TableCell>
						</TableRow>
					{/each}
				{:else if filtered.length === 0}
					<TableRow>
						<TableCell colspan={3} class="text-center py-12 text-slate-400">
							<div class="flex flex-col items-center justify-center gap-2">
								<SearchX class="w-8 h-8 text-slate-300" />
								<p class="text-xs font-semibold text-slate-600">Tidak ada jenis obat ditemukan</p>
								<p class="text-[11px] text-slate-400">Coba ubah kata kunci pencarian Anda.</p>
							</div>
						</TableCell>
					</TableRow>
				{:else}
					{#each pagedData as item}
						<TableRow class="transition-colors">
							<TableCell>
								<Badge variant="secondary" class="font-mono text-xs text-mint-700 bg-mint-50 border-mint-100">{item.jenis_id}</Badge>
							</TableCell>
							<TableCell class="font-medium text-slate-800 text-xs">{item.jenis_nama}</TableCell>
							<TableCell class="text-right">
								<div class="flex items-center justify-end gap-1">
									<Button variant="ghost" size="icon" class="h-7 w-7 text-slate-600 hover:text-mint-600 cursor-pointer" onclick={() => openEdit(item)}>
										<Edit2 class="w-3.5 h-3.5" />
									</Button>
									<Button variant="ghost" size="icon" class="h-7 w-7 text-slate-400 hover:text-rose-600 cursor-pointer" onclick={() => confirmDelete(item)}>
										<Trash2 class="w-3.5 h-3.5" />
									</Button>
								</div>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>

		<!-- Pagination Footer -->
		{#if !loading && filtered.length > 0}
			<Pagination
				currentPage={currentPage}
				totalItems={filtered.length}
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

<!-- Slide-in Sheet Panel Form -->
<Sheet
	bind:open={showSheet}
	title={isEditing ? 'Edit Jenis Obat' : 'Tambah Jenis Obat'}
	description="Isi rincian kode dan nama jenis obat."
>
	<div class="space-y-4 pt-2">
		<div class="space-y-1.5">
			<label for="jenis_id" class="text-xs font-semibold text-slate-700">Kode Jenis</label>
			<Input id="jenis_id" type="text" bind:value={formData.jenis_id} disabled={isEditing} placeholder="Contoh: JO01" />
		</div>
		<div class="space-y-1.5">
			<label for="jenis_nama" class="text-xs font-semibold text-slate-700">Nama Jenis Obat</label>
			<Input id="jenis_nama" type="text" bind:value={formData.jenis_nama} placeholder="Contoh: Tablet" />
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showSheet = false)}>Batal</Button>
		<Button size="sm" onclick={handleSave} disabled={saving} class="bg-mint-500 hover:bg-mint-600 text-white font-bold">
			{#if saving}Menyimpan...{:else}<Save class="w-3.5 h-3.5 mr-1" /> Simpan{/if}
		</Button>
	{/snippet}
</Sheet>

<!-- AlertDialog Delete -->
<AlertDialog
	bind:open={showDeleteConfirm}
	title="Hapus Jenis Obat"
	description={`Apakah Anda yakin ingin menghapus jenis obat "${deleteTarget?.jenis_nama}"?`}
	onConfirm={handleDelete}
/>


