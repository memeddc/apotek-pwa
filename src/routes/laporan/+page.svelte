<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PageHeader } from '$lib/components/ui/page-header';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import {
		BarChart3,
		Calendar,
		Printer,
		ShoppingCart,
		Package,
		TrendingUp,
		Building2,
		Receipt,
		FileText,
		FileSpreadsheet,
		Layers,
		CalendarDays
	} from 'lucide-svelte';

	type SaleItem = {
		trans_id: string;
		tanggal_waktu: string;
		date_str: string;
		total_trans: number;
		total_disc: number;
		bayar: number;
		kembali: number;
		details: Array<{
			obat_id: string;
			obat_nama: string;
			jenis_nama: string;
			qty: number;
			harga_obat: number;
			total_line: number;
		}>;
	};

	type PurchaseItem = {
		trans_id: string;
		pbf_id: string;
		pbf_nama: string;
		tanggal_waktu: string;
		date_str: string;
		total_trans: number;
		total_disc: number;
		details: Array<{
			obat_id: string;
			obat_nama: string;
			jenis_nama: string;
			qty: number;
			total_per_obat: number;
			disc: number;
			total_line: number;
		}>;
	};

	type ObatSummaryRow = {
		obat_id: string;
		obat_nama: string;
		jenis_nama: string;
		pbf_nama?: string;
		total_qty: number;
		total_rp: number;
	};

	let loading = $state(false);
	let dateFrom = $state('');
	let dateTo = $state('');
	let isPerHari = $state(false); // Switch: false = Akumulasi, true = PerHari
	let selectedDateTab = $state<string>(''); // Currently selected YYYY-MM-DD tab when isPerHari is true
	let activeReportSubTab = $state<'obat_terjual' | 'obat_dibeli' | 'nota_penjualan' | 'faktur_pembelian'>('obat_terjual');

	let allSales = $state<SaleItem[]>([]);
	let allPurchases = $state<PurchaseItem[]>([]);

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v || 0));
	}

	function formatTanggalIndo(dtStr: string): string {
		if (!dtStr) return '-';
		const d = new Date(`${dtStr}T00:00:00`);
		if (isNaN(d.getTime())) return dtStr;
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
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

	/**
	 * Extract date string (YYYY-MM-DD) from timestamp or fallback to YYYYMMDD prefix in trans_id.
	 */
	function extractDateStr(transId: string, dtString?: string | null): string {
		if (dtString) {
			const parsed = new Date(dtString);
			if (!isNaN(parsed.getTime())) {
				const y = parsed.getFullYear();
				const m = String(parsed.getMonth() + 1).padStart(2, '0');
				const d = String(parsed.getDate()).padStart(2, '0');
				return `${y}-${m}-${d}`;
			}
		}
		const match = (transId || '').match(/\d{8}/);
		if (match) {
			const raw = match[0];
			const y = raw.slice(0, 4);
			const m = raw.slice(4, 6);
			const d = raw.slice(6, 8);
			return `${y}-${m}-${d}`;
		}
		return todayStr();
	}

	function generateDateRange(from: string, to: string): string[] {
		if (!from || !to) return [];
		const dates: string[] = [];
		let curr = new Date(`${from}T00:00:00`);
		const end = new Date(`${to}T00:00:00`);
		while (curr <= end) {
			const y = curr.getFullYear();
			const m = String(curr.getMonth() + 1).padStart(2, '0');
			const d = String(curr.getDate()).padStart(2, '0');
			dates.push(`${y}-${m}-${d}`);
			curr.setDate(curr.getDate() + 1);
		}
		return dates;
	}

	async function fetchInChunks<T>(
		tableName: string,
		selectFields: string,
		column: string,
		values: string[],
		chunkSize = 50
	): Promise<T[]> {
		if (values.length === 0) return [];
		const chunks: string[][] = [];
		for (let i = 0; i < values.length; i += chunkSize) {
			chunks.push(values.slice(i, i + chunkSize));
		}
		const responses = await Promise.all(
			chunks.map((chunk) =>
				supabase.from(tableName).select(selectFields).in(column, chunk)
			)
		);
		const results: T[] = [];
		for (const res of responses) {
			if (res.data) results.push(...(res.data as T[]));
		}
		return results;
	}

	function getActiveSalesDates(): string[] {
		const datesSet = new Set<string>();
		allSales.forEach((s) => {
			if (s.date_str) datesSet.add(s.date_str);
		});
		return [...datesSet].sort();
	}

	function validatePerHariConstraint(silent = false): boolean {
		if (!isPerHari) return true;
		const activeSalesDates = getActiveSalesDates();
		const count = activeSalesDates.length;

		if (count > 7) {
			isPerHari = false;
			if (!silent) {
				const maxAllowedDate = activeSalesDates[6];
				const eighthDate = activeSalesDates[7];
				toast.error(
					`Mode PerHari maksimal 7 tanggal (1 minggu) transaksi penjualan!\n` +
					`Ditemukan ${count} tanggal yang memiliki penjualan pada periode ini.\n` +
					`Batas 7 hari (1 minggu) penjualan tercapai pada tanggal ${formatTanggalIndo(maxAllowedDate)} (tanggal ${formatTanggalIndo(eighthDate)} dst tidak muat). Mode dialihkan otomatis ke Akumulasi.`
				);
			}
			return false;
		}

		if (count > 0 && !activeSalesDates.includes(selectedDateTab)) {
			selectedDateTab = activeSalesDates[0];
		}
		return true;
	}

	function togglePerHari() {
		if (!isPerHari) {
			const activeSalesDates = getActiveSalesDates();
			const count = activeSalesDates.length;

			if (count === 0) {
				toast.error('Tidak ada transaksi penjualan pada rentang tanggal ini untuk ditampilkan per-hari.');
				return;
			}

			if (count > 7) {
				const maxAllowedDate = activeSalesDates[6];
				const eighthDate = activeSalesDates[7];
				toast.error(
					`Mode PerHari maksimal 7 tanggal (1 minggu) transaksi penjualan!\n` +
					`Ditemukan ${count} tanggal yang memiliki penjualan pada rentang ini.\n` +
					`Maksimal 7 tanggal (1 minggu) penjualan hanya sampai tanggal ${formatTanggalIndo(maxAllowedDate)} (tanggal ${formatTanggalIndo(eighthDate)} dst melebihi kuota 1 minggu).`
				);
				return;
			}

			isPerHari = true;
			if (!activeSalesDates.includes(selectedDateTab)) {
				selectedDateTab = activeSalesDates[0];
			}
		} else {
			isPerHari = false;
		}
	}

	function onDateChange() {
		if (isPerHari) {
			validatePerHariConstraint(false);
		}
	}

	async function loadReportData() {
		if (!dateFrom || !dateTo) return;

		validatePerHariConstraint(false);

		loading = true;

		const startDt = `${dateFrom}T00:00:00+07:00`;
		const endDt = `${tomorrowOf(dateTo)}T00:00:00+07:00`;
		const dateFromPrefix = dateFrom.replaceAll('-', '');
		const dateToNextPrefix = tomorrowOf(dateTo).replaceAll('-', '');

		// Query sales & purchases
		const [{ data: salesData, error: sErr }, { data: purchaseData, error: pErr }] = await Promise.all([
			supabase
				.from('penjualan')
				.select('*')
				.or(`and(tanggal_waktu.gte.${startDt},tanggal_waktu.lt.${endDt}),and(trans_id.gte.${dateFromPrefix},trans_id.lt.${dateToNextPrefix}),and(trans_id.gte.J${dateFromPrefix},trans_id.lt.J${dateToNextPrefix})`)
				.order('trans_id', { ascending: false }),
			supabase
				.from('purchase')
				.select('*, pbf(pbf_nama)')
				.or(`and(tanggal_waktu.gte.${startDt},tanggal_waktu.lt.${endDt}),and(trans_id.gte.${dateFromPrefix},trans_id.lt.${dateToNextPrefix})`)
				.order('trans_id', { ascending: false })
		]);

		if (sErr) toast.error(`Gagal memuat penjualan: ${sErr.message}`);
		if (pErr) toast.error(`Gagal memuat pembelian: ${pErr.message}`);

		const rawSales = salesData ?? [];
		const rawPurchases = purchaseData ?? [];

		const salesIds = rawSales.map((s) => s.trans_id);
		const purchaseIds = rawPurchases.map((p) => p.trans_id);

		// Fetch details
		const [dpList, dpurList] = await Promise.all([
			fetchInChunks<any>('detail_penjualan', '*', 'trans_id', salesIds),
			fetchInChunks<any>('detail_purchase', '*', 'trans_id', purchaseIds)
		]);

		// Extract unique obat_ids
		const allObatIds = [...new Set([...dpList.map((d) => d.obat_id), ...dpurList.map((d) => d.obat_id)])];
		const obatData = await fetchInChunks<any>(
			'obat',
			'obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)',
			'obat_id',
			allObatIds
		);

		const obatMap = new Map<string, { obat_nama: string; jenis_nama: string }>();
		obatData.forEach((o: any) => {
			obatMap.set(o.obat_id, {
				obat_nama: o.obat_nama,
				jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id ?? '-'
			});
		});

		// Map Sales
		allSales = rawSales
			.map((s) => {
				const date_str = extractDateStr(s.trans_id, s.tanggal_waktu);
				const items = dpList.filter((d) => d.trans_id === s.trans_id);
				const details = items.map((d) => {
					const qty = Number(d.qty) || 1;
					const harga_obat = Number(d.harga_obat) || 0;
					const oInfo = obatMap.get(d.obat_id);
					return {
						obat_id: d.obat_id,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-',
						qty,
						harga_obat,
						total_line: Math.round(qty * harga_obat)
					};
				});

				return {
					trans_id: s.trans_id,
					tanggal_waktu: s.tanggal_waktu,
					date_str,
					total_trans: Number(s.total_trans) || 0,
					total_disc: Number(s.total_disc) || 0,
					bayar: Number(s.bayar) || Number(s.total_trans) || 0,
					kembali: Number(s.kembali) || 0,
					details
				};
			})
			.filter((s) => s.date_str >= dateFrom && s.date_str <= dateTo);

		// Map Purchases
		allPurchases = rawPurchases
			.map((p) => {
				const date_str = extractDateStr(p.trans_id, p.tanggal_waktu);
				const items = dpurList.filter((d) => d.trans_id === p.trans_id);
				const details = items.map((d) => {
					const qty = Number(d.qty) || 1;
					const totalPerObat = Number(d.total_per_obat) || 0;
					const disc = Number(d.disc) || 0;
					const discRp = disc > 0 ? (disc <= 100 ? (totalPerObat * disc) / 100 : disc) : 0;
					const total_line = Math.max(0, Math.round(totalPerObat - discRp));
					const oInfo = obatMap.get(d.obat_id);

					return {
						obat_id: d.obat_id,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-',
						qty,
						total_per_obat: totalPerObat,
						disc,
						total_line
					};
				});

				return {
					trans_id: p.trans_id,
					pbf_id: p.pbf_id,
					pbf_nama: p.pbf?.pbf_nama ?? p.pbf_id ?? 'PBF',
					tanggal_waktu: p.tanggal_waktu,
					date_str,
					total_trans: Number(p.total_trans) || 0,
					total_disc: Number(p.total_disc) || 0,
					details
				};
			})
			.filter((p) => p.date_str >= dateFrom && p.date_str <= dateTo);

		// Set default date tab if not set
		const activeSalesDates = getActiveSalesDates();
		if (activeSalesDates.length > 0 && !activeSalesDates.includes(selectedDateTab)) {
			selectedDateTab = activeSalesDates[0];
		}

		validatePerHariConstraint(false);
		loading = false;
	}

	// Dynamic Computed Filtered Data
	function getFilteredSales(): SaleItem[] {
		if (isPerHari && selectedDateTab) {
			return allSales.filter((s) => s.date_str === selectedDateTab);
		}
		return allSales;
	}

	function getFilteredPurchases(): PurchaseItem[] {
		if (isPerHari && selectedDateTab) {
			return allPurchases.filter((p) => p.date_str === selectedDateTab);
		}
		return allPurchases;
	}

	// KPI Metrics
	function calcTotalOmset(): number {
		return getFilteredSales().reduce((sum, s) => sum + s.total_trans, 0);
	}

	function calcTotalPembelian(): number {
		return getFilteredPurchases().reduce((sum, p) => sum + p.total_trans, 0);
	}

	function calcGrossProfit(): number {
		return calcTotalOmset() - calcTotalPembelian();
	}

	function calcProfitMarginPct(): number {
		const omset = calcTotalOmset();
		if (omset <= 0) return 0;
		return Math.round((calcGrossProfit() / omset) * 100);
	}

	// Summary Tables (Obat Terjual & Obat Dibeli)
	function getObatTerjualSummary(): ObatSummaryRow[] {
		const sales = getFilteredSales();
		const map = new Map<string, ObatSummaryRow>();

		sales.forEach((s) => {
			s.details.forEach((d) => {
				const curr = map.get(d.obat_id) ?? {
					obat_id: d.obat_id,
					obat_nama: d.obat_nama,
					jenis_nama: d.jenis_nama,
					total_qty: 0,
					total_rp: 0
				};
				curr.total_qty += d.qty;
				curr.total_rp += d.total_line;
				map.set(d.obat_id, curr);
			});
		});

		return Array.from(map.values()).sort((a, b) => b.total_rp - a.total_rp);
	}

	function getObatDibeliSummary(): ObatSummaryRow[] {
		const purchases = getFilteredPurchases();
		const map = new Map<string, ObatSummaryRow>();

		purchases.forEach((p) => {
			p.details.forEach((d) => {
				const key = `${d.obat_id}_${p.pbf_nama}`;
				const curr = map.get(key) ?? {
					obat_id: d.obat_id,
					obat_nama: d.obat_nama,
					jenis_nama: d.jenis_nama,
					pbf_nama: p.pbf_nama,
					total_qty: 0,
					total_rp: 0
				};
				curr.total_qty += d.qty;
				curr.total_rp += d.total_line;
				map.set(key, curr);
			});
		});

		return Array.from(map.values()).sort((a, b) => b.total_rp - a.total_rp);
	}

	function downloadPDF() {
		if (allSales.length === 0 && allPurchases.length === 0) {
			toast.error('Tidak ada data laporan untuk dicetak/diunduh.');
			return;
		}
		setTimeout(() => window.print(), 100);
	}

	function downloadExcel() {
		if (allSales.length === 0 && allPurchases.length === 0) {
			toast.error('Tidak ada data laporan untuk diunduh.');
			return;
		}

		const modeText = isPerHari ? `PerHari_${selectedDateTab}` : 'Akumulasi';
		const filename = `Laporan_Apotek_${dateFrom}_sd_${dateTo}_${modeText}.xls`;

		const obatTerjual = getObatTerjualSummary();
		const obatDibeli = getObatDibeliSummary();
		const sales = getFilteredSales();
		const purchases = getFilteredPurchases();

		const html = `
			<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
			<head>
				<meta charset="utf-8" />
				<!--[if gte mso 9]>
				<xml>
					<x:ExcelWorkbook>
						<x:ExcelWorksheets>
							<x:ExcelWorksheet>
								<x:Name>Laporan Apotek</x:Name>
								<x:WorksheetOptions>
									<x:DisplayGridlines/>
								</x:WorksheetOptions>
							</x:ExcelWorksheet>
						</x:ExcelWorksheets>
					</x:ExcelWorkbook>
				</xml>
				<![endif]-->
				<style>
					table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; }
					th { background-color: #0f766e; color: #ffffff; font-weight: bold; border: 1px solid #cccccc; padding: 6px; }
					td { border: 1px solid #cccccc; padding: 5px; }
					.title { font-size: 16px; font-weight: bold; color: #0f766e; }
					.subtitle { font-size: 12px; color: #475569; }
					.num { text-align: right; }
					.center { text-align: center; }
					.section-header { font-size: 13px; font-weight: bold; background: #e2e8f0; padding: 8px; margin-top: 15px; }
				</style>
			</head>
			<body>
				<div class="title">APOTEK PWA — LAPORAN TRANSAKSI & KEUANGAN</div>
				<div class="subtitle">Periode: ${formatTanggalIndo(dateFrom)} s/d ${formatTanggalIndo(dateTo)} | Mode: ${isPerHari ? `PerHari (${formatTanggalIndo(selectedDateTab)})` : 'Akumulasi Total'}</div>
				<br/>

				<div class="section-header">1. RINGKASAN KEUANGAN</div>
				<table>
					<tr><th>Total Omset Penjualan</th><th>Total Pembelian PBF</th><th>Selisih Margin (Profit)</th><th>Margin %</th></tr>
					<tr>
						<td class="num">Rp ${formatRp(calcTotalOmset())}</td>
						<td class="num">Rp ${formatRp(calcTotalPembelian())}</td>
						<td class="num">Rp ${formatRp(calcGrossProfit())}</td>
						<td class="center">${calcProfitMarginPct()}%</td>
					</tr>
				</table>
				<br/>

				<div class="section-header">2. RINGKASAN PENJUALAN OBAT</div>
				<table>
					<tr><th>No</th><th>Kode Obat</th><th>Nama Obat</th><th>Jenis</th><th>Total Qty Terjual</th><th>Total Penjualan (Rp)</th></tr>
					${obatTerjual.map((o, i) => `
						<tr>
							<td class="center">${i + 1}</td>
							<td>${o.obat_id}</td>
							<td>${o.obat_nama}</td>
							<td>${o.jenis_nama}</td>
							<td class="center">${o.total_qty}</td>
							<td class="num">Rp ${formatRp(o.total_rp)}</td>
						</tr>
					`).join('')}
				</table>
				<br/>

				<div class="section-header">3. RINGKASAN PEMBELIAN OBAT (PBF)</div>
				<table>
					<tr><th>No</th><th>Kode Obat</th><th>Nama Obat</th><th>Supplier PBF</th><th>Total Qty Masuk</th><th>Total Pembelian (Rp)</th></tr>
					${obatDibeli.map((o, i) => `
						<tr>
							<td class="center">${i + 1}</td>
							<td>${o.obat_id}</td>
							<td>${o.obat_nama}</td>
							<td>${o.pbf_nama}</td>
							<td class="center">+${o.total_qty}</td>
							<td class="num">Rp ${formatRp(o.total_rp)}</td>
						</tr>
					`).join('')}
				</table>
				<br/>

				<div class="section-header">4. DAFTAR NOTA PENJUALAN</div>
				<table>
					<tr><th>No. Nota</th><th>Tanggal & Waktu</th><th>Total (Rp)</th><th>Bayar (Rp)</th><th>Kembali (Rp)</th></tr>
					${sales.map((s) => `
						<tr>
							<td>${s.trans_id}</td>
							<td>${formatTanggalIndo(s.date_str)} ${formatWaktu(s.tanggal_waktu)}</td>
							<td class="num">Rp ${formatRp(s.total_trans)}</td>
							<td class="num">Rp ${formatRp(s.bayar)}</td>
							<td class="num">Rp ${formatRp(s.kembali)}</td>
						</tr>
					`).join('')}
				</table>
				<br/>

				<div class="section-header">5. DAFTAR FAKTUR PEMBELIAN PBF</div>
				<table>
					<tr><th>No. Faktur</th><th>Supplier PBF</th><th>Tanggal & Waktu</th><th>Total Faktur (Rp)</th></tr>
					${purchases.map((p) => `
						<tr>
							<td>${p.trans_id}</td>
							<td>${p.pbf_nama}</td>
							<td>${formatTanggalIndo(p.date_str)} ${formatWaktu(p.tanggal_waktu)}</td>
							<td class="num">Rp ${formatRp(p.total_trans)}</td>
						</tr>
					`).join('')}
				</table>
			</body>
			</html>
		`;

		const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		toast.success(`File Excel "${filename}" berhasil diunduh.`);
	}

	onMount(() => {
		dateFrom = daysAgoStr(7);
		dateTo = todayStr();
		loadReportData();
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="print:hidden">
		<PageHeader
			title="Laporan Transaksi & Keuangan"
			description="Analisis akumulasi & harian untuk penjualan, pembelian PBF, dan margin omset"
			badge={`${allSales.length} Penjualan`}
		>
			{#snippet actions()}
				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={downloadPDF} class="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer">
						<FileText class="w-4 h-4 mr-1.5 text-rose-600" /> PDF
					</Button>
					<Button variant="outline" size="sm" onclick={downloadExcel} class="text-xs border-mint-200 text-mint-700 hover:bg-mint-50 rounded-xl cursor-pointer">
						<FileSpreadsheet class="w-4 h-4 mr-1.5 text-mint-600" /> Excel
					</Button>
				</div>
			{/snippet}
		</PageHeader>
	</div>

	<!-- Filter Card & Switch Controls -->
	<Card class="rounded-2xl border-slate-200/80 shadow-2xs print:hidden">
		<CardContent class="pt-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
				<!-- Begda (Dari Tanggal) -->
				<div class="lg:col-span-4 space-y-1">
					<label for="date-from" class="text-xs font-semibold text-slate-600">Dari Tanggal (Begda)</label>
					<DatePicker id="date-from" bind:value={dateFrom} onchange={onDateChange} placeholder="Pilih dari tanggal..." />
				</div>

				<!-- Endda (Sampai Tanggal) -->
				<div class="lg:col-span-4 space-y-1">
					<label for="date-to" class="text-xs font-semibold text-slate-600">Sampai Tanggal (Endda)</label>
					<DatePicker id="date-to" bind:value={dateTo} onchange={onDateChange} placeholder="Pilih sampai tanggal..." />
				</div>

				<!-- PerHari Switch Toggle -->
				<div class="lg:col-span-4 flex items-center justify-between sm:justify-start gap-4 pb-1">
					<div class="flex items-center gap-3">
						<button
							type="button"
							role="switch"
							aria-label="Mode PerHari"
							aria-checked={isPerHari}
							onclick={togglePerHari}
							class={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
								isPerHari ? 'bg-mint-500' : 'bg-slate-300'
							}`}
						>
							<span
								class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
									isPerHari ? 'translate-x-5' : 'translate-x-0'
								}`}
							></span>
						</button>
						<div>
							<span class="text-xs font-bold text-slate-800 block">Mode PerHari (Maks 7 Hari / 1 Minggu)</span>
							<span class="text-[10px] text-slate-400">
								{isPerHari ? 'Tampilkan tabs per tanggal' : 'Akumulasi total periode'}
							</span>
						</div>
					</div>

					<Button size="sm" onclick={loadReportData} disabled={loading} class="ml-auto bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-xl px-4 cursor-pointer">
						{loading ? 'Memuat...' : 'Proses'}
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Date Tabs (Only visible when isPerHari switch is ON) -->
	{#if isPerHari && !loading}
		<div class="space-y-2 print:hidden">
			<div class="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
				<CalendarDays class="w-4 h-4 text-teal-600" />
				Pilih Tanggal Laporan Penjualan ({getActiveSalesDates().length} Tanggal Ada Penjualan):
			</div>
			<div class="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
				{#each getActiveSalesDates() as dStr}
					{@const sCount = allSales.filter((s) => s.date_str === dStr).length}
					{@const pCount = allPurchases.filter((p) => p.date_str === dStr).length}
					<button
						type="button"
						onclick={() => (selectedDateTab = dStr)}
						class={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 border ${
							selectedDateTab === dStr
								? 'bg-teal-600 text-white border-teal-600 shadow-sm'
								: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
						}`}
					>
						<span>{formatTanggalIndo(dStr)}</span>
						<span
							class={`px-1.5 py-0.5 rounded-full text-[10px] ${
								selectedDateTab === dStr ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-700 border border-teal-100'
							}`}
						>
							{sCount} penjualan
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Report Top KPI Stats Cards -->
	{#if loading}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
			{#each Array(4) as _}
				<Skeleton class="h-28 w-full rounded-xl" />
			{/each}
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
			<!-- Total Omset -->
			<Card class="border-slate-200 shadow-xs bg-gradient-to-br from-white to-teal-50/30">
				<CardContent class="pt-4 pb-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-500">Total Omset Penjualan</span>
						<div class="p-2 rounded-lg bg-teal-100/60 text-teal-700">
							<ShoppingCart class="w-4 h-4" />
						</div>
					</div>
					<div class="text-xl font-bold text-slate-900 mt-2 font-mono">
						Rp{formatRp(calcTotalOmset())}
					</div>
					<div class="text-[10px] text-slate-400 mt-1">
						Dari {getFilteredSales().length} transaksi penjualan
					</div>
				</CardContent>
			</Card>

			<!-- Total Pembelian -->
			<Card class="border-slate-200 shadow-xs bg-gradient-to-br from-white to-purple-50/30">
				<CardContent class="pt-4 pb-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-500">Total Pembelian PBF</span>
						<div class="p-2 rounded-lg bg-purple-100/60 text-purple-700">
							<Package class="w-4 h-4" />
						</div>
					</div>
					<div class="text-xl font-bold text-slate-900 mt-2 font-mono">
						Rp{formatRp(calcTotalPembelian())}
					</div>
					<div class="text-[10px] text-slate-400 mt-1">
						Dari {getFilteredPurchases().length} faktur pembelian
					</div>
				</CardContent>
			</Card>

			<!-- Estimasi Gross Profit -->
			<Card class="border-slate-200 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
				<CardContent class="pt-4 pb-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-500">Selisih Margin (Profit)</span>
						<div class="p-2 rounded-lg bg-emerald-100/60 text-emerald-700">
							<TrendingUp class="w-4 h-4" />
						</div>
					</div>
					<div
						class={`text-xl font-bold mt-2 font-mono ${
							calcGrossProfit() >= 0 ? 'text-emerald-700' : 'text-red-600'
						}`}
					>
						Rp{formatRp(calcGrossProfit())}
					</div>
					<div class="text-[10px] text-emerald-700 font-semibold mt-1">
						Margin: {calcProfitMarginPct()}% dari total omset
					</div>
				</CardContent>
			</Card>

			<!-- Ringkasan Mode Indicator -->
			<Card class="border-slate-200 shadow-xs bg-gradient-to-br from-white to-slate-50">
				<CardContent class="pt-4 pb-4">
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-slate-500">Periode & Filter</span>
						<div class="p-2 rounded-lg bg-slate-200/60 text-slate-700">
							<Layers class="w-4 h-4" />
						</div>
					</div>
					<div class="text-xs font-bold text-slate-900 mt-2">
						{#if isPerHari}
							<Badge variant="success" class="text-[11px]">Harian: {formatTanggalIndo(selectedDateTab)}</Badge>
						{:else}
							<Badge variant="secondary" class="text-[11px]">Akumulasi Periode</Badge>
						{/if}
					</div>
					<div class="text-[10px] text-slate-400 mt-1">
						{formatTanggalIndo(dateFrom)} s/d {formatTanggalIndo(dateTo)}
					</div>
				</CardContent>
			</Card>
		</div>
	{/if}

	<!-- Sub-Tabs for Detailed Report Views -->
	<div class="space-y-4 print:hidden">
		<div class="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
			<button
				type="button"
				onclick={() => (activeReportSubTab = 'obat_terjual')}
				class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
					activeReportSubTab === 'obat_terjual'
						? 'bg-teal-600 text-white'
						: 'text-slate-600 hover:bg-slate-100'
				}`}
			>
				<ShoppingCart class="w-3.5 h-3.5" /> Obat Terjual ({getObatTerjualSummary().length})
			</button>

			<button
				type="button"
				onclick={() => (activeReportSubTab = 'obat_dibeli')}
				class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
					activeReportSubTab === 'obat_dibeli'
						? 'bg-purple-600 text-white'
						: 'text-slate-600 hover:bg-slate-100'
				}`}
			>
				<Package class="w-3.5 h-3.5" /> Obat Dibeli PBF ({getObatDibeliSummary().length})
			</button>

			<button
				type="button"
				onclick={() => (activeReportSubTab = 'nota_penjualan')}
				class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
					activeReportSubTab === 'nota_penjualan'
						? 'bg-slate-800 text-white'
						: 'text-slate-600 hover:bg-slate-100'
				}`}
			>
				<Receipt class="w-3.5 h-3.5" /> Nota Penjualan ({getFilteredSales().length})
			</button>

			<button
				type="button"
				onclick={() => (activeReportSubTab = 'faktur_pembelian')}
				class={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
					activeReportSubTab === 'faktur_pembelian'
						? 'bg-slate-800 text-white'
						: 'text-slate-600 hover:bg-slate-100'
				}`}
			>
				<FileText class="w-3.5 h-3.5" /> Faktur Pembelian ({getFilteredPurchases().length})
			</button>
		</div>

		<!-- View 1: Obat Terjual -->
		{#if activeReportSubTab === 'obat_terjual'}
			<Card class="border-slate-200">
				<CardHeader class="pb-3">
					<CardTitle class="text-sm font-bold text-slate-800">
						Ringkasan Obat Terjual ({isPerHari ? formatTanggalIndo(selectedDateTab) : 'Akumulasi'})
					</CardTitle>
				</CardHeader>
				<CardContent class="p-0">
					<Table class="table-compact table-striped">
						<TableHeader>
							<TableRow>
								<TableHead class="w-12 text-center">#</TableHead>
								<TableHead class="w-28">Kode</TableHead>
								<TableHead>Nama Obat</TableHead>
								<TableHead>Jenis</TableHead>
								<TableHead class="text-center">Total Qty Terjual</TableHead>
								<TableHead class="text-right">Total Penjualan (Rp)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if loading}
								<TableRow><TableCell colspan={6} class="text-center py-6">Memuat...</TableCell></TableRow>
							{:else if getObatTerjualSummary().length === 0}
								<TableRow>
									<TableCell colspan={6} class="text-center py-8 text-xs text-slate-400">
										Tidak ada data penjualan obat untuk kriteria ini.
									</TableCell>
								</TableRow>
							{:else}
								{#each getObatTerjualSummary() as row, idx}
									<TableRow>
										<TableCell class="text-center text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
										<TableCell><Badge variant="secondary" class="font-mono text-xs text-purple-700 bg-purple-50">{row.obat_id}</Badge></TableCell>
										<TableCell class="font-semibold text-slate-900 text-xs">{row.obat_nama}</TableCell>
										<TableCell><Badge variant="outline" class="text-[10px]">{row.jenis_nama}</Badge></TableCell>
										<TableCell class="text-center font-bold text-xs text-teal-700">{row.total_qty}</TableCell>
										<TableCell class="text-right font-bold text-xs text-slate-900 font-mono">Rp{formatRp(row.total_rp)}</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		{/if}

		<!-- View 2: Obat Dibeli -->
		{#if activeReportSubTab === 'obat_dibeli'}
			<Card class="border-slate-200">
				<CardHeader class="pb-3">
					<CardTitle class="text-sm font-bold text-slate-800">
						Ringkasan Obat Dibeli dari PBF ({isPerHari ? formatTanggalIndo(selectedDateTab) : 'Akumulasi'})
					</CardTitle>
				</CardHeader>
				<CardContent class="p-0">
					<Table class="table-compact table-striped">
						<TableHeader>
							<TableRow>
								<TableHead class="w-12 text-center">#</TableHead>
								<TableHead class="w-28">Kode</TableHead>
								<TableHead>Nama Obat</TableHead>
								<TableHead>Supplier PBF</TableHead>
								<TableHead class="text-center">Total Qty Masuk</TableHead>
								<TableHead class="text-right">Total Pembelian (Rp)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if loading}
								<TableRow><TableCell colspan={6} class="text-center py-6">Memuat...</TableCell></TableRow>
							{:else if getObatDibeliSummary().length === 0}
								<TableRow>
									<TableCell colspan={6} class="text-center py-8 text-xs text-slate-400">
										Tidak ada data pembelian obat untuk kriteria ini.
									</TableCell>
								</TableRow>
							{:else}
								{#each getObatDibeliSummary() as row, idx}
									<TableRow>
										<TableCell class="text-center text-xs text-slate-400 font-mono">{idx + 1}</TableCell>
										<TableCell><Badge variant="secondary" class="font-mono text-xs text-purple-700 bg-purple-50">{row.obat_id}</Badge></TableCell>
										<TableCell class="font-semibold text-slate-900 text-xs">{row.obat_nama}</TableCell>
										<TableCell>
											<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
												<Building2 class="w-3 h-3 text-purple-600" /> {row.pbf_nama}
											</span>
										</TableCell>
										<TableCell class="text-center font-bold text-xs text-purple-700">+{row.total_qty}</TableCell>
										<TableCell class="text-right font-bold text-xs text-slate-900 font-mono">Rp{formatRp(row.total_rp)}</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		{/if}

		<!-- View 3: Nota Penjualan -->
		{#if activeReportSubTab === 'nota_penjualan'}
			<div class="space-y-3">
				{#if getFilteredSales().length === 0}
					<Card class="border-slate-200">
						<CardContent class="py-8 text-center text-xs text-slate-400">
							Tidak ada nota penjualan.
						</CardContent>
					</Card>
				{:else}
					{#each getFilteredSales() as sale}
						<Card class="border-slate-200 shadow-xs">
							<CardHeader class="pb-2 flex flex-row items-center justify-between border-b border-slate-100">
								<div class="flex items-center gap-3">
									<Badge variant="secondary" class="font-mono text-xs font-bold text-slate-800">{sale.trans_id}</Badge>
									<span class="text-xs text-slate-400">
										{formatTanggalIndo(sale.date_str)} {formatWaktu(sale.tanggal_waktu)}
									</span>
								</div>
								<span class="text-sm font-bold text-teal-700">Rp{formatRp(sale.total_trans)}</span>
							</CardHeader>
							<CardContent class="p-0">
								<Table class="table-compact table-striped">
									<TableHeader>
										<TableRow>
											<TableHead>Nama Obat</TableHead>
											<TableHead class="text-center">Qty</TableHead>
											<TableHead class="text-right">Harga</TableHead>
											<TableHead class="text-right">Subtotal</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{#each sale.details as d}
											<TableRow>
												<TableCell class="text-xs font-semibold">{d.obat_nama}</TableCell>
												<TableCell class="text-center text-xs font-bold">{d.qty}</TableCell>
												<TableCell class="text-right text-xs font-mono">Rp{formatRp(d.harga_obat)}</TableCell>
												<TableCell class="text-right text-xs font-bold text-teal-700 font-mono">Rp{formatRp(d.total_line)}</TableCell>
											</TableRow>
										{/each}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					{/each}
				{/if}
			</div>
		{/if}

		<!-- View 4: Faktur Pembelian -->
		{#if activeReportSubTab === 'faktur_pembelian'}
			<div class="space-y-3">
				{#if getFilteredPurchases().length === 0}
					<Card class="border-slate-200">
						<CardContent class="py-8 text-center text-xs text-slate-400">
							Tidak ada faktur pembelian.
						</CardContent>
					</Card>
				{:else}
					{#each getFilteredPurchases() as purchase}
						<Card class="border-slate-200 shadow-xs">
							<CardHeader class="pb-2 flex flex-row items-center justify-between border-b border-slate-100">
								<div class="flex items-center gap-3">
									<Badge variant="secondary" class="font-mono text-xs font-bold text-slate-800">{purchase.trans_id}</Badge>
									<Badge variant="secondary" class="text-[11px] text-purple-800 bg-purple-50 border-purple-200">
										<Building2 class="w-3 h-3 mr-1 inline" /> {purchase.pbf_nama}
									</Badge>
									<span class="text-xs text-slate-400">
										{formatTanggalIndo(purchase.date_str)} {formatWaktu(purchase.tanggal_waktu)}
									</span>
								</div>
								<span class="text-sm font-bold text-purple-700">Rp{formatRp(purchase.total_trans)}</span>
							</CardHeader>
							<CardContent class="p-0">
								<Table class="table-compact table-striped">
									<TableHeader>
										<TableRow>
											<TableHead>Nama Obat</TableHead>
											<TableHead class="text-center">Qty Masuk</TableHead>
											<TableHead class="text-right">Harga Total</TableHead>
											<TableHead class="text-center">Diskon</TableHead>
											<TableHead class="text-right">Total Bersih</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{#each purchase.details as d}
											<TableRow>
												<TableCell class="text-xs font-semibold">{d.obat_nama}</TableCell>
												<TableCell class="text-center text-xs font-bold text-emerald-700">+{d.qty}</TableCell>
												<TableCell class="text-right text-xs font-mono">Rp{formatRp(d.total_per_obat)}</TableCell>
												<TableCell class="text-center text-xs">{d.disc > 0 ? `${d.disc}%` : '-'}</TableCell>
												<TableCell class="text-right text-xs font-bold text-purple-700 font-mono">Rp{formatRp(d.total_line)}</TableCell>
											</TableRow>
										{/each}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Print Layout (@media print) -->
<div id="printable-report" class="hidden print:block text-slate-900 font-sans p-4 space-y-4">
	<div class="text-center border-b pb-3 mb-4">
		<h1 class="text-xl font-bold">LAPORAN TRANSAKSI & KEUANGAN APOTEK</h1>
		<p class="text-xs text-slate-500">
			Periode: {formatTanggalIndo(dateFrom)} s/d {formatTanggalIndo(dateTo)}
			{#if isPerHari}
				(Fokus Tanggal: {formatTanggalIndo(selectedDateTab)})
			{/if}
		</p>
	</div>

	<!-- Print KPI Summary -->
	<div class="grid grid-cols-3 gap-3 border p-3 rounded text-xs mb-4">
		<div>
			<span class="block text-[10px] text-slate-500 font-semibold">Total Penjualan</span>
			<strong class="text-sm">Rp{formatRp(calcTotalOmset())}</strong>
		</div>
		<div>
			<span class="block text-[10px] text-slate-500 font-semibold">Total Pembelian PBF</span>
			<strong class="text-sm">Rp{formatRp(calcTotalPembelian())}</strong>
		</div>
		<div>
			<span class="block text-[10px] text-slate-500 font-semibold">Estimasi Margin</span>
			<strong class="text-sm">Rp{formatRp(calcGrossProfit())} ({calcProfitMarginPct()}%)</strong>
		</div>
	</div>

	<!-- Print Section 1: Obat Terjual -->
	<div class="space-y-2">
		<h3 class="text-xs font-bold border-b pb-1">1. Ringkasan Penjualan Obat</h3>
		<table class="w-full text-xs text-left border-collapse border border-slate-300">
			<thead>
				<tr class="bg-slate-100">
					<th class="border p-1.5 w-8 text-center">#</th>
					<th class="border p-1.5">Kode</th>
					<th class="border p-1.5">Nama Obat</th>
					<th class="border p-1.5 text-center">Qty Terjual</th>
					<th class="border p-1.5 text-right">Total Penjualan</th>
				</tr>
			</thead>
			<tbody>
				{#if getObatTerjualSummary().length === 0}
					<tr>
						<td colspan="5" class="border p-2 text-center text-slate-400 italic">Tidak ada data penjualan obat.</td>
					</tr>
				{:else}
					{#each getObatTerjualSummary() as row, idx}
						<tr>
							<td class="border p-1 text-center font-mono">{idx + 1}</td>
							<td class="border p-1 font-mono">{row.obat_id}</td>
							<td class="border p-1 font-semibold">{row.obat_nama}</td>
							<td class="border p-1 text-center">{row.total_qty}</td>
							<td class="border p-1 text-right font-mono font-bold">Rp{formatRp(row.total_rp)}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Print Section 2: Pembelian PBF -->
	<div class="space-y-2 pt-4">
		<h3 class="text-xs font-bold border-b pb-1">2. Ringkasan Pembelian Obat (PBF)</h3>
		<table class="w-full text-xs text-left border-collapse border border-slate-300">
			<thead>
				<tr class="bg-slate-100">
					<th class="border p-1.5 w-8 text-center">#</th>
					<th class="border p-1.5">Kode</th>
					<th class="border p-1.5">Nama Obat</th>
					<th class="border p-1.5">Supplier PBF</th>
					<th class="border p-1.5 text-center">Qty Masuk</th>
					<th class="border p-1.5 text-right">Total Pembelian</th>
				</tr>
			</thead>
			<tbody>
				{#if getObatDibeliSummary().length === 0}
					<tr>
						<td colspan="6" class="border p-2 text-center text-slate-400 italic">Tidak ada data pembelian obat.</td>
					</tr>
				{:else}
					{#each getObatDibeliSummary() as row, idx}
						<tr>
							<td class="border p-1 text-center font-mono">{idx + 1}</td>
							<td class="border p-1 font-mono">{row.obat_id}</td>
							<td class="border p-1 font-semibold">{row.obat_nama}</td>
							<td class="border p-1">{row.pbf_nama}</td>
							<td class="border p-1 text-center">+{row.total_qty}</td>
							<td class="border p-1 text-right font-mono font-bold">Rp{formatRp(row.total_rp)}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
