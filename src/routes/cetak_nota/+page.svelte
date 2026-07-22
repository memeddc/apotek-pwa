<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	type TransDetail = {
		obat_id: string;
		qty: number;
		harga_obat: number;
		disc: number;
		total_line: number;
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
		type: 'penjualan' | 'pembelian';
		pbf_nama?: string;
		details: TransDetail[];
	};

	let loading = $state(false);
	let transactions = $state<TransRecord[]>([]);
	let dateFrom = $state('');
	let dateTo = $state('');
	let obatQuery = $state('');
	let transTypeFilter = $state<'all' | 'penjualan' | 'pembelian'>('all');
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
		if (!dt) return '-';
		const d = new Date(dt);
		if (isNaN(d.getTime())) return dt;
		const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
	}

	function formatWaktu(dt: string): string {
		if (!dt) return '-';
		const d = new Date(dt);
		if (isNaN(d.getTime())) return '';
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function daysAgoStr(days: number): string {
		const d = new Date();
		d.setDate(d.getDate() - days);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function tomorrowOf(dateStr: string): string {
		const d = new Date(`${dateStr}T00:00:00`);
		d.setDate(d.getDate() + 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function parseTransDate(transId: string, dtString?: string | null): string {
		if (dtString) {
			const parsed = new Date(dtString);
			if (!isNaN(parsed.getTime())) return parsed.toISOString();
		}
		const cleanId = transId.replace(/^J/, '');
		if (/^\d{8}/.test(cleanId)) {
			const y = cleanId.slice(0, 4);
			const m = cleanId.slice(4, 6);
			const d = cleanId.slice(6, 8);
			return `${y}-${m}-${d}T00:00:00+07:00`;
		}
		return new Date().toISOString();
	}

	function parseDetailItem(
		d: { trans_id: string; obat_id: string; qty: number; total_per_obat?: number; harga_obat?: number; disc?: number },
		transTotal: number,
		rawGroup: any[]
	) {
		const qty = d.qty || 1;
		const disc = Number(d.disc) || 0;

		let unitPrice = 0;
		if (d.harga_obat !== undefined) {
			const val = Number(d.harga_obat) || 0;
			const sumLine = rawGroup.reduce((s, item) => s + (Number(item.harga_obat) || 0), 0);
			const sumUnit = rawGroup.reduce((s, item) => s + ((Number(item.harga_obat) || 0) * (item.qty || 1)), 0);
			if (Math.abs(sumUnit - transTotal) < Math.abs(sumLine - transTotal)) {
				unitPrice = val;
			} else {
				unitPrice = qty > 0 ? val / qty : 0;
			}
		} else {
			const val = Number(d.total_per_obat) || 0;
			const sumLine = rawGroup.reduce((s, item) => s + (Number(item.total_per_obat) || 0), 0);
			const sumUnit = rawGroup.reduce((s, item) => s + ((Number(item.total_per_obat) || 0) * (item.qty || 1)), 0);
			if (Math.abs(sumUnit - transTotal) < Math.abs(sumLine - transTotal)) {
				unitPrice = val;
			} else {
				unitPrice = qty > 0 ? val / qty : 0;
			}
		}

		const total_line = Math.round(qty * unitPrice);

		return {
			trans_id: d.trans_id,
			obat_id: d.obat_id,
			qty,
			harga_obat: Math.round(unitPrice),
			disc,
			total_line
		};
	}

	async function loadTransactions() {
		if (!dateFrom || !dateTo) return;
		loading = true;

		const startDt = `${dateFrom}T00:00:00+07:00`;
		const endDt = `${tomorrowOf(dateTo)}T00:00:00+07:00`;

		const dateFromPrefix = dateFrom.replaceAll('-', '');
		const dateToNextPrefix = tomorrowOf(dateTo).replaceAll('-', '');

		// 1. Load penjualan
		const { data: sales, error: salesError } = await supabase
			.from('penjualan')
			.select('*')
			.gte('tanggal_waktu', startDt)
			.lt('tanggal_waktu', endDt)
			.order('tanggal_waktu', { ascending: false });

		if (salesError) {
			showToast(`Gagal memuat data penjualan: ${salesError.message}`, 'error');
			loading = false;
			return;
		}

		// 2. Load purchase
		const { data: purchases, error: purchaseError } = await supabase
			.from('purchase')
			.select('*')
			.or(`and(tanggal_waktu.gte.${startDt},tanggal_waktu.lt.${endDt}),and(trans_id.gte.${dateFromPrefix},trans_id.lt.${dateToNextPrefix})`)
			.order('trans_id', { ascending: false });

		if (purchaseError) {
			showToast(`Gagal memuat data pembelian: ${purchaseError.message}`, 'error');
			loading = false;
			return;
		}

		// Load PBF master data for purchases
		const { data: pbfList } = await supabase.from('pbf').select('pbf_id, pbf_nama');
		const pbfMap = new Map<string, string>();
		(pbfList ?? []).forEach((p) => pbfMap.set(p.pbf_id, p.pbf_nama));

		const salesList = sales ?? [];
		const purchasesList = purchases ?? [];

		const salesTransIds = salesList.map((s) => s.trans_id);
		const purchaseTransIds = purchasesList.map((p) => p.trans_id);
		const allTransIds = [...new Set([...salesTransIds, ...purchaseTransIds])];

		if (allTransIds.length === 0) {
			transactions = [];
			loading = false;
			return;
		}

		// 3. Load details from detail_penjualan and detail_purchase
		const [{ data: detailsPenjualan }, { data: detailsPurchase }] = await Promise.all([
			supabase.from('detail_penjualan').select('*').in('trans_id', allTransIds),
			supabase.from('detail_purchase').select('*').in('trans_id', allTransIds)
		]);

		const dpList = detailsPenjualan ?? [];
		const dpurList = detailsPurchase ?? [];

		// Collect all obat_ids for name lookup
		const obatIds = [...new Set([...dpList.map((d) => d.obat_id), ...dpurList.map((d) => d.obat_id)])];
		let obatData: any[] = [];
		if (obatIds.length > 0) {
			const { data: oData, error: obatError } = await supabase
				.from('obat')
				.select('obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)')
				.in('obat_id', obatIds);

			if (obatError) {
				showToast(`Gagal memuat detail obat: ${obatError.message}`, 'error');
			} else {
				obatData = oData ?? [];
			}
		}

		const obatMap = new Map<string, { obat_nama: string; jenis_nama: string }>();
		obatData.forEach((o: any) => {
			obatMap.set(o.obat_id, {
				obat_nama: o.obat_nama,
				jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id ?? '-'
			});
		});

		// Build sales transactions
		const mappedSales: TransRecord[] = salesList.map((s) => {
			const rawItemsPenjualan = dpList.filter((d) => d.trans_id === s.trans_id);
			const rawItemsPurchase = dpurList.filter((d) => d.trans_id === s.trans_id);

			let itemDetails: TransDetail[] = [];
			if (rawItemsPenjualan.length > 0) {
				itemDetails = rawItemsPenjualan.map((d) => {
					const parsed = parseDetailItem(d, s.total_trans, rawItemsPenjualan);
					const oInfo = obatMap.get(d.obat_id);
					return {
						...parsed,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-'
					};
				});
			} else if (rawItemsPurchase.length > 0) {
				itemDetails = rawItemsPurchase.map((d) => {
					const parsed = parseDetailItem(d, s.total_trans, rawItemsPurchase);
					const oInfo = obatMap.get(d.obat_id);
					return {
						...parsed,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-'
					};
				});
			}

			return {
				trans_id: s.trans_id,
				tanggal_waktu: parseTransDate(s.trans_id, s.tanggal_waktu),
				total_trans: Number(s.total_trans) || 0,
				total_disc: Number(s.total_disc) || 0,
				bayar: Number(s.bayar) || Number(s.total_trans) || 0,
				kembali: Number(s.kembali) || 0,
				type: 'penjualan',
				details: itemDetails
			};
		});

		// Build purchase transactions
		const mappedPurchases: TransRecord[] = purchasesList.map((p) => {
			const rawItemsPurchase = dpurList.filter((d) => d.trans_id === p.trans_id);
			const rawItemsPenjualan = dpList.filter((d) => d.trans_id === p.trans_id);

			let itemDetails: TransDetail[] = [];
			if (rawItemsPurchase.length > 0) {
				itemDetails = rawItemsPurchase.map((d) => {
					const parsed = parseDetailItem(d, p.total_trans, rawItemsPurchase);
					const oInfo = obatMap.get(d.obat_id);
					return {
						...parsed,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-'
					};
				});
			} else if (rawItemsPenjualan.length > 0) {
				itemDetails = rawItemsPenjualan.map((d) => {
					const parsed = parseDetailItem(d, p.total_trans, rawItemsPenjualan);
					const oInfo = obatMap.get(d.obat_id);
					return {
						...parsed,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-'
					};
				});
			}

			return {
				trans_id: p.trans_id,
				tanggal_waktu: parseTransDate(p.trans_id, p.tanggal_waktu),
				total_trans: Number(p.total_trans) || 0,
				total_disc: Number(p.total_disc) || 0,
				bayar: Number(p.total_trans) || 0,
				kembali: 0,
				type: 'pembelian',
				pbf_nama: pbfMap.get(p.pbf_id) ?? p.pbf_id,
				details: itemDetails
			};
		});

		// Combine and sort by date descending
		const allRecords = [...mappedSales, ...mappedPurchases];
		allRecords.sort((a, b) => new Date(b.tanggal_waktu).getTime() - new Date(a.tanggal_waktu).getTime());

		transactions = allRecords;
		loading = false;
	}

	function getFilteredTransactions(): TransRecord[] {
		const q = obatQuery.trim().toLowerCase();
		return transactions.filter((t) => {
			if (transTypeFilter !== 'all' && t.type !== transTypeFilter) return false;
			if (!q) return true;
			const matchTransId = t.trans_id.toLowerCase().includes(q);
			const matchPbf = t.pbf_nama?.toLowerCase().includes(q) ?? false;
			const matchObat = t.details.some(
				(d) => d.obat_nama.toLowerCase().includes(q) || d.obat_id.toLowerCase().includes(q)
			);
			return matchTransId || matchPbf || matchObat;
		});
	}

	function subtotalBeforeDisc(trans: TransRecord): number {
		return trans.details.reduce((s, d) => s + d.qty * d.harga_obat, 0);
	}

	function openPrint(trans: TransRecord) {
		selectedTrans = trans;
		setTimeout(() => window.print(), 300);
	}

	onMount(() => {
		dateFrom = daysAgoStr(7);
		dateTo = todayStr();
		loadTransactions();
	});
</script>

<div class="page-header no-print">
	<h1>🧾 Cetak Nota</h1>
	<p>Lihat dan cetak ulang nota penjualan & faktur pembelian dari detail transaction (`detail_purchase` / `detail_penjualan`)</p>
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
			<label for="trans-type">Tipe Transaksi</label>
			<select id="trans-type" bind:value={transTypeFilter}>
				<option value="all">Semua Transaksi</option>
				<option value="penjualan">🛒 Penjualan</option>
				<option value="pembelian">📦 Pembelian (Faktur)</option>
			</select>
		</div>
		<div class="form-group">
			<label for="obat-filter">Cari Obat / No. Nota / PBF</label>
			<input id="obat-filter" type="text" bind:value={obatQuery} placeholder="Nama, kode obat, nota, atau supplier..." />
		</div>
		<div class="form-group filter-btn-group">
			<span class="label-spacer" aria-hidden="true">&nbsp;</span>
			<button class="btn btn-primary" onclick={loadTransactions} disabled={loading}>
				{loading ? 'Memuat...' : '🔍 Cari'}
			</button>
		</div>
	</div>
</section>

<!-- Results -->
<section class="nota-card no-print">
	<h2>Riwayat Transaksi ({getFilteredTransactions().length} transaksi)</h2>

	{#if loading}
		<div class="table-empty">Memuat data transaksi...</div>
	{:else if getFilteredTransactions().length === 0}
		<div class="table-empty">
			<div class="empty-icon">📭</div>
			<div>Tidak ada transaksi ditemukan untuk filter ini</div>
		</div>
	{:else}
		<div class="trans-list">
			{#each getFilteredTransactions() as trans}
				<div class="trans-item">
					<div class="trans-header">
						<div class="trans-info">
							<div class="trans-title-row">
								<code class="nota-code">{trans.trans_id}</code>
								{#if trans.type === 'penjualan'}
									<span class="type-badge badge-sale">🛒 Penjualan</span>
								{:else}
									<span class="type-badge badge-purchase">📦 Pembelian (PBF: {trans.pbf_nama ?? '-'})</span>
								{/if}
							</div>
							<span class="trans-date">{formatTanggal(trans.tanggal_waktu)} {formatWaktu(trans.tanggal_waktu)}</span>
						</div>
						<div class="trans-summary">
							<span class="trans-items-count">{trans.details.length} item</span>
							<span class="trans-total">Rp{formatRp(trans.total_trans)}</span>
							<button class="btn btn-primary btn-sm" onclick={() => openPrint(trans)}>🖨️ Cetak Nota</button>
						</div>
					</div>
					<div class="trans-details">
						<table class="mini-table">
							<thead>
								<tr>
									<th>Obat</th>
									<th>Jenis</th>
									<th class="td-center">Qty</th>
									<th class="td-right">Harga Satuan</th>
									{#if trans.details.some(d => d.disc > 0)}
										<th class="td-right">Diskon</th>
									{/if}
									<th class="td-right">Total</th>
								</tr>
							</thead>
							<tbody>
								{#each trans.details as d}
									<tr>
										<td><strong>{d.obat_nama}</strong> <span class="obat-code">({d.obat_id})</span></td>
										<td><span class="jenis-tag">{d.jenis_nama}</span></td>
										<td class="td-center">{d.qty}</td>
										<td class="td-right">Rp{formatRp(d.harga_obat)}</td>
										{#if trans.details.some(item => item.disc > 0)}
											<td class="td-right">{d.disc > 0 ? `${d.disc}%` : '-'}</td>
										{/if}
										<td class="td-right"><strong>Rp{formatRp(d.total_line)}</strong></td>
									</tr>
								{/each}
							</tbody>
						</table>
						<div class="trans-footer-info">
							<span>Subtotal: Rp{formatRp(subtotalBeforeDisc(trans))}</span>
							<span>Diskon Total: Rp{formatRp(trans.total_disc)}</span>
							<span>Net Total: Rp{formatRp(trans.total_trans)}</span>
							{#if trans.type === 'penjualan'}
								<span>Bayar: Rp{formatRp(trans.bayar)}</span>
								<span>Kembali: Rp{formatRp(trans.kembali)}</span>
							{/if}
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
			<p>{selectedTrans.type === 'penjualan' ? 'Nota Penjualan' : 'Nota / Bukti Pembelian'}</p>
		</div>
		<div class="print-info">
			<div><strong>No. Nota:</strong> {selectedTrans.trans_id}</div>
			<div><strong>Tanggal:</strong> {formatTanggal(selectedTrans.tanggal_waktu)} {formatWaktu(selectedTrans.tanggal_waktu)}</div>
			{#if selectedTrans.type === 'pembelian' && selectedTrans.pbf_nama}
				<div><strong>Supplier (PBF):</strong> {selectedTrans.pbf_nama}</div>
			{/if}
		</div>
		<table class="print-table">
			<thead>
				<tr>
					<th>No</th>
					<th>Nama Obat</th>
					<th>Jenis</th>
					<th class="td-center">Qty</th>
					<th class="td-right">Harga</th>
					<th class="td-right">Total</th>
				</tr>
			</thead>
			<tbody>
				{#each selectedTrans.details as d, i}
					<tr>
						<td>{i + 1}</td>
						<td>{d.obat_nama}</td>
						<td>{d.jenis_nama}</td>
						<td class="td-center">{d.qty}</td>
						<td class="td-right">Rp{formatRp(d.harga_obat)}</td>
						<td class="td-right">Rp{formatRp(d.total_line)}</td>
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
			{#if selectedTrans.type === 'penjualan'}
				<div class="print-row"><span>Bayar</span><span>Rp{formatRp(selectedTrans.bayar)}</span></div>
				<div class="print-row"><span>Kembali</span><span>Rp{formatRp(selectedTrans.kembali)}</span></div>
			{/if}
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
		display: grid; grid-template-columns: 1fr 1fr 1.2fr 2fr auto; gap: var(--space-md); align-items: start;
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
	.trans-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.nota-code {
		background: #dbeafe; padding: 2px 8px; border-radius: 4px;
		color: #1e40af; font-size: .85rem; font-weight: 600;
	}
	.type-badge {
		font-size: .75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;
	}
	.badge-sale { background: #dcfce7; color: #166534; }
	.badge-purchase { background: #f3e8ff; color: #6b21a8; }

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
		font-size: .85rem; color: var(--color-text-secondary); flex-wrap: wrap;
	}

	.obat-code { font-size: .75rem; color: var(--color-text-muted); font-weight: normal; }

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
