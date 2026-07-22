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
	import { Tag, Plus, Search, Edit2, Trash2, Save } from 'lucide-svelte';

	let data = $state<Ijenis_obat[]>([]);
	let filtered = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);

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
		const q = searchQuery.toLowerCase();
		filtered = data.filter(
			(d) => d.jenis_id.toLowerCase().includes(q) || d.jenis_nama.toLowerCase().includes(q)
		);
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

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<Tag class="w-6 h-6 text-teal-600" />
				Master Jenis Obat
			</h2>
			<p class="text-xs text-slate-500 mt-1">Kelola kategori dan jenis obat yang tersedia</p>
		</div>

		<Button onclick={openAdd}>
			<Plus class="w-4 h-4 mr-2" /> Tambah Jenis
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex items-center justify-between gap-4 max-w-sm">
		<div class="relative w-full">
			<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
			<Input
				type="text"
				placeholder="Cari jenis obat..."
				bind:value={searchQuery}
				class="pl-9"
			/>
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-32">Kode</TableHead>
				<TableHead>Nama Jenis Obat</TableHead>
				<TableHead class="w-24 text-right">Aksi</TableHead>
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
					<TableCell colspan={3} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada jenis obat ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each filtered as item}
					<TableRow>
						<TableCell>
							<Badge variant="secondary" class="font-mono text-xs">{item.jenis_id}</Badge>
						</TableCell>
						<TableCell class="font-medium text-slate-900 text-xs">{item.jenis_nama}</TableCell>
						<TableCell class="text-right">
							<div class="flex items-center justify-end gap-1">
								<Button variant="ghost" size="icon" class="h-8 w-8 text-slate-600 hover:text-teal-600" onclick={() => openEdit(item)}>
									<Edit2 class="w-3.5 h-3.5" />
								</Button>
								<Button variant="ghost" size="icon" class="h-8 w-8 text-slate-400 hover:text-red-600" onclick={() => confirmDelete(item)}>
									<Trash2 class="w-3.5 h-3.5" />
								</Button>
							</div>
						</TableCell>
					</TableRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
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
		<Button size="sm" onclick={handleSave} disabled={saving}>
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
