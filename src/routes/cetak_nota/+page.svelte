<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	type TransDetail = {
		obat_id: string;
		qty: number;
		harga_obat: number;
		obat_nama: string;
		jenis_nama: string;
	};
	type TransRecord = {
		trans_id: string;
		tanggal_waktu: string;
		total_trans: number;
		total_disc: number;
		bayar: number;
		kembali: number;
		details: TransDetail[];
	};

	let loading = $state(false);
	let transactions = $state<TransRecord[]>([]);
	let dateFrom = $state('');
	let dateTo = $state('');
	let obatQuery = $state('');
	let selectedTrans = $state<TransRecord | null>(null);
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg; toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 4000);
	}

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v));
	}

	function formatTanggal(dt: string): string {
		const d = new Date(dt);
		const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	function formatWaktu(dt: string): string {
		const d = new Date(dt);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function tomorrowOf(dateStr: string): string {
		const d = new Date(`${dateStr}T00:00:00`);
		d.setDate(d.getDate() + 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	async function loadTransactions() {
		if (!dateFrom || !dateTo) return;
		loading = true;

		const startDt = `${dateFrom}T00:00:00+07:00`;
		const endDt = `${tomorrowOf(dateTo)}T00:00:00+07:00`;

		// Load penjualan
		const { data: sales, error: salesError } = await supabase
			.from('penjualan')
			.select('*')
			.gte('tanggal_waktu', startDt)
			.lt('tanggal_waktu', endDt)
			.order('tanggal_waktu', { ascending: false });

		if (salesError) { showToast(`Gagal memuat data: ${salesError.message}`, 'error'); loading = false; return; }
		if (!sales || sales.length === 0) { transactions = []; loading = false; return; }

		const transIds = sales.map((s) => s.trans_id);

		// Load details from detail_penjualan
		const { data: detailsPenjualan, error: detailError } = await supabase
			.from('detail_penjualan')
			.select('*')
			.in('trans_id', transIds);

		if (detailError) { showToast(`Gagal memuat detail penjualan: ${detailError.message}`, 'error'); loading = false; return; }

		// Load details from detail_purchase (for older sales that mistakenly saved there)
		const { data: detailsPurchase, error: purchaseError } = await supabase
			.from('detail_purchase')
			.select('*')
			.in('trans_id', transIds);

		if (purchaseError) { showToast(`Gagal memuat detail purchase: ${purchaseError.message}`, 'error'); loading = false; return; }

		// Combine both details
		const allDetails = [
			...(detailsPenjualan ?? []).map((d) => ({ trans_id: d.trans_id, obat_id: d.obat_id, qty: d.qty, harga_obat: d.harga_obat })),
			...(detailsPurchase ?? []).map((d) => ({ trans_id: d.trans_id, obat_id: d.obat_id, qty: d.qty, harga_obat: d.total_per_obat }))
		];

		// Load obat info
		const obatIds = [...new Set(allDetails.map((d) => d.obat_id))];
		let obatData: any[] = [];
		if (obatIds.length > 0) {
			const { data, error: obatError } = await supabase
				.from('obat')
				.select('obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)')
				.in('obat_id', obatIds);
			if (obatError) {
				showToast(`Gagal memuat obat: ${obatError.message}`, 'error');
			} else {
				obatData = data ?? [];
			}
		}

		const obatMap = new Map<string, { obat_nama: string; jenis_nama: string }>();
		obatData.forEach((o: any) => {
			obatMap.set(o.obat_id, {
				obat_nama: o.obat_nama,
				jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id
			});
		});

		// Combine
		transactions = sales.map((s) => ({
			...s,
			details: allDetails
				.filter((d) => d.trans_id === s.trans_id)
				.map((d) => ({
					...d,
					obat_nama: obatMap.get(d.obat_id)?.obat_nama ?? d.obat_id,
					jenis_nama: obatMap.get(d.obat_id)?.jenis_nama ?? '-'
				}))
		}));

		loading = false;
	}

	function getFilteredTransactions(): TransRecord[] {
		const q = obatQuery.trim().toLowerCase();
		if (!q) return transactions;
		return transactions.filter((t) =>
			t.details.some((d) => d.obat_nama.toLowerCase().includes(q) || d.obat_id.toLowerCase().includes(q))
		);
	}

	function subtotalBeforeDisc(trans: TransRecord): number {
		return trans.details.reduce((s, d) => s + d.qty * d.harga_obat, 0);
	}

	function openPrint(trans: TransRecord) {
		selectedTrans = trans;
		setTimeout(() => window.print(), 300);
	}

	onMount(() => {
		dateFrom = todayStr();
		dateTo = todayStr();
		loadTransactions();
	});
</script>

<div class="page-header no-print">
	<h1>🧾 Cetak Nota</h1>
	<p>Lihat dan cetak ulang nota penjualan</p>
</div>

<!-- Filter Section -->
<section class="nota-card no-print">
	<div class="filter-grid">
		<div class="form-group">
			<label for="date-from">Dari Tanggal</label>
			<input id="date-from" type="date" bind:value={dateFrom} />
		</div>
		<div class="form-group">
			<label for="date-to">Sampai Tanggal</label>
			<input id="date-to" type="date" bind:value={dateTo} />
		</div>
		<div class="form-group">
			<label for="obat-filter">Cari Obat</label>
			<input id="obat-filter" type="text" bind:value={obatQuery} placeholder="Nama atau kode obat..." />
		</div>
		<div class="form-group filter-btn-group">
			<label>&nbsp;</label>
			<button class="btn btn-primary" onclick={loadTransactions} disabled={loading}>
				{loading ? 'Memuat...' : '🔍 Cari'}
			</button>
		</div>
	</div>
</section>

<!-- Results -->
<section class="nota-card no-print">
	<h2>Riwayat Penjualan ({getFilteredTransactions().length} transaksi)</h2>

	{#if loading}
		<div class="table-empty">Memuat data...</div>
	{:else if getFilteredTransactions().length === 0}
		<div class="table-empty">
			<div class="empty-icon">📭</div>
			<div>Tidak ada transaksi ditemukan</div>
		</div>
	{:else}
		<div class="trans-list">
			{#each getFilteredTransactions() as trans}
				<div class="trans-item">
					<div class="trans-header">
						<div class="trans-info">
							<code class="nota-code">{trans.trans_id}</code>
							<span class="trans-date">{formatTanggal(trans.tanggal_waktu)} · {formatWaktu(trans.tanggal_waktu)}</span>
						</div>
						<div class="trans-summary">
							<span class="trans-items-count">{trans.details.length} item</span>
							<span class="trans-total">Rp{formatRp(trans.total_trans)}</span>
							<button class="btn btn-primary btn-sm" onclick={() => openPrint(trans)}>🖨️ Cetak</button>
						</div>
					</div>
					<div class="trans-details">
						<table class="mini-table">
							<thead><tr><th>Obat</th><th>Jenis</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
							<tbody>
								{#each trans.details as d}
									<tr>
										<td><strong>{d.obat_nama}</strong></td>
										<td><span class="jenis-tag">{d.jenis_nama}</span></td>
										<td class="td-center">{d.qty}</td>
										<td class="td-right">Rp{formatRp(d.harga_obat)}</td>
										<td class="td-right"><strong>Rp{formatRp(d.qty * d.harga_obat)}</strong></td>
									</tr>
								{/each}
							</tbody>
						</table>
						<div class="trans-footer-info">
							<span>Diskon: Rp{formatRp(trans.total_disc)}</span>
							<span>Bayar: Rp{formatRp(trans.bayar)}</span>
							<span>Kembali: Rp{formatRp(trans.kembali)}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>

<!-- Print View (only visible during print) -->
{#if selectedTrans}
	<div class="print-only print-nota">
		<div class="print-header">
			<h2>APOTEK PWA</h2>
			<p>Nota Penjualan</p>
		</div>
		<div class="print-info">
			<div><strong>No. Nota:</strong> {selectedTrans.trans_id}</div>
			<div><strong>Tanggal:</strong> {formatTanggal(selectedTrans.tanggal_waktu)} {formatWaktu(selectedTrans.tanggal_waktu)}</div>
		</div>
		<table class="print-table">
			<thead>
				<tr><th>No</th><th>Nama Obat</th><th>Jenis</th><th>Qty</th><th>Harga</th><th>Total</th></tr>
			</thead>
			<tbody>
				{#each selectedTrans.details as d, i}
					<tr>
						<td>{i + 1}</td>
						<td>{d.obat_nama}</td>
						<td>{d.jenis_nama}</td>
						<td class="td-center">{d.qty}</td>
						<td class="td-right">Rp{formatRp(d.harga_obat)}</td>
						<td class="td-right">Rp{formatRp(d.qty * d.harga_obat)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<div class="print-totals">
			<div class="print-row"><span>Subtotal</span><span>Rp{formatRp(subtotalBeforeDisc(selectedTrans))}</span></div>
			{#if selectedTrans.total_disc > 0}
				<div class="print-row"><span>Diskon</span><span>-Rp{formatRp(selectedTrans.total_disc)}</span></div>
			{/if}
			<div class="print-row print-grand"><span>Total</span><span>Rp{formatRp(selectedTrans.total_trans)}</span></div>
			<div class="print-row"><span>Bayar</span><span>Rp{formatRp(selectedTrans.bayar)}</span></div>
			<div class="print-row"><span>Kembali</span><span>Rp{formatRp(selectedTrans.kembali)}</span></div>
		</div>
		<div class="print-footer">
			<p>Terima kasih atas kunjungan Anda</p>
		</div>
	</div>
{/if}

{#if toastMsg}<div class="toast no-print {toastType === 'success' ? 'toast-success' : 'toast-error'}">{toastMsg}</div>{/if}

<style>
	.nota-card {
		background: var(--color-surface); border: 1px solid var(--color-border);
		border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: var(--space-lg);
	}
	.nota-card h2 { font-size: 1.05rem; margin-bottom: var(--space-md); }
	.filter-grid {
		display: grid; grid-template-columns: 1fr 1fr 2fr auto; gap: var(--space-md); align-items: start;
	}
	.filter-btn-group { display: flex; flex-direction: column; justify-content: flex-end; }

	/* Transaction list */
	.trans-list { display: flex; flex-direction: column; gap: var(--space-md); }
	.trans-item {
		border: 1px solid var(--color-border); border-radius: var(--radius-md);
		overflow: hidden; transition: box-shadow var(--transition-fast);
	}
	.trans-item:hover { box-shadow: var(--shadow-md); }
	.trans-header {
		display: flex; justify-content: space-between; align-items: center;
		padding: var(--space-md); background: var(--color-bg);
	}
	.trans-info { display: flex; flex-direction: column; gap: 4px; }
	.nota-code {
		background: #dbeafe; padding: 2px 8px; border-radius: 4px;
		color: #1e40af; font-size: .85rem; font-weight: 600;
	}
	.trans-date { font-size: .82rem; color: var(--color-text-muted); }
	.trans-summary { display: flex; align-items: center; gap: var(--space-md); }
	.trans-items-count {
		background: var(--color-primary-50); color: var(--color-primary-dark);
		padding: 2px 8px; border-radius: 12px; font-size: .78rem; font-weight: 500;
	}
	.trans-total { font-size: 1.1rem; font-weight: 700; color: var(--color-primary-dark); }
	.trans-details { padding: var(--space-md); }
	.trans-footer-info {
		display: flex; gap: var(--space-lg); margin-top: var(--space-sm);
		font-size: .85rem; color: var(--color-text-secondary);
	}

	/* Mini table */
	.mini-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
	.mini-table th {
		text-align: left; padding: var(--space-xs) var(--space-sm);
		font-weight: 600; font-size: .78rem; color: var(--color-text-secondary);
		text-transform: uppercase; border-bottom: 1px solid var(--color-border);
	}
	.mini-table td {
		padding: var(--space-xs) var(--space-sm);
		border-bottom: 1px solid var(--color-border-light);
	}
	.jenis-tag {
		background: var(--color-primary-50); color: var(--color-primary-dark);
		padding: 1px 6px; border-radius: 8px; font-size: .75rem;
	}
	.td-center { text-align: center; }
	.td-right { text-align: right; font-variant-numeric: tabular-nums; }
	.table-empty { text-align: center; padding: var(--space-2xl); color: var(--color-text-muted); }
	.empty-icon { font-size: 2rem; margin-bottom: var(--space-sm); }

	/* Print styles */
	.print-only { display: none; }

	@media print {
		.no-print { display: none !important; }
		.print-only { display: block !important; }

		.print-nota {
			font-family: 'Courier New', monospace; font-size: 12px;
			max-width: 80mm; margin: 0 auto; padding: 8px;
		}
		.print-header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
		.print-header h2 { font-size: 16px; margin-bottom: 4px; }
		.print-header p { font-size: 12px; }
		.print-info { margin-bottom: 12px; font-size: 11px; }
		.print-info div { margin-bottom: 2px; }
		.print-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
		.print-table th { text-align: left; border-bottom: 1px solid #000; padding: 2px 4px; font-size: 10px; }
		.print-table td { padding: 2px 4px; border-bottom: 1px dotted #ccc; }
		.print-totals { border-top: 1px dashed #000; padding-top: 8px; }
		.print-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
		.print-grand { font-weight: bold; font-size: 13px; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 4px 0; }
		.print-footer { text-align: center; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px; font-size: 11px; }
	}

	@media (max-width: 768px) {
		.filter-grid { grid-template-columns: 1fr 1fr; }
		.trans-header { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
		.trans-summary { flex-wrap: wrap; }
	}
	@media (max-width: 480px) {
		.filter-grid { grid-template-columns: 1fr; }
		.trans-footer-info { flex-direction: column; gap: var(--space-xs); }
	}
</style>
