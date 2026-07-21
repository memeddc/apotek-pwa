<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ipbf } from '$lib/db/types';

	let data = $state<Ipbf[]>([]);
	let filtered = $state<Ipbf[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);

	// Modal state
	let showModal = $state(false);
	let isEditing = $state(false);
	let formData = $state<Ipbf>({ pbf_id: '', pbf_nama: '', no_telp: '', alamat: '' });
	let saving = $state(false);
	let idTimer: ReturnType<typeof setTimeout>;

	// Toast
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Ipbf | null>(null);

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg;
		toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 3000);
	}

	async function loadData() {
		loading = true;
		const { data: result, error } = await supabase
			.from('pbf')
			.select('*')
			.order('pbf_id');
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
		showModal = true;
	}

	function pbfPrefix(name: string): string {
		return name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'X');
	}

	async function generatePbfId() {
		if (isEditing || !formData.pbf_nama.trim()) return;
		const prefix = pbfPrefix(formData.pbf_nama);
		const { data: existing, error } = await supabase.from('pbf').select('pbf_id').like('pbf_id', `${prefix}%`).order('pbf_id', { ascending: false }).limit(1);
		if (error) { showToast('Gagal membuat kode PBF: ' + error.message, 'error'); return; }
		const lastId = existing?.[0]?.pbf_id ?? '';
		const lastNumber = Number(lastId.slice(prefix.length)) || 0;
		formData.pbf_id = `${prefix}${lastNumber + 1}`;
	}

	function schedulePbfId() { clearTimeout(idTimer); idTimer = setTimeout(generatePbfId, 300); }

	function openEdit(item: Ipbf) {
		isEditing = true;
		formData = { ...item };
		showModal = true;
	}

	function confirmDelete(item: Ipbf) {
		deleteTarget = item;
		showDeleteConfirm = true;
	}

	async function handleSave() {
		if (!formData.pbf_nama.trim()) {
			showToast('Nama PBF wajib diisi!', 'error');
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
				showToast('Gagal mengupdate: ' + error.message, 'error');
			} else {
				showToast('Data PBF berhasil diupdate');
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
				showToast('Gagal menyimpan: ' + error.message, 'error');
			} else {
				showToast('Data PBF berhasil ditambahkan');
			}
		}
		saving = false;
		showModal = false;
		await loadData();
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase
			.from('pbf')
			.delete()
			.eq('pbf_id', deleteTarget.pbf_id);
		if (error) {
			showToast('Gagal menghapus: ' + error.message, 'error');
		} else {
			showToast('Data PBF berhasil dihapus');
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
	<h1>🏢 Master PBF / Supplier</h1>
	<p>Kelola data Pedagang Besar Farmasi</p>
</div>

<div class="crud-toolbar">
	<div class="search-box">
		<span class="search-icon">🔍</span>
		<input type="text" placeholder="Cari PBF / Supplier..." bind:value={searchQuery} />
	</div>
	<button class="btn btn-primary" onclick={openAdd}>+ Tambah PBF</button>
</div>

<div class="data-table-wrapper">
	<table class="data-table">
		<thead>
			<tr>
				<th style="width: 100px;">Kode</th>
				<th>Nama PBF</th>
				<th style="width: 150px;">No. Telp</th>
				<th>Alamat</th>
				<th style="width: 100px;">Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#if loading}
				<tr>
					<td colspan="5" class="table-empty">
						<div>Memuat data...</div>
					</td>
				</tr>
			{:else if filtered.length === 0}
				<tr>
					<td colspan="5" class="table-empty">
						<div class="empty-icon">📭</div>
						<div>Tidak ada data ditemukan</div>
					</td>
				</tr>
			{:else}
				{#each filtered as item}
					<tr>
						<td><code style="background: #fef3c7; padding: 2px 8px; border-radius: 4px; font-size: 0.82rem; color: #b45309;">{item.pbf_id}</code></td>
						<td><strong>{item.pbf_nama}</strong></td>
						<td style="font-size: 0.88rem;">{item.no_telp || '—'}</td>
						<td style="color: var(--color-text-secondary); font-size: 0.85rem;">{item.alamat || '—'}</td>
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
			<h2>{isEditing ? 'Edit PBF' : 'Tambah PBF'}</h2>
			<div class="form-group">
				<label for="pbf_id">Kode PBF</label>
				<input id="pbf_id" type="text" value={formData.pbf_id || 'Akan dibuat otomatis'} disabled />
			</div>
			<div class="form-group">
				<label for="pbf_nama">Nama PBF</label>
				<input id="pbf_nama" type="text" bind:value={formData.pbf_nama} oninput={schedulePbfId} placeholder="Contoh: PT. Kimia Farma" />
			</div>
			<div class="form-group">
				<label for="no_telp">No. Telepon (Opsional)</label>
				<input id="no_telp" type="text" bind:value={formData.no_telp} placeholder="Contoh: 021-1234567" />
			</div>
			<div class="form-group">
				<label for="alamat">Alamat (Opsional)</label>
				<textarea id="alamat" bind:value={formData.alamat} placeholder="Alamat lengkap PBF..."></textarea>
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
				Apakah Anda yakin ingin menghapus PBF
				<strong>"{deleteTarget?.pbf_nama}"</strong>?
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
