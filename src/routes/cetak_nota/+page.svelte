<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Receipt, Search, Printer, Calendar, ShoppingCart, Package } from 'lucide-svelte';

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

		const { data: sales, error: salesError } = await supabase
			.from('penjualan')
			.select('*')
			.gte('tanggal_waktu', startDt)
			.lt('tanggal_waktu', endDt)
			.order('tanggal_waktu', { ascending: false });

		if (salesError) {
			toast.error(`Gagal memuat data penjualan: ${salesError.message}`);
			loading = false;
			return;
		}

		const { data: purchases, error: purchaseError } = await supabase
			.from('purchase')
			.select('*')
			.or(`and(tanggal_waktu.gte.${startDt},tanggal_waktu.lt.${endDt}),and(trans_id.gte.${dateFromPrefix},trans_id.lt.${dateToNextPrefix})`)
			.order('trans_id', { ascending: false });

		if (purchaseError) {
			toast.error(`Gagal memuat data pembelian: ${purchaseError.message}`);
			loading = false;
			return;
		}

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

		const [{ data: detailsPenjualan }, { data: detailsPurchase }] = await Promise.all([
			supabase.from('detail_penjualan').select('*').in('trans_id', allTransIds),
			supabase.from('detail_purchase').select('*').in('trans_id', allTransIds)
		]);

		const dpList = detailsPenjualan ?? [];
		const dpurList = detailsPurchase ?? [];

		const obatIds = [...new Set([...dpList.map((d) => d.obat_id), ...dpurList.map((d) => d.obat_id)])];
		let obatData: any[] = [];
		if (obatIds.length > 0) {
			const { data: oData, error: obatError } = await supabase
				.from('obat')
				.select('obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)')
				.in('obat_id', obatIds);

			if (obatError) {
				toast.error(`Gagal memuat detail obat: ${obatError.message}`);
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

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<Receipt class="w-6 h-6 text-teal-600" />
				Cetak Nota & Riwayat Transaksi
			</h2>
			<p class="text-xs text-slate-500 mt-1">Cari dan cetak ulang nota penjualan atau pembelian faktur PBF</p>
		</div>
	</div>

	<!-- Filter Card -->
	<Card class="border-slate-200 shadow-sm print:hidden">
		<CardContent class="pt-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
				<!-- Date From -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-from" class="text-xs font-semibold text-slate-600">Dari Tanggal</label>
					<Input id="date-from" type="date" bind:value={dateFrom} class="text-xs" />
				</div>

				<!-- Date To -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-to" class="text-xs font-semibold text-slate-600">Sampai Tanggal</label>
					<Input id="date-to" type="date" bind:value={dateTo} class="text-xs" />
				</div>

				<!-- Type Filter -->
				<div class="lg:col-span-2 space-y-1">
					<label for="trans-type" class="text-xs font-semibold text-slate-600">Tipe</label>
					<Select
						id="trans-type"
						bind:value={transTypeFilter}
						placeholder="Pilih tipe..."
						options={[
							{ value: 'all', label: 'Semua' },
							{ value: 'penjualan', label: 'Penjualan' },
							{ value: 'pembelian', label: 'Pembelian (Faktur)' }
						]}
					/>
				</div>

				<!-- Search Input -->
				<div class="lg:col-span-4 space-y-1 relative">
					<label for="obat-filter" class="text-xs font-semibold text-slate-600">Cari Obat / Nota / PBF</label>
					<div class="flex gap-2">
						<div class="relative flex-1">
							<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
							<Input
								id="obat-filter"
								type="text"
								bind:value={obatQuery}
								placeholder="Ketik pencarian..."
								class="pl-9 text-xs"
							/>
						</div>
						<Button size="sm" onclick={loadTransactions} disabled={loading}>
							{loading ? '...' : 'Cari'}
						</Button>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Results List -->
	<div class="space-y-4 print:hidden">
		<h3 class="text-sm font-semibold text-slate-700">
			Daftar Transaksi Ditemukan ({getFilteredTransactions().length})
		</h3>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<Skeleton class="h-24 w-full rounded-xl" />
				{/each}
			</div>
		{:else if getFilteredTransactions().length === 0}
			<Card class="border-slate-200">
				<CardContent class="py-12 text-center text-xs text-slate-400">
					Tidak ada transaksi ditemukan untuk filter ini.
				</CardContent>
			</Card>
		{:else}
			<div class="space-y-4">
				{#each getFilteredTransactions() as trans}
					<Card class="border-slate-200 shadow-xs hover:border-teal-400 transition-colors">
						<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
							<div class="flex items-center gap-3">
								<Badge variant="secondary" class="font-mono text-xs font-bold text-slate-800">{trans.trans_id}</Badge>

								{#if trans.type === 'penjualan'}
									<Badge variant="success" class="text-[10px] inline-flex items-center gap-1">
										<ShoppingCart class="w-3 h-3" /> Penjualan
									</Badge>
								{:else}
									<Badge variant="secondary" class="text-[10px] text-purple-700 bg-purple-50 inline-flex items-center gap-1">
										<Package class="w-3 h-3" /> Pembelian ({trans.pbf_nama ?? 'PBF'})
									</Badge>
								{/if}

								<span class="text-xs text-slate-400">
									{formatTanggal(trans.tanggal_waktu)} {formatWaktu(trans.tanggal_waktu)}
								</span>
							</div>

							<div class="flex items-center gap-3">
								<span class="text-sm font-bold text-teal-700">Rp{formatRp(trans.total_trans)}</span>
								<Button size="sm" variant="outline" class="h-8 text-xs" onclick={() => openPrint(trans)}>
									<Printer class="w-3.5 h-3.5 mr-1" /> Cetak Nota
								</Button>
							</div>
						</CardHeader>

						<CardContent class="pt-3">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Nama Obat</TableHead>
										<TableHead>Jenis</TableHead>
										<TableHead class="text-center">Qty</TableHead>
										<TableHead class="text-right">Harga Satuan</TableHead>
										<TableHead class="text-right">Total Line</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each trans.details as d}
										<TableRow>
											<TableCell class="font-semibold text-slate-900 text-xs">
												{d.obat_nama}
												<span class="block text-[10px] text-slate-400 font-mono font-normal">{d.obat_id}</span>
											</TableCell>
											<TableCell><Badge variant="outline" class="text-[10px]">{d.jenis_nama}</Badge></TableCell>
											<TableCell class="text-center text-xs font-bold">{d.qty}</TableCell>
											<TableCell class="text-right text-xs">Rp{formatRp(d.harga_obat)}</TableCell>
											<TableCell class="text-right font-bold text-xs text-teal-700">Rp{formatRp(d.total_line)}</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Print View Layout for Nota Receipt -->
{#if selectedTrans}
	<div id="printable-receipt" class="hidden print:block">
		<div style="text-align: center; margin-bottom: 8px;">
			<h3 style="font-size: 14px; font-weight: bold; margin: 0;">APOTEK PWA</h3>
			<p style="font-size: 10px; margin: 2px 0;">
				{selectedTrans.type === 'penjualan' ? 'NOTA PENJUALAN' : 'BUKTI PEMBELIAN PBF'}
			</p>
			<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
		</div>

		<div style="font-size: 10px; margin-bottom: 6px;">
			<div>No. Nota : {selectedTrans.trans_id}</div>
			<div>Tgl      : {formatTanggal(selectedTrans.tanggal_waktu)} {formatWaktu(selectedTrans.tanggal_waktu)}</div>
			{#if selectedTrans.type === 'pembelian' && selectedTrans.pbf_nama}
				<div>Supplier : {selectedTrans.pbf_nama}</div>
			{/if}
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
			<tbody>
				{#each selectedTrans.details as d}
					<tr>
						<td colspan="3" style="font-weight: bold; padding-top: 2px;">{d.obat_nama}</td>
					</tr>
					<tr>
						<td style="width: 30%;">{d.qty} x Rp{formatRp(d.harga_obat)}</td>
						<td style="text-align: right;" colspan="2">Rp{formatRp(d.total_line)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="font-size: 10px; line-height: 1.4;">
			<div style="display: flex; justify-content: space-between;">
				<span>Subtotal:</span>
				<span>Rp{formatRp(subtotalBeforeDisc(selectedTrans))}</span>
			</div>
			{#if selectedTrans.total_disc > 0}
				<div style="display: flex; justify-content: space-between;">
					<span>Diskon:</span>
					<span>-Rp{formatRp(selectedTrans.total_disc)}</span>
				</div>
			{/if}
			<div style="display: flex; justify-content: space-between; font-weight: bold;">
				<span>TOTAL:</span>
				<span>Rp{formatRp(selectedTrans.total_trans)}</span>
			</div>
			{#if selectedTrans.type === 'penjualan'}
				<div style="display: flex; justify-content: space-between;">
					<span>Bayar:</span>
					<span>Rp{formatRp(selectedTrans.bayar)}</span>
				</div>
				<div style="display: flex; justify-content: space-between;">
					<span>Kembali:</span>
					<span>Rp{formatRp(selectedTrans.kembali)}</span>
				</div>
			{/if}
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="text-align: center; font-size: 9px; margin-top: 8px;">
			<p>Terima Kasih Semoga Lekas Sembuh</p>
		</div>
	</div>
{/if}
