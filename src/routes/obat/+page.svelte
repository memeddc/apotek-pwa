<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat, Ijenis_obat } from '$lib/db/types';

	let data = $state<Iobat[]>([]);
	let jenisObatList = $state<Ijenis_obat[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);
	let currentPage = $state(1);
	let pageSize = $state(100);
	let totalCount = $state(0);
	let showModal = $state(false);
	let isEditing = $state(false);
	let formData = $state<Iobat>({ obat_id: '', obat_nama: '', jenis_id: '', ket_obat: '', isActive: 1 });
	let saving = $state(false);
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;
	let searchTimer: ReturnType<typeof setTimeout>;
	let idTimer: ReturnType<typeof setTimeout>;
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<Iobat | null>(null);
	let hasTransactions = $state<Set<string>>(new Set());
	let filterMode = $state<'semua' | 'aktif' | 'nonaktif' | 'bisa_hapus' | 'ada_transaksi'>('semua');

	function showToast(msg: string, type: 'success' | 'error' = 'success') { toastMsg = msg; toastType = type; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toastMsg = ''), 3000); }
	function totalPages(): number { return Math.max(1, Math.ceil(totalCount / pageSize)); }
	function getJenisNama(jenisId: string): string { return jenisObatList.find((j) => j.jenis_id === jenisId)?.jenis_nama ?? jenisId; }

	async function loadJenis() {
		const { data: result, error } = await supabase.from('jenis_obat').select('*').order('jenis_id');
		if (error) showToast(`Gagal memuat jenis obat: ${error.message}`, 'error');
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
		if (error) { showToast(`Gagal memuat data obat: ${error.message}`, 'error'); data = []; totalCount = 0; }
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
		if (error) { showToast(`Gagal membuat kode obat: ${error.message}`, 'error'); return; }
		const lastId = existing?.[0]?.obat_id ?? '';
		const lastNumber = Number(lastId.slice(prefix.length)) || 0;
		formData.obat_id = `${prefix}${String(lastNumber + 1).padStart(5, '0')}`;
	}
	function scheduleObatId() { clearTimeout(idTimer); idTimer = setTimeout(generateObatId, 300); }

	function openAdd() { isEditing = false; formData = { obat_id: '', obat_nama: '', jenis_id: jenisObatList[0]?.jenis_id ?? '', ket_obat: '', isActive: 1 }; showModal = true; }
	function openEdit(item: Iobat) { isEditing = true; formData = { ...item }; showModal = true; }
	function confirmDelete(item: Iobat) { deleteTarget = item; showDeleteConfirm = true; }

	async function setActive(item: Iobat, isActive: 0 | 1) {
		const { error } = await supabase.from('obat').update({ isActive }).eq('obat_id', item.obat_id);
		if (error) showToast(`Gagal mengubah status: ${error.message}`, 'error'); else { showToast(isActive ? 'Obat diaktifkan' : 'Obat dinonaktifkan'); await loadData(); }
	}

	async function handleSave() {
		if (!formData.obat_nama.trim() || !formData.jenis_id.trim()) { showToast('Nama dan jenis obat wajib diisi.', 'error'); return; }
		if (!isEditing) await generateObatId();
		if (!formData.obat_id) { showToast('Kode obat belum dapat dibuat.', 'error'); return; }
		saving = true;
		if (isEditing) {
			const { error } = await supabase.from('obat').update({ obat_nama: formData.obat_nama, jenis_id: formData.jenis_id, ket_obat: formData.ket_obat || null }).eq('obat_id', formData.obat_id);
			if (error) showToast(`Gagal mengupdate: ${error.message}`, 'error'); else showToast('Data obat berhasil diupdate');
		} else {
			const { error } = await supabase.from('obat').insert({ obat_id: formData.obat_id, obat_nama: formData.obat_nama, jenis_id: formData.jenis_id, ket_obat: formData.ket_obat || null, isActive: 1 });
			if (error) showToast(`Gagal menyimpan: ${error.message}`, 'error'); else { showToast(`Data obat ${formData.obat_id} berhasil ditambahkan`); showModal = false; currentPage = 1; await loadData(); }
		}
		saving = false;
		if (isEditing) { showModal = false; await loadData(); }
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		const { error } = await supabase.from('obat').delete().eq('obat_id', deleteTarget.obat_id);
		if (error) showToast(`Gagal menghapus: ${error.message}`, 'error'); else { showToast('Data obat berhasil dihapus'); await loadData(); }
		showDeleteConfirm = false; deleteTarget = null;
	}

	onMount(async () => { await loadJenis(); await loadData(); });
