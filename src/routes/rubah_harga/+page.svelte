<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat } from '$lib/db/types';

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
	let totalCount = $state(0);
	let searchTimer: ReturnType<typeof setTimeout>;

	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	// Edit modal
	let showModal = $state(false);
	let editTarget = $state<StokRow | null>(null);
	let newHargaPbf = $state(0);
	let newHargaJual = $state(0);

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg; toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 4000);
	}

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
			showToast(`Gagal memuat data: ${obatError.message}`, 'error');
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
		showModal = true;
	}

	async function handleSave() {
		if (!editTarget) return;
		if (newHargaPbf < 0 || newHargaJual < 0) { showToast('Harga tidak boleh negatif.', 'error'); return; }

		saving = true;
		
		// Check if stok exists
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
			showToast(`Gagal menyimpan: ${error.message}`, 'error'); 
		} else {
			showToast(`Harga ${editTarget.obat_nama} berhasil diubah`);
			showModal = false;
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

<div class="page-header">
	<h1>💲 Rubah Harga</h1>
	<p>Ubah harga PBF dan harga jual obat</p>
</div>

<!-- Search & Pagination Top -->
<div class="crud-toolbar">
	<div class="search-box">
		<span class="search-icon">⌕</span>
		<input type="search" placeholder="Cari nama atau kode obat..." bind:value={searchQuery} oninput={handleSearch} />
	</div>
	<div class="page-size">
		<label for="page-size">Tampil</label>
		<select id="page-size" value={pageSize} onchange={changePageSize}>
			<option value="100">100</option>
			<option value="500">500</option>
			<option value="1000">1000</option>
		</select>
	</div>
	<button class="btn btn-ghost" onclick={loadData} disabled={loading}>🔄 Refresh</button>
</div>

<!-- Table -->
<div class="data-table-wrapper">
	<table class="data-table harga-table">
		<thead>
			<tr>
				<th>Kode</th>
				<th>Nama Obat</th>
				<th>Jenis</th>
				<th>Stok</th>
				<th>Harga PBF</th>
				<th>Harga Jual</th>
				<th>Margin</th>
				<th>Diskon</th>
				<th>Aksi</th>
			</tr>
		</thead>
		<tbody>
			{#if loading}
				<tr><td colspan="9" class="table-empty">Memuat data...</td></tr>
			{:else if stokList.length === 0}
				<tr><td colspan="9" class="table-empty">
					<div class="empty-icon">📭</div>
					<div>Tidak ada data ditemukan</div>
				</td></tr>
			{:else}
				{#each stokList as item}
					<tr>
						<td><code class="obat-code">{item.obat_id}</code></td>
						<td><strong>{item.obat_nama}</strong></td>
						<td><span class="jenis-badge">{item.jenis_nama}</span></td>
						<td class="td-center">{item.qty}</td>
						<td class="td-right">Rp{formatRp(item.harga_pbf)}</td>
						<td class="td-right"><strong>Rp{formatRp(item.harga_jual)}</strong></td>
						<td class="td-center">
							<span class="margin-badge" class:margin-good={selisih(item) >= 10} class:margin-low={selisih(item) > 0 && selisih(item) < 10} class:margin-zero={selisih(item) <= 0}>
								{selisih(item)}%
							</span>
						</td>
						<td class="td-center">
							{#if item.diberikan === 1}
								<span class="diberikan-yes">✓</span>
							{:else}
								<span class="diberikan-no">✗</span>
							{/if}
						</td>
						<td>
							<button class="btn btn-primary btn-sm" onclick={() => openEdit(item)}>✏️ Ubah</button>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<div class="pagination">
	<span>{totalCount.toLocaleString('id-ID')} obat · Halaman {currentPage} dari {totalPages()}</span>
	<div>
		<button class="btn btn-ghost" disabled={loading || currentPage === 1} onclick={previousPage}>Sebelumnya</button>
		<button class="btn btn-ghost" disabled={loading || currentPage === totalPages()} onclick={nextPage}>Berikutnya</button>
	</div>
</div>

<!-- Edit Modal -->
{#if showModal && editTarget}
	<div class="modal-overlay" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) showModal = false; }}>
		<div class="modal-box" role="dialog" aria-modal="true" tabindex="-1">
			<h2>Ubah Harga</h2>
			<div class="edit-obat-info">
				<code class="obat-code">{editTarget.obat_id}</code>
				<strong>{editTarget.obat_nama}</strong>
				<span class="jenis-badge">{editTarget.jenis_nama}</span>
			</div>

			<div class="price-compare">
				<div class="price-card price-current">
					<span class="price-label">Harga Saat Ini</span>
					<div class="price-row"><span>PBF:</span><span>Rp{formatRp(editTarget.harga_pbf)}</span></div>
					<div class="price-row"><span>Jual:</span><span>Rp{formatRp(editTarget.harga_jual)}</span></div>
				</div>
				<div class="price-arrow">→</div>
				<div class="price-card price-new">
					<span class="price-label">Harga Baru</span>
					<div class="price-row"><span>PBF:</span><span>Rp{formatRp(newHargaPbf)}</span></div>
					<div class="price-row"><span>Jual:</span><span>Rp{formatRp(newHargaJual)}</span></div>
				</div>
			</div>

			<div class="form-group">
				<label for="new-harga-pbf">Harga PBF Baru</label>
				<input id="new-harga-pbf" type="number" min="0" bind:value={newHargaPbf} />
			</div>
			<div class="form-group">
				<label for="new-harga-jual">Harga Jual Baru</label>
				<input id="new-harga-jual" type="number" min="0" bind:value={newHargaJual} />
			</div>

			{#if newHargaPbf > 0}
				<div class="new-margin-info">
					Margin baru: <strong>{Math.round(((newHargaJual - newHargaPbf) / newHargaPbf) * 100)}%</strong>
					(selisih Rp{formatRp(newHargaJual - newHargaPbf)})
				</div>
			{/if}

			<div class="modal-footer">
				<button class="btn btn-ghost" onclick={() => (showModal = false)}>Batal</button>
				<button class="btn btn-primary" onclick={handleSave} disabled={saving}>
					{saving ? 'Menyimpan...' : '💾 Simpan'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if toastMsg}<div class="toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">{toastMsg}</div>{/if}

<style>
	.page-size { display: flex; align-items: center; gap: .4rem; color: var(--color-text-secondary); font-size: .85rem; }
	.page-size select { border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-sm); font: inherit; background: var(--color-surface); }
	.harga-table { min-width: 900px; }
	.obat-code { background: #ede9fe; padding: 2px 8px; border-radius: 4px; color: #6d28d9; font-size: .82rem; }
	.jenis-badge { background: var(--color-primary-50); color: var(--color-primary-dark); padding: 2px 8px; border-radius: 10px; font-size: .78rem; font-weight: 500; }
	.td-center { text-align: center; }
	.td-right { text-align: right; font-variant-numeric: tabular-nums; }
	.table-empty { text-align: center; padding: var(--space-2xl); color: var(--color-text-muted); }
	.empty-icon { font-size: 2rem; margin-bottom: var(--space-sm); }
	.pagination { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); margin-top: var(--space-md); color: var(--color-text-secondary); font-size: .85rem; }
	.pagination div { display: flex; gap: var(--space-xs); }

	/* Margin badge */
	.margin-badge { padding: 2px 8px; border-radius: 12px; font-size: .78rem; font-weight: 600; }
	.margin-good { background: var(--color-success-light); color: var(--color-success); }
	.margin-low { background: var(--color-warning-light); color: #92400e; }
	.margin-zero { background: var(--color-danger-light); color: var(--color-danger); }

	/* Diberikan */
	.diberikan-yes { color: var(--color-success); font-weight: 700; }
	.diberikan-no { color: var(--color-text-muted); }

	/* Edit modal */
	.edit-obat-info {
		display: flex; align-items: center; gap: var(--space-sm);
		padding: var(--space-md); background: var(--color-bg);
		border-radius: var(--radius-md); margin-bottom: var(--space-lg);
	}

	.price-compare {
		display: flex; align-items: center; gap: var(--space-md);
		margin-bottom: var(--space-lg);
	}
	.price-card {
		flex: 1; padding: var(--space-md); border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}
	.price-current { background: var(--color-bg); }
	.price-new { background: var(--color-primary-50); border-color: var(--color-primary-100); }
	.price-label {
		display: block; font-size: .75rem; font-weight: 600;
		text-transform: uppercase; color: var(--color-text-muted);
		margin-bottom: var(--space-xs);
	}
	.price-row {
		display: flex; justify-content: space-between;
		font-size: .88rem; padding: 2px 0;
	}
	.price-arrow { font-size: 1.5rem; color: var(--color-text-muted); }

	.new-margin-info {
		padding: var(--space-sm) var(--space-md);
		background: var(--color-info-light); border-radius: var(--radius-md);
		font-size: .85rem; color: var(--color-info);
		margin-bottom: var(--space-md);
	}
	@media (max-width: 600px) { .pagination { align-items: flex-start; flex-direction: column; } .crud-toolbar { flex-direction: column; align-items: stretch; } }
</style>
