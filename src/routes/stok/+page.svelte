<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat, Istok } from '$lib/db/types';

	type StokRow = Istok & { obat_nama: string; jenis_id: string };

	let rows = $state<StokRow[]>([]);
	let searchQuery = $state('');
	let loading = $state(true);
	let errorMessage = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;

	function rupiah(value: number): string { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value || 0); }
	function formatTanggal(value: string): string { return value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-'; }

	async function loadMedicineMap(ids: string[]): Promise<Map<string, Iobat>> {
		if (ids.length === 0) return new Map();
		const { data, error } = await supabase.from('obat').select('obat_id, obat_nama, jenis_id').in('obat_id', ids);
		if (error) throw new Error(error.message);
		return new Map((data ?? []).map((obat) => [obat.obat_id, obat as Iobat]));
	}

	async function loadStok() {
		loading = true;
		errorMessage = '';
		try {
			const query = searchQuery.trim();
			let stok: Istok[] = [];
			if (query.length >= 2) {
				const safe = query.replace(/[,%_]/g, '');
				const { data: obat, error: obatError } = await supabase.from('obat').select('obat_id, obat_nama, jenis_id').or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`).limit(100);
				if (obatError) throw new Error(obatError.message);
				if (!obat || obat.length === 0) { rows = []; loading = false; return; }
				const { data, error } = await supabase.from('stok').select('*').in('obat_id', obat.map((item) => item.obat_id)).order('obat_id').limit(100);
				if (error) throw new Error(error.message);
				const obatMap = new Map(obat.map((item) => [item.obat_id, item]));
				stok = (data ?? []).map((item) => ({ ...item, obat_nama: obatMap.get(item.obat_id)?.obat_nama ?? item.obat_id, jenis_id: obatMap.get(item.obat_id)?.jenis_id ?? '-' }));
				rows = stok as StokRow[];
			} else {
				const { data, error } = await supabase.from('stok').select('*').order('obat_id').limit(100);
				if (error) throw new Error(error.message);
				stok = data ?? [];
				const obatMap = await loadMedicineMap(stok.map((item) => item.obat_id));
				rows = stok.map((item) => ({ ...item, obat_nama: obatMap.get(item.obat_id)?.obat_nama ?? item.obat_id, jenis_id: obatMap.get(item.obat_id)?.jenis_id ?? '-' }));
			}
		} catch (error) { errorMessage = error instanceof Error ? error.message : 'Gagal memuat stok.'; }
		loading = false;
	}

	function handleSearch() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(loadStok, 300);
	}

	onMount(loadStok);
</script>

<div class="page-header"><h1>Stok</h1><p>Stok obat yang tersedia saat ini.</p></div>
<div class="crud-toolbar"><div class="search-box"><span class="search-icon">⌕</span><input type="search" bind:value={searchQuery} oninput={handleSearch} placeholder="Cari nama atau kode obat..." /></div><button class="btn btn-ghost" type="button" onclick={loadStok} disabled={loading}>Muat ulang</button></div>
<p class="result-note">{searchQuery.trim().length >= 2 ? 'Hasil pencarian' : 'Menampilkan 100 stok pertama. Ketik minimal 2 huruf untuk mencari.'}</p>
{#if errorMessage}<div class="stock-error">Gagal memuat stok: {errorMessage}</div>{/if}
<div class="data-table-wrapper"><table class="data-table stock-table"><thead><tr><th>Obat</th><th>Jenis</th><th>Stok</th><th>Kedaluwarsa</th><th>Harga PBF</th><th>Harga Jual</th><th>Diberikan</th></tr></thead><tbody>
{#if loading}<tr><td colspan="7" class="table-empty">Memuat stok...</td></tr>{:else if rows.length === 0}<tr><td colspan="7" class="table-empty">Tidak ada stok yang ditemukan.</td></tr>{:else}{#each rows as row}<tr><td><strong>{row.obat_nama}</strong><br /><small>{row.obat_id}</small></td><td>{row.jenis_id}</td><td class:stock-negative={row.qty < 0} class:stock-positive={row.qty > 0}><strong>{rupiah(row.qty)}</strong></td><td>{formatTanggal(row.expired_date)}</td><td>Rp {rupiah(row.harga_pbf)}</td><td>Rp {rupiah(row.harga_jual)}</td><td><span class:badge-yes={row.diberikan === 1} class:badge-no={row.diberikan === 0}>{row.diberikan === 1 ? 'Diberikan' : 'Tidak'}</span></td></tr>{/each}{/if}
</tbody></table></div>
<style>
.stock-table { min-width: 880px; }.stock-positive { color: var(--color-success); }.stock-negative { color: var(--color-danger); }.badge-yes, .badge-no { border-radius: 999px; font-size: .78rem; font-weight: 600; padding: .2rem .55rem; }.badge-yes { background: var(--color-success-light); color: var(--color-success); }.badge-no { background: var(--color-surface-hover); color: var(--color-text-secondary); }.stock-error { margin-bottom: var(--space-md); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); background: var(--color-danger-light); color: var(--color-danger); }.result-note { margin: calc(var(--space-md) * -1) 0 var(--space-md); color: var(--color-text-muted); font-size: .82rem; }
</style>