</script>

<div class="page-header"><h1>Master Obat</h1><p>Kelola data obat-obatan apotek.</p></div>
<div class="crud-toolbar">
	<div class="search-box"><span class="search-icon">⌕</span><input type="search" placeholder="Cari nama atau kode obat..." bind:value={searchQuery} oninput={handleSearch} /></div>
	<div class="filter-group">
		<select class="filter-select" bind:value={filterMode} onchange={handleFilterChange}>
			<option value="semua">📋 Semua</option>
			<option value="aktif">✅ Aktif</option>
			<option value="nonaktif">⏸️ Nonaktif</option>
			<option value="bisa_hapus">🗑️ Bisa Dihapus</option>
			<option value="ada_transaksi">🔒 Ada Transaksi</option>
		</select>
	</div>
	<div class="page-size"><label for="page-size">Tampil</label><select id="page-size" value={pageSize} onchange={changePageSize}><option value="100">100</option><option value="500">500</option><option value="1000">1000</option></select></div>
	<button class="btn btn-primary" onclick={openAdd}>+ Tambah Obat</button>
</div>

<div class="data-table-wrapper">
	<table class="data-table obat-table">
		<thead>
			<tr><th>Kode</th><th>Nama Obat</th><th>Jenis</th><th>Status</th><th>Keterangan</th><th>Aksi</th></tr>
		</thead>
		<tbody>
			{#if loading}
				<tr><td colspan="6" class="table-empty">Memuat data...</td></tr>
			{:else if getDisplayData().length === 0}
				<tr><td colspan="6" class="table-empty">Tidak ada data ditemukan</td></tr>
			{:else}
				{#each getDisplayData() as item}
					<tr class:inactive-row={item.isActive === 0}>
						<td><code class="obat-code">{item.obat_id}</code></td>
						<td><strong class:nama-inactive={item.isActive === 0}>{item.obat_nama}</strong></td>
						<td><span class="jenis-badge">{getJenisNama(item.jenis_id)}</span></td>
						<td>
							<span class="status-badge" class:status-active={item.isActive === 1} class:status-inactive={item.isActive === 0}>
								<span class="status-dot"></span>
								{item.isActive === 1 ? 'Aktif' : 'Nonaktif'}
							</span>
						</td>
						<td class="ket-col">{item.ket_obat || '—'}</td>
						<td>
							<div class="table-actions">
								<button class="btn btn-ghost btn-sm" title="Edit" onclick={() => openEdit(item)}>✏️</button>
								{#if hasTransactions.has(item.obat_id)}
									{#if item.isActive === 1}
										<button class="btn btn-deactivate btn-sm" onclick={() => setActive(item, 0)}>⏸️ Nonaktifkan</button>
									{:else}
										<button class="btn btn-activate btn-sm" onclick={() => setActive(item, 1)}>▶️ Aktifkan</button>
									{/if}
								{:else}
									{#if item.isActive === 0}
										<button class="btn btn-activate btn-sm" onclick={() => setActive(item, 1)}>▶️ Aktifkan</button>
									{/if}
									<button class="btn btn-danger-ghost btn-sm" title="Hapus permanen" onclick={() => confirmDelete(item)}>🗑️</button>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<div class="pagination">
	<span>{totalCount.toLocaleString('id-ID')} obat · Halaman {currentPage} dari {totalPages()}{filterMode !== 'semua' ? ` · Filter: ${filterMode}` : ''}</span>
	<div>
		<button class="btn btn-ghost" disabled={loading || currentPage === 1} onclick={previousPage}>Sebelumnya</button>
		<button class="btn btn-ghost" disabled={loading || currentPage === totalPages()} onclick={nextPage}>Berikutnya</button>
	</div>
</div>

{#if showModal}
	<div class="modal-overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showModal = false; }}>
		<div class="modal-box" role="dialog" aria-modal="true" tabindex="-1">
			<h2>{isEditing ? 'Edit Obat' : 'Tambah Obat'}</h2>
			<div class="form-group"><label for="obat-id">Kode Obat</label><input id="obat-id" value={formData.obat_id || 'Akan dibuat otomatis'} disabled /></div>
			<div class="form-group"><label for="obat-nama">Nama Obat</label><input id="obat-nama" bind:value={formData.obat_nama} oninput={scheduleObatId} placeholder="Contoh: Panadol" /></div>
			<div class="form-group"><label for="jenis-id">Jenis Obat</label><select id="jenis-id" bind:value={formData.jenis_id}>{#each jenisObatList as jenis}<option value={jenis.jenis_id}>{jenis.jenis_nama}</option>{/each}</select></div>
			<div class="form-group"><label for="ket-obat">Keterangan (opsional)</label><textarea id="ket-obat" bind:value={formData.ket_obat}></textarea></div>
			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (showModal = false)}>Batal</button>
				<button class="btn btn-primary" onclick={handleSave} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteConfirm}
	<div class="modal-overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showDeleteConfirm = false; }}>
		<div class="modal-box" role="dialog" aria-modal="true" tabindex="-1">
			<div class="delete-modal-header"><span class="delete-icon">🗑️</span><h2>Konfirmasi Hapus</h2></div>
			<p class="delete-msg">Hapus obat <strong>{deleteTarget?.obat_nama}</strong> secara permanen? Tindakan ini tidak dapat dibatalkan.</p>
			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (showDeleteConfirm = false)}>Batal</button>
				<button class="btn btn-delete" onclick={handleDelete}>🗑️ Hapus Permanen</button>
			</div>
		</div>
	</div>
{/if}

{#if toastMsg}<div class="toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">{toastMsg}</div>{/if}

<style>
	.page-size { display: flex; align-items: center; gap: .4rem; color: var(--color-text-secondary); font-size: .85rem; }
	.page-size select, .filter-select { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-sm); font: inherit; background: var(--color-surface); }
	.filter-select { font-size: .88rem; cursor: pointer; }
	.obat-table { min-width: 930px; }
	.obat-code { background: #ede9fe; padding: 2px 8px; border-radius: 4px; color: #6d28d9; font-size: .82rem; }
	.jenis-badge { background: var(--color-primary-50); color: var(--color-primary-dark); padding: 2px 10px; border-radius: 12px; font-size: .8rem; font-weight: 500; }
	.status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 12px; border-radius: 20px; font-size: .78rem; font-weight: 600; }
	.status-dot { width: 7px; height: 7px; border-radius: 50%; }
	.status-active { background: var(--color-success-light); color: var(--color-success); }
	.status-active .status-dot { background: var(--color-success); box-shadow: 0 0 4px var(--color-success); }
	.status-inactive { background: var(--color-danger-light); color: var(--color-danger); }
	.status-inactive .status-dot { background: var(--color-danger); }
	.btn-deactivate { background: var(--color-warning-light); color: #92400e; border: 1px solid #fde68a; font-weight: 500; }
	.btn-deactivate:hover { background: #fde68a; }
	.btn-activate { background: var(--color-success-light); color: var(--color-success); border: 1px solid #a7f3d0; font-weight: 500; }
	.btn-activate:hover { background: #a7f3d0; }
	.inactive-row { opacity: .55; }
	.nama-inactive { text-decoration: line-through; text-decoration-color: var(--color-text-muted); }
	.ket-col { color: var(--color-text-secondary); font-size: .85rem; }
	.pagination { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); margin-top: var(--space-md); color: var(--color-text-secondary); font-size: .85rem; }
	.pagination div { display: flex; gap: var(--space-xs); }
	.delete-modal-header { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md); }
	.delete-modal-header h2 { margin: 0; }
	.delete-icon { font-size: 1.5rem; }
	.delete-msg { color: var(--color-text-secondary); line-height: 1.6; }
	.btn-delete { background: var(--color-danger); color: white; }
	.btn-delete:hover { background: #dc2626; }
	@media (max-width: 600px) { .pagination { align-items: flex-start; flex-direction: column; } .crud-toolbar { flex-direction: column; align-items: stretch; } }
</style>
