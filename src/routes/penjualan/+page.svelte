<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat } from '$lib/db/types';

	type StokInfo = {
		qty: number;
		harga_pbf: number;
		harga_jual: number;
		diberikan: 0 | 1;
		disc_pbf: number;
		min_price: number;
	};
	type SaleLine = {
		obat_id: string;
		obat_nama: string;
		jenis_nama: string;
		qty: number;
		harga_jual: number;
		harga_pbf: number;
		disc_pbf: number;
		diberikan: 0 | 1;
		stok_tersedia: number;
	};

	let loading = $state(true);
	let saving = $state(false);
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	// Nota
	let nomorNota = $state('');
	let tanggal = $state('');

	// Obat search
	let obatSearch = $state('');
	let obatResults = $state<(Iobat & { jenis_nama?: string })[]>([]);
	let selectedObat = $state<(Iobat & { jenis_nama?: string }) | null>(null);
	let stokInfo = $state<StokInfo | null>(null);
	let searchLoading = $state(false);
	let searchRequest = 0;

	// Item input
	let inputQty = $state(1);
	let inputHarga = $state(0);

	// Lines
	let lines = $state<SaleLine[]>([]);

	// Footer
	let totalDiscPersen = $state(0);
	let totalDiscRp = $state(0);
	let bayar = $state(0);
	let cetakNota = $state(true);

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg; toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 4000);
	}

	function formatRp(value: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(value));
	}

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function todayPrefix(): string {
		return todayStr().replaceAll('-', '');
	}

	function tomorrowStr(): string {
		const t = new Date();
		t.setDate(t.getDate() + 1);
		return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
	}

	async function generateNomorNota() {
		const prefix = todayPrefix(); // No 'J' here
		const startOfDay = `${todayStr()}T00:00:00+07:00`;
		const endOfDay = `${tomorrowStr()}T00:00:00+07:00`;

		const { data, error } = await supabase
			.from('penjualan')
			.select('trans_id')
			.gte('tanggal_waktu', startOfDay)
			.lt('tanggal_waktu', endOfDay)
			.like('trans_id', `${prefix}%`);

		if (error) { showToast(`Gagal generate nomor nota: ${error.message}`, 'error'); return; }

		const maxSeq = Math.max(0, ...(data ?? []).map((r) => {
			const suffix = r.trans_id.slice(prefix.length);
			return Number(suffix) || 0;
		}));

		nomorNota = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
	}

	async function searchObat() {
		const query = obatSearch.trim();
		selectedObat = null;
		stokInfo = null;
		if (query.length < 2) { obatResults = []; return; }
		const request = ++searchRequest;
		searchLoading = true;
		const escaped = query.replace(/[,%_]/g, '');
		const { data, error } = await supabase
			.from('obat')
			.select('obat_id, obat_nama, jenis_id, isActive, jenis_obat(jenis_nama)')
			.eq('isActive', 1)
			.or(`obat_id.ilike.%${escaped}%,obat_nama.ilike.%${escaped}%`)
			.order('obat_nama')
			.limit(20);
		if (request !== searchRequest) return;
		searchLoading = false;
		if (error) { showToast(`Gagal mencari obat: ${error.message}`, 'error'); return; }
		obatResults = (data ?? []).map((o: any) => ({
			obat_id: o.obat_id,
			obat_nama: o.obat_nama,
			jenis_id: o.jenis_id,
			isActive: o.isActive,
			jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id
		}));
	}

	async function pilihObat(obat: Iobat & { jenis_nama?: string }) {
		selectedObat = obat;
		obatSearch = obat.obat_nama;
		obatResults = [];

		// Load stock info
		const { data: stok, error: stokError } = await supabase
			.from('stok')
			.select('qty, harga_pbf, harga_jual, diberikan')
			.eq('obat_id', obat.obat_id)
			.maybeSingle();

		if (stokError) { showToast(`Gagal memuat stok: ${stokError.message}`, 'error'); return; }

		// Load latest disc from detail_purchase
		const { data: purchaseDetail } = await supabase
			.from('detail_purchase')
			.select('disc')
			.eq('obat_id', obat.obat_id)
			.order('trans_id', { ascending: false })
			.limit(1)
			.maybeSingle();

		const disc = purchaseDetail?.disc ?? 0;

		if (stok) {
			const diberikan = stok.diberikan as 0 | 1;
			// If diberikan=1: effective cost = harga_pbf * (1 - disc/100)
			// If diberikan=0: effective cost = harga_pbf
			const effectiveCost = diberikan === 1
				? stok.harga_pbf * (1 - disc / 100)
				: stok.harga_pbf;
			// Min = effective cost + 10%
			const minPrice = Math.round(effectiveCost * 1.1);

			stokInfo = {
				qty: stok.qty,
				harga_pbf: stok.harga_pbf,
				harga_jual: stok.harga_jual,
				diberikan,
				disc_pbf: disc,
				min_price: minPrice
			};
			inputHarga = stok.harga_jual;
			inputQty = 1;
		} else {
			stokInfo = { qty: 0, harga_pbf: 0, harga_jual: 0, diberikan: 0, disc_pbf: 0, min_price: 0 };
			inputHarga = 0;
			inputQty = 1;
		}
	}

	function setHargaMinimum() {
		if (stokInfo && stokInfo.min_price > 0) {
			inputHarga = stokInfo.min_price;
		}
	}

	function tambahItem() {
		if (!selectedObat) { showToast('Pilih obat dari hasil pencarian.', 'error'); return; }
		if (inputQty <= 0) { showToast('Jumlah harus lebih dari 0.', 'error'); return; }
		if (inputHarga <= 0) { showToast('Harga harus lebih dari 0.', 'error'); return; }
		if (!stokInfo || stokInfo.qty < inputQty) {
			showToast(`Stok tidak cukup. Sisa: ${stokInfo?.qty ?? 0}`, 'error');
			return;
		}
		if (lines.some((l) => l.obat_id === selectedObat!.obat_id)) {
			showToast('Obat sudah ada dalam daftar.', 'error');
			return;
		}

		lines = [...lines, {
			obat_id: selectedObat.obat_id,
			obat_nama: selectedObat.obat_nama,
			jenis_nama: (selectedObat as any).jenis_nama ?? selectedObat.jenis_id,
			qty: inputQty,
			harga_jual: inputHarga,
			harga_pbf: stokInfo.harga_pbf,
			disc_pbf: stokInfo.disc_pbf,
			diberikan: stokInfo.diberikan,
			stok_tersedia: stokInfo.qty
		}];

		resetItem();
	}

	function hapusItem(obatId: string) {
		lines = lines.filter((l) => l.obat_id !== obatId);
	}

	function resetItem() {
		obatSearch = '';
		selectedObat = null;
		stokInfo = null;
		obatResults = [];
		inputQty = 1;
		inputHarga = 0;
	}

	// Calculations
	function subtotalLine(line: SaleLine): number {
		return line.qty * line.harga_jual;
	}

	function hargaSebelumDiskon(): number {
		return lines.reduce((sum, l) => sum + subtotalLine(l), 0);
	}

	function totalDiskonRp(): number {
		if (totalDiscPersen > 0) return Math.round(hargaSebelumDiskon() * totalDiscPersen / 100);
		return totalDiscRp;
	}

	function harusDibayar(): number {
		return Math.max(0, hargaSebelumDiskon() - totalDiskonRp());
	}

	function kembali(): number {
		return Math.max(0, bayar - harusDibayar());
	}

	function onDiscPersenChange() {
		if (totalDiscPersen > 0) {
			totalDiscRp = Math.round(hargaSebelumDiskon() * totalDiscPersen / 100);
		}
	}

	function onDiscRpChange() {
		if (totalDiscRp > 0 && hargaSebelumDiskon() > 0) {
			totalDiscPersen = Math.round((totalDiscRp / hargaSebelumDiskon()) * 10000) / 100;
		}
	}

	function resetAll() {
		lines = [];
		resetItem();
		totalDiscPersen = 0;
		totalDiscRp = 0;
		bayar = 0;
		cetakNota = true;
		generateNomorNota();
	}

	async function simpanPenjualan() {
		if (lines.length === 0) { showToast('Tambahkan minimal satu obat.', 'error'); return; }
		if (bayar < harusDibayar()) { showToast('Jumlah bayar kurang.', 'error'); return; }

		saving = true;
		try {
			const now = new Date();
			const tanggalWaktu = now.toISOString();

			// Insert penjualan
			const { error: transError } = await supabase.from('penjualan').insert({
				trans_id: nomorNota,
				tanggal_waktu: tanggalWaktu,
				total_trans: harusDibayar(),
				total_disc: totalDiskonRp(),
				bayar: bayar,
				kembali: kembali()
			});
			if (transError) throw new Error(transError.message);

			// Insert detail_penjualan
			const details = lines.map((l) => ({
				trans_id: nomorNota,
				obat_id: l.obat_id,
				qty: l.qty,
				harga_obat: l.harga_jual
			}));
			const { error: detailError } = await supabase.from('detail_penjualan').insert(details);
			if (detailError) throw new Error(detailError.message);

			// Update stok (kurangi qty)
			for (const line of lines) {
				const { data: current, error: stokReadError } = await supabase
					.from('stok')
					.select('qty')
					.eq('obat_id', line.obat_id)
					.maybeSingle();
				if (stokReadError) throw new Error(stokReadError.message);

				const newQty = (current?.qty ?? 0) - line.qty;
				const { error: stokError } = await supabase
					.from('stok')
					.update({ qty: newQty })
					.eq('obat_id', line.obat_id);
				if (stokError) throw new Error(stokError.message);
			}

			// Insert kartu_stok (qty negatif untuk penjualan, prepend J to trans_id)
			const kartuRows = lines.map((l) => ({
				obat_id: l.obat_id,
				qty: -l.qty,
				trans_id: `J${nomorNota}`,
				tanggal_waktu: tanggalWaktu
			}));
			const { error: kartuError } = await supabase.from('kartu_stok').insert(kartuRows);
			if (kartuError) throw new Error(kartuError.message);

			showToast(`Penjualan ${nomorNota} berhasil disimpan!`);
			resetAll();
		} catch (err) {
			showToast(`Gagal menyimpan: ${err instanceof Error ? err.message : 'Terjadi kesalahan.'}`, 'error');
		} finally {
			saving = false;
		}
	}

	onMount(async () => {
		tanggal = todayStr();
		await generateNomorNota();
		loading = false;
	});
