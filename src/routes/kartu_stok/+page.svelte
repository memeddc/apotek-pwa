<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Ikartu_stok, Iobat } from '$lib/db/types';

	type KartuRow = Ikartu_stok & { obat_nama: string };
	let rows = $state<KartuRow[]>([]);
	let obatResults = $state<Iobat[]>([]);
	let selectedObat = $state<Iobat | null>(null);
	let obatSearch = $state('');
	let loading = $state(true);
	let searchLoading = $state(false);
	let errorMessage = $state('');
	let limit = $state(100);
	let searchTimer: ReturnType<typeof setTimeout>;
	let searchRequest = 0;

	function formatJumlah(value: number): string { return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, signDisplay: 'always' }).format(value); }
	function formatWaktu(value: string): string { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
	function jenisMutasi(row: Ikartu_stok): 'Masuk' | 'Keluar' | 'Stok Opname' { if (/^(SO|O)/i.test(row.trans_id)) return 'Stok Opname'; return row.qty >= 0 ? 'Masuk' : 'Keluar'; }

	async function searchObat() {
		const query = obatSearch.trim();
		selectedObat = null;
		if (query.length < 2) { obatResults = []; searchLoading = false; return; }
		const request = ++searchRequest;
		searchLoading = true;
		const safe = query.replace(/[,%_]/g, '');
		const { data, error } = await supabase.from('obat').select('obat_id, obat_nama, jenis_id').or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`).order('obat_nama').limit(20);
		if (request !== searchRequest) return;
		searchLoading = false;
		if (error) { errorMessage = error.message; return; }
		obatResults = (data ?? []) as Iobat[];
	}

	function handleSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(searchObat, 300);
	}

	function pilihObat(obat: Iobat) {
		selectedObat = obat;
		obatSearch = obat.obat_nama;
		obatResults = [];
		loadKartu();
	}

	async function medicineMap(ids: string[]): Promise<Map<string, string>> {
		if (!ids.length) return new Map();
		const { data, error } = await supabase.from('obat').select('obat_id, obat_nama').in('obat_id', ids);
		if (error) throw new Error(error.message);
		return new Map((data ?? []).map((item) => [item.obat_id, item.obat_nama]));
	}

	async function loadKartu() {
		loading = true;
		errorMessage = '';
		try {
			let query = supabase.from('kartu_stok').select('*').order('tanggal_waktu', { ascending: false }).limit(limit);
			if (selectedObat) query = query.eq('obat_id', selectedObat.obat_id);
			const { data, error } = await query;
			if (error) throw new Error(error.message);
			const kartu = (data ?? []) as Ikartu_stok[];
			const names = await medicineMap(kartu.map((item) => item.obat_id));
			rows = kartu.map((item) => ({ ...item, obat_nama: names.get(item.obat_id) ?? item.obat_id }));
		} catch (error) { errorMessage = error instanceof Error ? error.message : 'Gagal memuat kartu stok.'; }
		loading = false;
	}

	function clearObat() { selectedObat = null; obatSearch = ''; obatResults = []; loadKartu(); }
	function changeLimit(event: Event) { limit = Number((event.currentTarget as HTMLSelectElement).value); loadKartu(); }
	onMount(loadKartu);
</script>

<div class="page-header"><h1>Kartu Stok</h1><p>Riwayat pergerakan stok obat: masuk, keluar, dan stok opname.</p></div>
<div class="crud-toolbar">
	<div class="kartu-search"><div class="search-box"><span class="search-icon">⌕</span><input type="search" bind:value={obatSearch} oninput={handleSearchInput} autocomplete="off" placeholder="Cari nama atau kode obat..." /></div>
		{#if searchLoading}<small>Mencari obat...</small>{/if}
		{#if !selectedObat && obatResults.length > 0}<div class="search-results">{#each obatResults as obat}<button type="button" onclick={() => pilihObat(obat)}><strong>{obat.obat_nama}</strong><span>{obat.obat_id}</span></button>{/each}</div>{/if}
	</div>
	<div class="filter-group"><select aria-label="Jumlah riwayat" value={limit} onchange={changeLimit}><option value="100">100 riwayat</option><option value="250">250 riwayat</option><option value="500">500 riwayat</option></select>{#if selectedObat}<button class="btn btn-ghost" type="button" onclick={clearObat}>Semua obat</button>{/if}</div>
	<button class="btn btn-ghost" type="button" onclick={loadKartu} disabled={loading}>Muat ulang</button>
</div>
<p class="result-note">{selectedObat ? `Riwayat: ${selectedObat.obat_nama}` : 'Menampilkan riwayat terbaru. Ketik minimal 2 huruf untuk mencari obat.'}</p>
{#if errorMessage}<div class="stock-error">Gagal memuat kartu stok: {errorMessage}</div>{/if}
<div class="data-table-wrapper"><table class="data-table kartu-table"><thead><tr><th>Waktu</th><th>Obat</th><th>Jenis</th><th>Jumlah</th><th>ID Transaksi</th></tr></thead><tbody>
{#if loading}<tr><td colspan="5" class="table-empty">Memuat riwayat...</td></tr>{:else if rows.length === 0}<tr><td colspan="5" class="table-empty">Belum ada riwayat kartu stok.</td></tr>{:else}{#each rows as row}<tr><td>{formatWaktu(row.tanggal_waktu)}</td><td><strong>{row.obat_nama}</strong><br /><small>{row.obat_id}</small></td><td><span class="mutation {jenisMutasi(row).toLowerCase().replace(' ', '-')}">{jenisMutasi(row)}</span></td><td class:inbound={row.qty > 0} class:outbound={row.qty < 0}><strong>{formatJumlah(row.qty)}</strong></td><td><code>{row.trans_id}</code></td></tr>{/each}{/if}
</tbody></table></div>
<style>
.kartu-search { position: relative; flex: 1; max-width: 420px; }.kartu-search .search-box { max-width: none; }.search-results { position: absolute; top: 2.55rem; width: 100%; max-height: 250px; overflow-y: auto; z-index: 5; background: white; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }.search-results button { width: 100%; border: 0; background: white; text-align: left; padding: .55rem .75rem; cursor: pointer; display: flex; justify-content: space-between; gap: 1rem; }.search-results button:hover { background: var(--color-primary-50); }.search-results span, small { color: var(--color-text-muted); font-size: .78rem; }.filter-group { display: flex; gap: var(--space-sm); }.filter-group select { padding: var(--space-sm) var(--space-md); border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font: inherit; }.kartu-table { min-width: 800px; }.mutation { border-radius: 999px; font-size: .78rem; font-weight: 600; padding: .2rem .55rem; }.masuk { background: var(--color-success-light); color: var(--color-success); }.keluar { background: var(--color-danger-light); color: var(--color-danger); }.stok-opname { background: var(--color-warning-light); color: #b45309; }.inbound { color: var(--color-success); }.outbound { color: var(--color-danger); }.stock-error { margin-bottom: var(--space-md); padding: var(--space-sm) var(--space-md); border-radius: var(--radius-md); background: var(--color-danger-light); color: var(--color-danger); }.result-note { margin: calc(var(--space-md) * -1) 0 var(--space-md); color: var(--color-text-muted); font-size: .82rem; }@media (max-width: 600px) { .filter-group { width: 100%; } }
</style>
