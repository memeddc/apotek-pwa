<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ipbf } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { AlertDialog } from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Building2, Plus, Search, Edit2, Trash2, Save, Phone, MapPin } from 'lucide-svelte';

	let data = $state<Ipbf[]>([]);
	let filtered = $state<Ipbf[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);

	// Sheet state
	let showSheet = $state(false);
	let isEditing = $state(false);
	let formData = $state<Ipbf>({ pbf_id: '', pbf_nama: '', no_telp: '', alamat: '' });
	let saving = $state(false);
	let idTimer: ReturnType<typeof setTimeout>;

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Ipbf | null>(null);

	async function loadData() {
		loading = true;
		const { data: result, error } = await supabase
			.from('pbf')
			.select('*')
			.order('pbf_id');
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
			(d) =>
				d.pbf_id.toLowerCase().includes(q) ||
				d.pbf_nama.toLowerCase().includes(q) ||
				(d.no_telp ?? '').toLowerCase().includes(q) ||
				(d.alamat ?? '').toLowerCase().includes(q)
		);
	}

	function openAdd() {
		isEditing = false;
		formData = { pbf_id: '', pbf_nama: '', no_telp: '', alamat: '' };
		showSheet = true;
	}

	function pbfPrefix(name: string): string {
		return name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
	}

	async function generatePbfId() {
		if (isEditing || !formData.pbf_nama.trim()) return;
		const prefix = pbfPrefix(formData.pbf_nama);
		const { data: existing, error } = await supabase.from('pbf').select('pbf_id').like('pbf_id', `${prefix}%`).order('pbf_id', { ascending: false }).limit(1);
		if (error) { toast.error('Gagal membuat kode PBF: ' + error.message); return; }
		const lastId = existing?.[0]?.pbf_id ?? '';
		const lastNumber = Number(lastId.slice(prefix.length)) || 0;
		formData.pbf_id = `${prefix}${lastNumber + 1}`;
	}

	function schedulePbfId() { clearTimeout(idTimer); idTimer = setTimeout(generatePbfId, 300); }

	function openEdit(item: Ipbf) {
		isEditing = true;
		formData = { ...item };
		showSheet = true;
	}

	function confirmDelete(item: Ipbf) {
		deleteTarget = item;
		showDeleteConfirm = true;
	}

	async function handleSave() {
		if (!formData.pbf_nama.trim()) {
			toast.error('Nama PBF wajib diisi!');
			return;
		}
		if (!isEditing) await generatePbfId();
		saving = true;
		if (isEditing) {
			const { error } = await supabase
				.from('pbf')
				.update({
					pbf_nama: formData.pbf_nama,
					no_telp: formData.no_telp || null,
					alamat: formData.alamat || null
				})
				.eq('pbf_id', formData.pbf_id);
			if (error) {
				toast.error('Gagal mengupdate: ' + error.message);
			} else {
				toast.success('Data PBF berhasil diupdate');
			}
		} else {
			const { error } = await supabase.from('pbf').insert([
				{
					pbf_id: formData.pbf_id,
					pbf_nama: formData.pbf_nama,
					no_telp: formData.no_telp || null,
					alamat: formData.alamat || null
				}
			]);
			if (error) {
				toast.error('Gagal menyimpan: ' + error.message);
			} else {
				toast.success('Data PBF berhasil ditambahkan');
			}
		}
		saving = false;
		showSheet = false;
		await loadData();
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase
			.from('pbf')
			.delete()
			.eq('pbf_id', deleteTarget.pbf_id);
		if (error) {
			toast.error('Gagal menghapus: ' + error.message);
		} else {
			toast.success('Data PBF berhasil dihapus');
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
				<Building2 class="w-6 h-6 text-teal-600" />
				Master PBF / Supplier
			</h2>
			<p class="text-xs text-slate-500 mt-1">Kelola data Pedagang Besar Farmasi pemasok obat</p>
		</div>

		<Button onclick={openAdd}>
			<Plus class="w-4 h-4 mr-2" /> Tambah PBF
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex items-center justify-between gap-4 max-w-sm">
		<div class="relative w-full">
			<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
			<Input
				type="text"
				placeholder="Cari PBF / Supplier..."
				bind:value={searchQuery}
				class="pl-9"
			/>
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-28">Kode</TableHead>
				<TableHead>Nama PBF / Supplier</TableHead>
				<TableHead>No. Telepon</TableHead>
				<TableHead>Alamat</TableHead>
				<TableHead class="w-24 text-right">Aksi</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#if loading}
				{#each Array(5) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-16" /></TableCell>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-24" /></TableCell>
						<TableCell><Skeleton class="h-5 w-48" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16 ml-auto" /></TableCell>
					</TableRow>
				{/each}
			{:else if filtered.length === 0}
				<TableRow>
					<TableCell colspan={5} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada PBF ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each filtered as item}
					<TableRow>
						<TableCell>
							<Badge variant="secondary" class="font-mono text-xs text-amber-700 bg-amber-50">{item.pbf_id}</Badge>
						</TableCell>
						<TableCell class="font-semibold text-slate-900 text-xs">{item.pbf_nama}</TableCell>
						<TableCell class="text-xs text-slate-600">
							{#if item.no_telp}
								<span class="flex items-center gap-1">
									<Phone class="w-3 h-3 text-slate-400" /> {item.no_telp}
								</span>
							{:else}
								—
							{/if}
						</TableCell>
						<TableCell class="text-xs text-slate-500 truncate max-w-xs">
							{#if item.alamat}
								<span class="flex items-center gap-1">
									<MapPin class="w-3 h-3 text-slate-400 shrink-0" /> {item.alamat}
								</span>
							{:else}
								—
							{/if}
						</TableCell>
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
	title={isEditing ? 'Edit PBF / Supplier' : 'Tambah PBF / Supplier'}
	description="Kelola informasi kontak dan alamat supplier."
>
	<div class="space-y-4 pt-2">
		<div class="space-y-1.5">
			<label for="pbf_id" class="text-xs font-semibold text-slate-700">Kode PBF</label>
			<Input id="pbf_id" type="text" value={formData.pbf_id || 'Akan dibuat otomatis'} disabled class="font-mono bg-slate-50" />
		</div>
		<div class="space-y-1.5">
			<label for="pbf_nama" class="text-xs font-semibold text-slate-700">Nama PBF</label>
			<Input id="pbf_nama" type="text" bind:value={formData.pbf_nama} oninput={schedulePbfId} placeholder="Contoh: PT. Kimia Farma" />
		</div>
		<div class="space-y-1.5">
			<label for="no_telp" class="text-xs font-semibold text-slate-700">No. Telepon (Opsional)</label>
			<Input id="no_telp" type="text" bind:value={formData.no_telp} placeholder="Contoh: 021-1234567" />
		</div>
		<div class="space-y-1.5">
			<label for="alamat" class="text-xs font-semibold text-slate-700">Alamat (Opsional)</label>
			<textarea
				id="alamat"
				bind:value={formData.alamat}
				rows="3"
				placeholder="Alamat lengkap PBF..."
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
	title="Hapus PBF / Supplier"
	description={`Apakah Anda yakin ingin menghapus PBF "${deleteTarget?.pbf_nama}"?`}
	onConfirm={handleDelete}
/>