</script>

<div class="page-header">
	<h1>🛒 Penjualan</h1>
	<p>Transaksi penjualan obat ke pelanggan</p>
</div>

<!-- Header Section -->
<section class="sale-card sale-header-card">
	<div class="sale-header-grid">
		<div class="form-group">
			<label for="nomor-nota">Nomor Nota</label>
			<input id="nomor-nota" type="text" value={nomorNota} disabled class="nota-input" />
		</div>
		<div class="form-group">
			<label for="tanggal-jual">Tanggal</label>
			<input id="tanggal-jual" type="date" bind:value={tanggal} />
		</div>
	</div>
</section>

<!-- Input Obat Section -->
<section class="sale-card">
	<h2>Tambah Obat</h2>
	<div class="obat-input-grid">
		<div class="form-group obat-search-group">
			<label for="cari-obat-jual">Nama Obat</label>
			<input id="cari-obat-jual" bind:value={obatSearch} oninput={searchObat} autocomplete="off" placeholder="Ketik minimal 2 huruf..." />
			{#if searchLoading}<small class="search-hint">Mencari obat...</small>{/if}
			{#if obatResults.length > 0}
				<div class="obat-dropdown">
					{#each obatResults as obat}
						<button type="button" onclick={() => pilihObat(obat)}>
							<span class="obat-drop-name">{obat.obat_nama}</span>
							<span class="obat-drop-meta">
								<span class="obat-drop-jenis">{(obat as any).jenis_nama ?? obat.jenis_id}</span>
								<span class="obat-drop-id">{obat.obat_id}</span>
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="form-group">
			<label for="qty-jual">Jumlah</label>
			<input id="qty-jual" type="number" min="1" bind:value={inputQty} />
			{#if stokInfo}
				<small class="stok-hint">Sisa: <strong>{stokInfo.qty}</strong>
					{#if stokInfo.disc_pbf > 0}
						· PBF <strong>{stokInfo.disc_pbf}%</strong>
						{#if stokInfo.diberikan === 1}
							<span class="diberikan-tag">✓ Diberikan</span>
						{:else}
							<span class="tidak-diberikan-tag">✗ Tidak</span>
						{/if}
					{/if}
				</small>
			{/if}
		</div>
		<div class="form-group">
			<label for="harga-jual">Harga</label>
			<input
				id="harga-jual"
				type="number"
				min="0"
				bind:value={inputHarga}
				class:input-below-min={stokInfo && stokInfo.min_price > 0 && inputHarga < stokInfo.min_price}
			/>
			{#if stokInfo && stokInfo.min_price > 0}
				{#if inputHarga < stokInfo.min_price}
					<button
						type="button"
						class="btn-set-min"
						onclick={setHargaMinimum}
						title="Klik untuk mengubah harga ke harga minimum obat"
					>
						⚠️ Set ke Min: <strong>Rp{formatRp(stokInfo.min_price)}</strong>
					</button>
				{:else}
					<button
						type="button"
						class="min-hint-btn"
						onclick={setHargaMinimum}
						title="Klik untuk menggunakan harga minimum obat"
					>
						Min: <strong>Rp{formatRp(stokInfo.min_price)}</strong>
					</button>
				{/if}
			{/if}
		</div>
		<div class="form-group add-btn-group">
			<label>&nbsp;</label>
			<button class="btn btn-primary" onclick={tambahItem}>+ Tambah</button>
		</div>
	</div>
</section>

<!-- Detail Table -->
<section class="sale-card">
	<div class="sale-table-header">
		<h2>Detail Penjualan</h2>
		<div class="harus-dibayar">
			Harus Dibayar: <strong>Rp{formatRp(harusDibayar())}</strong>
		</div>
	</div>

	<div class="data-table-wrapper">
		<table class="data-table sale-table">
			<thead>
				<tr>
					<th style="width:40px">No.</th>
					<th style="width:50px">Jumlah</th>
					<th>Nama Obat</th>
					<th>Jenis</th>
					<th>Harga/Sat</th>
					<th style="width:70px">DiscPBF</th>
					<th>Total</th>
					<th style="width:40px"></th>
				</tr>
			</thead>
			<tbody>
				{#if lines.length === 0}
					<tr><td colspan="8" class="table-empty">Belum ada obat. Cari dan tambahkan obat di atas.</td></tr>
				{:else}
					{#each lines as line, i}
						<tr>
							<td class="td-center">{i + 1}</td>
							<td class="td-center"><strong>{line.qty}</strong></td>
							<td><strong>{line.obat_nama}</strong></td>
							<td><span class="jenis-badge">{line.jenis_nama}</span></td>
							<td class="td-right">Rp{formatRp(line.harga_jual)}</td>
							<td class="td-center">{line.disc_pbf}%</td>
							<td class="td-right"><strong>Rp{formatRp(subtotalLine(line))}</strong></td>
							<td>
								<button class="btn btn-danger-ghost btn-sm" title="Hapus" onclick={() => hapusItem(line.obat_id)}>✕</button>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>

<!-- Footer -->
<section class="sale-card sale-footer-card">
	<div class="footer-grid">
		<div class="footer-left">
			<div class="summary-row">
				<span>Harga Sebelum Diskon</span>
				<span class="summary-val">Rp{formatRp(hargaSebelumDiskon())}</span>
			</div>
			<div class="disc-row">
				<div class="form-group disc-group">
					<label for="disc-persen">Total Disc(%)</label>
					<input id="disc-persen" type="number" min="0" max="100" step="0.01" bind:value={totalDiscPersen} oninput={onDiscPersenChange} />
				</div>
				<div class="form-group disc-group">
					<label for="disc-rp">(Rp)</label>
					<input id="disc-rp" type="number" min="0" bind:value={totalDiscRp} oninput={onDiscRpChange} />
				</div>
			</div>
			<div class="cetak-row">
				<span>Cetak Nota?</span>
				<label class="radio-label"><input type="radio" name="cetak" checked={!cetakNota} onchange={() => (cetakNota = false)} /> Tidak</label>
				<label class="radio-label"><input type="radio" name="cetak" checked={cetakNota} onchange={() => (cetakNota = true)} /> Ya</label>
			</div>
		</div>
		<div class="footer-right">
			<div class="pay-row">
				<label for="bayar-input">Bayar</label>
				<div class="pay-input-wrap">
					<span class="pay-prefix">Rp</span>
					<input id="bayar-input" type="number" min="0" bind:value={bayar} class="pay-input" />
				</div>
			</div>
			<div class="kembali-row">
				<span>Kembali</span>
				<span class="kembali-val" class:kembali-ok={kembali() >= 0}>Rp{formatRp(kembali())}</span>
			</div>
		</div>
	</div>

	<div class="sale-actions">
		<button class="btn btn-ghost" onclick={resetAll} disabled={saving}>🗑️ Kosong</button>
		<button class="btn btn-primary btn-lg" onclick={simpanPenjualan} disabled={saving || loading || lines.length === 0 || bayar < harusDibayar()}>
			{saving ? 'Menyimpan...' : '✅ Selesai'}
		</button>
	</div>
</section>

{#if toastMsg}<div class="toast {toastType === 'success' ? 'toast-success' : 'toast-error'}">{toastMsg}</div>{/if}

<style>
	/* Card */
	.sale-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		margin-bottom: var(--space-lg);
	}
	.sale-card h2 {
		font-size: 1.05rem;
		margin-bottom: var(--space-md);
		color: var(--color-text);
	}

	/* Header */
	.sale-header-card {
		background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
		border-color: var(--color-primary-100);
	}
	.sale-header-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
	}
	.nota-input {
		font-family: 'Courier New', monospace;
		font-size: 1.05rem !important;
		font-weight: 700;
		letter-spacing: 1px;
		color: var(--color-primary-dark) !important;
		background: var(--color-primary-50) !important;
	}

	/* Obat input */
	.obat-input-grid {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr auto;
		gap: var(--space-md);
		align-items: start;
	}
	.obat-search-group { position: relative; }
	.obat-dropdown {
		position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
		background: white; border: 1px solid var(--color-border);
		border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
		max-height: 260px; overflow-y: auto;
	}
	.obat-dropdown button {
		display: flex; justify-content: space-between; align-items: center;
		width: 100%; border: 0; background: white; text-align: left;
		padding: .6rem .85rem; cursor: pointer; transition: background var(--transition-fast);
	}
	.obat-dropdown button:hover { background: var(--color-primary-50); }
	.obat-drop-name { font-weight: 600; font-size: .9rem; }
	.obat-drop-meta { display: flex; gap: .5rem; font-size: .78rem; color: var(--color-text-muted); }
	.obat-drop-jenis {
		background: var(--color-primary-50); color: var(--color-primary-dark);
		padding: 1px 6px; border-radius: 4px; font-size: .72rem;
	}
	.search-hint, .stok-hint { color: var(--color-text-muted); font-size: .78rem; }
	.input-below-min {
		border-color: #f59e0b !important;
		background-color: #fffbebfb !important;
	}
	.btn-set-min {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fcd34d;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: .75rem;
		font-weight: 600;
		cursor: pointer;
		margin-top: 4px;
		transition: background var(--transition-fast), border-color var(--transition-fast);
	}
	.btn-set-min:hover {
		background: #fde68a;
		border-color: #f59e0b;
		color: #78350f;
	}
	.min-hint-btn {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-text-muted);
		font-size: .78rem;
		cursor: pointer;
		text-align: left;
		margin-top: 4px;
	}
	.min-hint-btn:hover {
		color: var(--color-primary-dark);
		text-decoration: underline;
	}
	.min-hint-btn strong { color: var(--color-warning); }
	.diberikan-tag {
		background: var(--color-success-light); color: var(--color-success);
		padding: 0 4px; border-radius: 3px; font-size: .72rem; font-weight: 600;
	}
	.tidak-diberikan-tag {
		background: var(--color-danger-light); color: var(--color-danger);
		padding: 0 4px; border-radius: 3px; font-size: .72rem; font-weight: 600;
	}
	.add-btn-group { display: flex; flex-direction: column; justify-content: flex-end; }

	/* Table */
	.sale-table-header {
		display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);
	}
	.sale-table-header h2 { margin: 0; }
	.harus-dibayar { font-size: 1.1rem; color: var(--color-primary-dark); }
	.harus-dibayar strong { font-size: 1.3rem; font-weight: 700; }
	.sale-table { min-width: 700px; }
	.td-center { text-align: center; }
	.td-right { text-align: right; font-variant-numeric: tabular-nums; }
	.jenis-badge {
		background: var(--color-primary-50); color: var(--color-primary-dark);
		padding: 2px 8px; border-radius: 10px; font-size: .78rem; font-weight: 500;
	}

	/* Footer */
	.sale-footer-card { background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); }
	.footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl); }
	.summary-row {
		display: flex; justify-content: space-between; align-items: center;
		padding: var(--space-sm) 0; font-size: .9rem; color: var(--color-text-secondary);
		border-bottom: 1px dashed var(--color-border);
	}
	.summary-val { font-weight: 600; color: var(--color-text); }
	.disc-row { display: flex; gap: var(--space-md); margin-top: var(--space-sm); }
	.disc-group { flex: 1; margin-bottom: var(--space-sm); }
	.disc-group input { font-size: .85rem; }
	.cetak-row {
		display: flex; align-items: center; gap: var(--space-md);
		font-size: .88rem; color: var(--color-text-secondary); margin-top: var(--space-sm);
	}
	.radio-label {
		display: inline-flex; align-items: center; gap: 4px;
		cursor: pointer; font-size: .88rem; color: var(--color-text);
	}
	.radio-label input { width: auto; }

	/* Payment */
	.pay-row { margin-bottom: var(--space-md); }
	.pay-row label {
		display: block; font-size: .82rem; font-weight: 600; color: var(--color-text-secondary);
		margin-bottom: var(--space-xs); text-transform: uppercase; letter-spacing: .02em;
	}
	.pay-input-wrap {
		display: flex; align-items: center; border: 2px solid var(--color-primary);
		border-radius: var(--radius-md); overflow: hidden; background: white;
	}
	.pay-prefix {
		padding: var(--space-sm) var(--space-md); background: var(--color-primary-50);
		color: var(--color-primary-dark); font-weight: 700; font-size: .9rem;
	}
	.pay-input {
		border: 0 !important; font-size: 1.2rem !important; font-weight: 700;
		padding: var(--space-sm) var(--space-md) !important; flex: 1; min-width: 0;
	}
	.pay-input:focus { outline: none; }
	.kembali-row {
		display: flex; justify-content: space-between; align-items: center;
		padding: var(--space-md); background: var(--color-success-light);
		border-radius: var(--radius-md); border: 1px solid #a7f3d0;
	}
	.kembali-val { font-size: 1.3rem; font-weight: 700; color: var(--color-success); }

	/* Actions */
	.sale-actions {
		display: flex; justify-content: flex-end; gap: var(--space-md);
		margin-top: var(--space-lg); padding-top: var(--space-lg);
		border-top: 1px solid var(--color-border);
	}
	.btn-lg { padding: var(--space-sm) var(--space-xl); font-size: 1rem; }

	@media (max-width: 900px) {
		.obat-input-grid { grid-template-columns: 1fr 1fr; }
		.footer-grid { grid-template-columns: 1fr; }
	}
	@media (max-width: 600px) {
		.sale-header-grid { grid-template-columns: 1fr; }
		.obat-input-grid { grid-template-columns: 1fr; }
		.sale-table-header { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
	}
</style>
