<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { IFakturItemInput, IFakturSimpanInput, Iobat, Ipbf } from '$lib/db/types';

	type FakturLine = IFakturItemInput & { obat_nama: string; jenis_nama: string };

	let pbfList = $state<Ipbf[]>([]);
	let selectedPbf = $state<Ipbf | null>(null);
	let pbfSearch = $state('');
	let obatResults = $state<Iobat[]>([]);
	let selectedObat = $state<Iobat | null>(null);
	let lines = $state<FakturLine[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let obatSearch = $state('');
	let searchLoading = $state(false);
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	function today(): string {
		const date = new Date();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${day}`;
	}

	let header = $state({ pbf_id: '', tanggal: today() });
	let item = $state({
		obat_id: '',
		jumlah_box: 1,
		isi_per_box: 1,
		harga_per_box: 0,
		disc: 0,
		expired_date: '',
		diberikan: 0 as 0 | 1
	});

	function showToast(message: string, type: 'success' | 'error' = 'success') {
		toastMsg = message;
		toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 4000);
	}

	function number(value: number): string {
		return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value || 0);
	}

	function formatTanggal(tanggal: string): string {
		const [year, month, day] = tanggal.split('-').map(Number);
		const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		return `${day} ${months[month - 1]} ${year}`;
	}

	function hargaSatuan(line: Pick<FakturLine, 'harga_per_box' | 'isi_per_box'>): number {
		return line.isi_per_box > 0 ? line.harga_per_box / line.isi_per_box : 0;
	}

	function qty(line: Pick<FakturLine, 'jumlah_box' | 'isi_per_box'>): number {
		return line.jumlah_box * line.isi_per_box;
	}

	function totalKotor(line: FakturLine): number {
		return qty(line) * hargaSatuan(line);
	}

	function diskonRupiah(line: FakturLine): number {
		return (totalKotor(line) * line.disc) / 100;
	}

	function totalBaris(line: FakturLine): number {
		return totalKotor(line) - diskonRupiah(line);
	}

	function totalFaktur(): number {
		return lines.reduce((total, line) => total + totalBaris(line), 0);
	}

	function totalDiskon(): number {
		return lines.reduce((total, line) => total + diskonRupiah(line), 0);
	}

	async function loadInitialData() {
		loading = true;
		const { data, error } = await supabase.from('pbf').select('*').order('pbf_nama');
		if (error) showToast(`Gagal memuat PBF: ${error.message}`, 'error');
		else pbfList = data ?? [];
		loading = false;
	}

	function filteredPbf(): Ipbf[] {
		const query = pbfSearch.trim().toLowerCase();
		if (query.length < 1) return [];
		return pbfList.filter((pbf) => pbf.pbf_nama.toLowerCase().includes(query) || pbf.pbf_id.toLowerCase().includes(query)).slice(0, 20);
	}

	function pilihPbf(pbf: Ipbf) {
		selectedPbf = pbf;
		header.pbf_id = pbf.pbf_id;
		pbfSearch = pbf.pbf_nama;
	}

	function resetPbfSearch() {
		selectedPbf = null;
		header.pbf_id = '';
	}

	let searchRequest = 0;
	async function searchObat() {
		const query = obatSearch.trim();
		item.obat_id = '';
		selectedObat = null;
		if (query.length < 2) {
			obatResults = [];
			return;
		}
		const request = ++searchRequest;
		searchLoading = true;
		const escaped = query.replace(/[,%_]/g, '');
		const { data, error } = await supabase
			.from('obat')
			.select('obat_id, obat_nama, jenis_id')
			.or(`obat_id.ilike.%${escaped}%,obat_nama.ilike.%${escaped}%`)
			.order('obat_nama')
			.limit(20);
		if (request !== searchRequest) return;
		searchLoading = false;
		if (error) {
			showToast(`Gagal mencari obat: ${error.message}`, 'error');
			return;
		}
		obatResults = (data ?? []) as Iobat[];
	}

	function pilihObat(obat: Iobat) {
		item.obat_id = obat.obat_id;
		selectedObat = obat;
		obatSearch = obat.obat_nama;
		obatResults = [];
	}

	function resetItem() {
		item = { obat_id: '', jumlah_box: 1, isi_per_box: 1, harga_per_box: 0, disc: 0, expired_date: '', diberikan: 0 };
		selectedObat = null;
		obatSearch = '';
		obatResults = [];
	}

	function tambahItem() {
		const obat = selectedObat;
		if (!obat) {
			showToast('Pilih obat dari hasil pencarian.', 'error');
			return;
		}
		if (item.jumlah_box <= 0 || item.isi_per_box <= 0 || item.harga_per_box < 0) {
			showToast('Jumlah box, isi per box, dan harga per box harus valid.', 'error');
			return;
		}
		if (!item.expired_date) {
			showToast('Tanggal kedaluwarsa wajib diisi.', 'error');
			return;
		}
		if (lines.some((line) => line.obat_id === obat.obat_id)) {
			showToast('Obat yang sama sudah ada dalam faktur.', 'error');
			return;
		}
		lines = [...lines, { ...item, obat_nama: obat.obat_nama, jenis_nama: obat.jenis_id }];
		resetItem();
	}

	function hapusItem(obatId: string) {
		lines = lines.filter((line) => line.obat_id !== obatId);
	}

	function resetFaktur() {
		header = { pbf_id: '', tanggal: today() };
		selectedPbf = null;
		pbfSearch = '';
		lines = [];
		resetItem();
	}

	function nextDate(tanggal: string): string {
		const [year, month, day] = tanggal.split('-').map(Number);
		return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
	}

	async function nextTransId(table: 'purchase' | 'kartu_stok', prefix: string): Promise<string> {
		const start = `${header.tanggal}T00:00:00+07:00`;
		const end = `${nextDate(header.tanggal)}T00:00:00+07:00`;
		const { data, error } = await supabase
			.from(table)
			.select('trans_id')
			.gte('tanggal_waktu', start)
			.lt('tanggal_waktu', end)
			.like('trans_id', `${prefix}%`);
		if (error) throw new Error(error.message);
		const sequence = Math.max(0, ...(data ?? []).map((entry) => Number(entry.trans_id.slice(prefix.length)) || 0)) + 1;
		return `${prefix}${String(sequence).padStart(2, '0')}`;
	}

	async function simpanFaktur() {
		if (!header.pbf_id || !header.tanggal) {
			showToast('Tanggal dan PBF wajib diisi.', 'error');
			return;
		}
		if (lines.length === 0) {
			showToast('Tambahkan minimal satu obat ke faktur.', 'error');
			return;
		}

		saving = true;
		try {
			const prefix = header.tanggal.replaceAll('-', '');
			const transId = await nextTransId('purchase', prefix);
			const payload: IFakturSimpanInput = {
				trans_id: transId, pbf_id: header.pbf_id, tanggal_waktu: `${header.tanggal}T00:00:00+07:00`, total_trans: totalFaktur(), total_disc: totalDiskon(),
				details: lines.map(({ obat_nama, jenis_nama, ...line }) => line)
			};
			const { error: purchaseError } = await supabase.from('purchase').insert({ ...payload, details: undefined });
			if (purchaseError) throw new Error(purchaseError.message);
			const detailRows = lines.map((line) => ({ trans_id: transId, obat_id: line.obat_id, qty: qty(line), total_per_obat: totalKotor(line), disc: line.disc }));
			const { error: detailError } = await supabase.from('detail_purchase').insert(detailRows);
			if (detailError) throw new Error(detailError.message);
			for (const line of lines) {
				const { data: current, error: stokReadError } = await supabase.from('stok').select('qty, harga_jual').eq('obat_id', line.obat_id).maybeSingle();
				if (stokReadError) throw new Error(stokReadError.message);
				const stok = { obat_id: line.obat_id, qty: (current?.qty ?? 0) + qty(line), expired_date: line.expired_date, harga_pbf: hargaSatuan(line), harga_jual: current?.harga_jual ?? hargaSatuan(line), diberikan: line.diberikan };
				const { error: stokError } = current ? await supabase.from('stok').update(stok).eq('obat_id', line.obat_id) : await supabase.from('stok').insert(stok);
				if (stokError) throw new Error(stokError.message);
			}
			const { error: kartuError } = await supabase.from('kartu_stok').insert(lines.map((line) => ({ obat_id: line.obat_id, qty: qty(line), trans_id: transId, tanggal_waktu: payload.tanggal_waktu })));
			if (kartuError) throw new Error(kartuError.message);
			showToast(`Faktur ${transId} berhasil tersimpan.`);
			resetFaktur();
		} catch (error) {
			showToast(`Faktur gagal disimpan: ${error instanceof Error ? error.message : 'Terjadi kesalahan.'}`, 'error');
		} finally {
			saving = false;
		}
	}

	onMount(loadInitialData);
</script>

<div class="page-header">
	<h1>Faktur</h1>
	<p>Penerimaan obat dari PBF. PPN tidak dihitung pada modul ini.</p>
</div>

<section class="faktur-card">
	<div class="faktur-grid">
		<div class="form-group">
			<label for="tanggal-faktur">Tanggal Faktur</label>
			<input id="tanggal-faktur" type="date" bind:value={header.tanggal} />
			<small>{formatTanggal(header.tanggal)}</small>
		</div>
		<div class="form-group faktur-pbf">
			<label for="pbf">PBF / Supplier</label>
			<input id="pbf" bind:value={pbfSearch} oninput={resetPbfSearch} disabled={loading} autocomplete="off" placeholder="Ketik nama PBF" />
			{#if !selectedPbf && filteredPbf().length > 0}
				<div class="search-results pbf-results">
					{#each filteredPbf() as pbf}
						<button type="button" onclick={() => pilihPbf(pbf)}><strong>{pbf.pbf_nama}</strong><span>{pbf.pbf_id}</span></button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>

<section class="faktur-card">
	<h2>Tambah Obat</h2>
	<div class="obat-search">
		<div class="form-group">
			<label for="cari-obat">Nama Obat</label>
			<input id="cari-obat" bind:value={obatSearch} oninput={searchObat} autocomplete="off" placeholder="Ketik minimal 2 huruf untuk mencari obat" />
			{#if searchLoading}<small>Mencari obat...</small>{/if}
			{#if obatResults.length > 0}
				<div class="search-results">
					{#each obatResults as obat}
						<button type="button" onclick={() => pilihObat(obat)}><strong>{obat.obat_nama}</strong><span>{obat.obat_id}</span></button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	<div class="item-grid">
		<div class="form-group"><label for="jumlah-box">Jumlah Box</label><input id="jumlah-box" type="number" min="1" step="1" bind:value={item.jumlah_box} /></div>
		<div class="form-group"><label for="isi-box">Isi / Box</label><input id="isi-box" type="number" min="1" step="1" bind:value={item.isi_per_box} /></div>
		<div class="form-group"><label for="harga-box">Harga / Box</label><input id="harga-box" type="number" min="0" step="0.01" bind:value={item.harga_per_box} /></div>
		<div class="form-group"><label for="diskon">Diskon (%)</label><input id="diskon" type="number" min="0" max="100" step="0.01" bind:value={item.disc} /></div>
		<div class="form-group"><label for="expired">Kedaluwarsa</label><input id="expired" type="date" bind:value={item.expired_date} /></div>
		<div class="form-group checkbox-group"><label for="diberikan">Diberikan</label><label class="checkbox-label"><input id="diberikan" type="checkbox" checked={item.diberikan === 1} onchange={(event) => (item.diberikan = event.currentTarget.checked ? 1 : 0)} /> Diberikan</label></div>
	</div>
	<div class="calculation">Qty satuan: <strong>{number(item.jumlah_box * item.isi_per_box)}</strong> &middot; Harga satuan: <strong>Rp {number(hargaSatuan(item))}</strong></div>
	<div class="add-row"><button class="btn btn-primary" type="button" onclick={tambahItem}>+ Tambahkan ke Faktur</button></div>
</section>

<section class="faktur-card">
	<div class="table-title"><h2>Detail Faktur</h2><strong>Total Faktur: Rp {number(totalFaktur())}</strong></div>
	<div class="data-table-wrapper">
		<table class="data-table faktur-table">
			<thead><tr><th>Obat</th><th>Qty</th><th>Harga / Sat</th><th>Diskon</th><th>Total</th><th></th></tr></thead>
			<tbody>
				{#if lines.length === 0}<tr><td colspan="6" class="table-empty">Belum ada obat pada faktur.</td></tr>{/if}
				{#each lines as line}
					<tr><td><strong>{line.obat_nama}</strong><br /><small>{line.obat_id} · {line.jumlah_box} box × {line.isi_per_box}</small></td><td>{number(qty(line))}</td><td>Rp {number(hargaSatuan(line))}</td><td>{number(line.disc)}%<br /><small>Rp {number(diskonRupiah(line))}</small></td><td><strong>Rp {number(totalBaris(line))}</strong></td><td><button class="btn btn-danger-ghost btn-sm" type="button" title="Hapus obat" aria-label="Hapus {line.obat_nama}" onclick={() => hapusItem(line.obat_id)}>🗑️</button></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="faktur-actions"><button class="btn btn-ghost" type="button" onclick={resetFaktur} disabled={saving}>Kosongkan</button><button class="btn btn-primary" type="button" onclick={simpanFaktur} disabled={saving || loading}>{saving ? 'Menyimpan...' : 'Simpan Faktur'}</button></div>
</section>

{#if toastMsg}<div class="toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">{toastMsg}</div>{/if}

<style>
	.faktur-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: var(--space-lg); }
	.faktur-card h2 { font-size: 1.05rem; margin-bottom: var(--space-md); }
	.faktur-grid, .item-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-md); }
	.item-grid { grid-template-columns: repeat(6, minmax(115px, 1fr)); }
	.faktur-pbf { grid-column: span 1; position: relative; }
	.obat-search { max-width: 620px; position: relative; }
	.search-results { position: absolute; width: 100%; max-height: 250px; overflow-y: auto; z-index: 5; background: white; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
	.pbf-results { position: absolute; }
	.search-results button { width: 100%; border: 0; background: white; text-align: left; padding: .55rem .75rem; cursor: pointer; display: flex; justify-content: space-between; gap: 1rem; }
	.search-results button:hover { background: var(--color-primary-50); }
	.search-results span, small { color: var(--color-text-muted); font-size: .78rem; }
	.calculation { color: var(--color-text-secondary); font-size: .88rem; margin-top: .25rem; }
	.checkbox-group { display: flex; flex-direction: column; }
	.checkbox-label { display: flex; align-items: center; gap: .5rem; min-height: 38px; color: var(--color-text); font-size: .9rem; text-transform: none; letter-spacing: 0; }
	.checkbox-label input { width: auto; }
	.add-row, .faktur-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-md); }
	.table-title { display: flex; justify-content: space-between; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md); }
	.table-title h2 { margin: 0; }
	@media (max-width: 900px) { .item-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
	@media (max-width: 600px) { .faktur-grid, .item-grid { grid-template-columns: 1fr; } .faktur-table { min-width: 700px; } }
</style>
