<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ijenis_obat } from '$lib/db/types';

	let data = $state<Ijenis_obat[]>([]);
	let filtered = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);

	// Modal state
	let showModal = $state(false);
	let isEditing = $state(false);
	let formData = $state<Ijenis_obat>({ jenis_id: '', jenis_nama: '' });
	let saving = $state(false);

	// Toast
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Ijenis_obat | null>(null);

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg;
		toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 3000);
	}

	async function loadData() {
		loading = true;
		const { data: result, error } = await supabase
			.from('jenis_obat')
			.select('*')
			.order('jenis_id');
		if (error) {
			showToast('Gagal memuat data: ' + error.message, 'error');
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
		showModal = true;
	}

	function openEdit(item: Ijenis_obat) {
		isEditing = true;
		formData = { ...item };
		showModal = true;
	}

	function confirmDelete(item: Ijenis_obat) {
		deleteTarget = item;
		showDeleteConfirm = true;
	}

	async function handleSave() {
		if (!formData.jenis_id.trim() || !formData.jenis_nama.trim()) {
			showToast('Semua field wajib diisi!', 'error');
			return;
		}
		saving = true;
		if (isEditing) {
			const { error } = await supabase
				.from('jenis_obat')
				.update({ jenis_nama: formData.jenis_nama })
				.eq('jenis_id', formData.jenis_id);
			if (error) {
				showToast('Gagal mengupdate: ' + error.message, 'error');
			} else {
				showToast('Data berhasil diupdate');
			}
		} else {
			const { error } = await supabase.from('jenis_obat').insert([formData]);
			if (error) {
				showToast('Gagal menyimpan: ' + error.message, 'error');
			} else {
				showToast('Data berhasil ditambahkan');
			}
		}
		saving = false;
		showModal = false;
		await loadData();
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase
			.from('jenis_obat')
			.delete()
			.eq('jenis_id', deleteTarget.jenis_id);
		if (error) {
			showToast('Gagal menghapus: ' + error.message, 'error');
		} else {
			showToast('Data berhasil dihapus');
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

<div class="page-header">
	<h1>🏷️ Master Jenis Obat</h1>
	<p>Kelola kategori dan jenis obat</p>
</div>

<div class="crud-toolbar">
	<div class="search-box">
		<span class="search-icon">🔍</span>
		<input type="text" placeholder="Cari jenis obat..." bind:value={searchQuery} />
	</div>
	<button class="btn btn-primary" onclick={openAdd}>+ Tambah Jenis</button>
</div>

<div class="data-table-wrapper">
	<table class="data-table">
		<thead>
			<tr>
				<th style="width: 120px;">Kode</th>
				<th>Nama Jenis Obat</th>
				<th style="width: 100px;">Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#if loading}
				<tr>
					<td colspan="3" class="table-empty">
						<div>Memuat data...</div>
					</td>
				</tr>
			{:else if filtered.length === 0}
				<tr>
					<td colspan="3" class="table-empty">
						<div class="empty-icon">📭</div>
						<div>Tidak ada data ditemukan</div>
					</td>
				</tr>
			{:else}
				{#each filtered as item}
					<tr>
						<td><code style="background: var(--color-primary-50); padding: 2px 8px; border-radius: 4px; font-size: 0.82rem; color: var(--color-primary-dark);">{item.jenis_id}</code></td>
						<td>{item.jenis_nama}</td>
						<td>
							<div class="table-actions">
								<button class="btn btn-ghost btn-sm" title="Edit" onclick={() => openEdit(item)}>✏️</button>
								<button class="btn btn-danger-ghost btn-sm" title="Hapus" onclick={() => confirmDelete(item)}>🗑️</button>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<!-- Add/Edit Modal -->
{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={() => (showModal = false)}>
		<div class="modal-box" onclick={(e) => e.stopPropagation()}>
			<h2>{isEditing ? 'Edit Jenis Obat' : 'Tambah Jenis Obat'}</h2>
			<div class="form-group">
				<label for="jenis_id">Kode Jenis</label>
				<input id="jenis_id" type="text" bind:value={formData.jenis_id} disabled={isEditing} placeholder="Contoh: JO01" />
			</div>
			<div class="form-group">
				<label for="jenis_nama">Nama Jenis Obat</label>
				<input id="jenis_nama" type="text" bind:value={formData.jenis_nama} placeholder="Contoh: Tablet" />
			</div>
			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (showModal = false)}>Batal</button>
				<button class="btn btn-primary" onclick={handleSave} disabled={saving}>
					{saving ? 'Menyimpan...' : 'Simpan'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={() => (showDeleteConfirm = false)}>
		<div class="modal-box" onclick={(e) => e.stopPropagation()}>
			<h2>Konfirmasi Hapus</h2>
			<p style="color: var(--color-text-secondary); line-height: 1.6;">
				Apakah Anda yakin ingin menghapus jenis obat
				<strong>"{deleteTarget?.jenis_nama}"</strong>?
				Tindakan ini tidak dapat dibatalkan.
			</p>
			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Batal</button>
				<button class="btn" style="background: var(--color-danger); color: white;" onclick={handleDelete}>Hapus</button>
			</div>
		</div>
	</div>
{/if}

<!-- Toast -->
{#if toastMsg}
	<div class="toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">
		{toastMsg}
	</div>
{/if}
