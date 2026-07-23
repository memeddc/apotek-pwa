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
	import { FileText, Search, Printer, Package, Building2 } from 'lucide-svelte';

	type PurchaseDetail = {
		obat_id: string;
		qty: number;
		total_per_obat: number;
		harga_satuan: number;
		disc: number;
		disc_rp: number;
		total_line: number;
		obat_nama: string;
		jenis_nama: string;
	};

	type PurchaseRecord = {
		trans_id: string;
		pbf_id: string;
		pbf_nama: string;
		tanggal_waktu: string;
		total_trans: number;
		total_disc: number;
		details: PurchaseDetail[];
	};

	let loading = $state(false);
	let purchases = $state<PurchaseRecord[]>([]);
	let dateFrom = $state('');
	let dateTo = $state('');
	let obatQuery = $state('');
	let selectedRecord = $state<PurchaseRecord | null>(null);

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v || 0));
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
		if (/^\d{8}/.test(transId)) {
			const y = transId.slice(0, 4);
			const m = transId.slice(4, 6);
			const d = transId.slice(6, 8);
			return `${y}-${m}-${d}T00:00:00+07:00`;
		}
		return new Date().toISOString();
	}

	/**
	 * Chunked fetch helper to query Supabase REST API safely without hitting GET URL length limits.
	 */
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

	async function loadPurchases() {
		if (!dateFrom || !dateTo) return;
		loading = true;

		const startDt = `${dateFrom}T00:00:00+07:00`;
		const endDt = `${tomorrowOf(dateTo)}T00:00:00+07:00`;
		const dateFromPrefix = dateFrom.replaceAll('-', '');
		const dateToNextPrefix = tomorrowOf(dateTo).replaceAll('-', '');

		const { data: purchaseData, error: purchaseError } = await supabase
			.from('purchase')
			.select('*, pbf(pbf_nama)')
			.or(`and(tanggal_waktu.gte.${startDt},tanggal_waktu.lt.${endDt}),and(trans_id.gte.${dateFromPrefix},trans_id.lt.${dateToNextPrefix})`)
			.order('trans_id', { ascending: false });

		if (purchaseError) {
			toast.error(`Gagal memuat riwayat pembelian: ${purchaseError.message}`);
			loading = false;
			return;
		}

		const purchaseList = purchaseData ?? [];
		const purchaseTransIds = purchaseList.map((p) => p.trans_id);

		if (purchaseTransIds.length === 0) {
			purchases = [];
			loading = false;
			return;
		}

		// Fetch detail_purchase in batches of 50
		const dpurList = await fetchInChunks<any>('detail_purchase', '*', 'trans_id', purchaseTransIds, 50);

		// Extract unique obat_ids and fetch obat details in batches of 50
		const obatIds = [...new Set(dpurList.map((d) => d.obat_id))];
		const obatData = await fetchInChunks<any>(
			'obat',
			'obat_id, obat_nama, jenis_id, jenis_obat(jenis_nama)',
			'obat_id',
			obatIds,
			50
		);

		const obatMap = new Map<string, { obat_nama: string; jenis_nama: string }>();
		obatData.forEach((o: any) => {
			obatMap.set(o.obat_id, {
				obat_nama: o.obat_nama,
				jenis_nama: o.jenis_obat?.jenis_nama ?? o.jenis_id ?? '-'
			});
		});

		purchases = purchaseList.map((p) => {
			const rawItems = dpurList.filter((d) => d.trans_id === p.trans_id);

			const details: PurchaseDetail[] = rawItems.map((d) => {
				const qty = Number(d.qty) || 1;
				const totalPerObat = Number(d.total_per_obat) || 0;
				const disc = Number(d.disc) || 0;

				// Calculation rule: Total_per_obat is NOT multiplied by qty.
				// Total line = total_per_obat minus discount (disc % or nominal).
				const discRp = disc > 0 ? (disc <= 100 ? (totalPerObat * disc) / 100 : disc) : 0;
				const total_line = Math.max(0, Math.round(totalPerObat - discRp));
				const hargaSatuan = qty > 0 ? Math.round(totalPerObat / qty) : totalPerObat;

				const oInfo = obatMap.get(d.obat_id);

				return {
					obat_id: d.obat_id,
					qty,
					total_per_obat: totalPerObat,
					harga_satuan: hargaSatuan,
					disc,
					disc_rp: Math.round(discRp),
					total_line,
					obat_nama: oInfo?.obat_nama ?? d.obat_id,
					jenis_nama: oInfo?.jenis_nama ?? '-'
				};
			});

			return {
				trans_id: p.trans_id,
				pbf_id: p.pbf_id,
				pbf_nama: p.pbf?.pbf_nama ?? p.pbf_id ?? 'PBF',
				tanggal_waktu: parseTransDate(p.trans_id, p.tanggal_waktu),
				total_trans: Number(p.total_trans) || 0,
				total_disc: Number(p.total_disc) || 0,
				details
			};
		});

		loading = false;
	}

	function getFilteredPurchases(): PurchaseRecord[] {
		const q = obatQuery.trim().toLowerCase();
		if (!q) return purchases;
		return purchases.filter((p) => {
			const matchTransId = p.trans_id.toLowerCase().includes(q);
			const matchPbf = p.pbf_nama.toLowerCase().includes(q) || p.pbf_id.toLowerCase().includes(q);
			const matchObat = p.details.some(
				(d) => d.obat_nama.toLowerCase().includes(q) || d.obat_id.toLowerCase().includes(q)
			);
			return matchTransId || matchPbf || matchObat;
		});
	}

	function subtotalKotor(record: PurchaseRecord): number {
		return record.details.reduce((s, d) => s + d.total_per_obat, 0);
	}

	function openPrint(record: PurchaseRecord) {
		selectedRecord = record;
		setTimeout(() => window.print(), 300);
	}

	onMount(() => {
		dateFrom = daysAgoStr(30);
		dateTo = todayStr();
		loadPurchases();
	});
</script>

<div class="space-y-6">
	<!-- Filter Card -->
	<Card class="border-slate-200 shadow-sm print:hidden">
		<CardContent class="pt-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
				<!-- Begda (Dari Tanggal) -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-from" class="text-xs font-semibold text-slate-600">Dari Tanggal (Begda)</label>
					<Input
						id="date-from"
						type="date"
						bind:value={dateFrom}
						onclick={(e) => e.currentTarget.showPicker?.()}
						onfocus={(e) => e.currentTarget.showPicker?.()}
						class="text-xs cursor-pointer"
					/>
				</div>

				<!-- Endda (Sampai Tanggal) -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-to" class="text-xs font-semibold text-slate-600">Sampai Tanggal (Endda)</label>
					<Input
						id="date-to"
						type="date"
						bind:value={dateTo}
						onclick={(e) => e.currentTarget.showPicker?.()}
						onfocus={(e) => e.currentTarget.showPicker?.()}
						class="text-xs cursor-pointer"
					/>
				</div>

				<!-- Search Input -->
				<div class="lg:col-span-6 space-y-1 relative">
					<label for="obat-filter" class="text-xs font-semibold text-slate-600">Cari Obat / No. Faktur / PBF</label>
					<div class="flex gap-2">
						<div class="relative flex-1">
							<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
							<Input
								id="obat-filter"
								type="text"
								bind:value={obatQuery}
								placeholder="Ketik nama obat, supplier PBF, atau nomor faktur..."
								class="pl-9 text-xs"
							/>
						</div>
						<Button size="sm" onclick={loadPurchases} disabled={loading}>
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
			Daftar Pembelian Faktur Ditemukan ({getFilteredPurchases().length})
		</h3>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<Skeleton class="h-28 w-full rounded-xl" />
				{/each}
			</div>
		{:else if getFilteredPurchases().length === 0}
			<Card class="border-slate-200">
				<CardContent class="py-12 text-center text-xs text-slate-400">
					Tidak ada data faktur pembelian ditemukan untuk periode dan kriteria pencarian ini.
				</CardContent>
			</Card>
		{:else}
			<div class="space-y-4">
				{#each getFilteredPurchases() as record}
					<Card class="border-slate-200 shadow-xs hover:border-teal-400 transition-colors">
						<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
							<div class="flex flex-wrap items-center gap-3">
								<Badge variant="secondary" class="font-mono text-xs font-bold text-slate-800">{record.trans_id}</Badge>

								<Badge variant="secondary" class="text-[11px] text-teal-800 bg-teal-50 border-teal-200 inline-flex items-center gap-1">
									<Building2 class="w-3 h-3" /> {record.pbf_nama}
								</Badge>

								<span class="text-xs text-slate-400">
									{formatTanggal(record.tanggal_waktu)} {formatWaktu(record.tanggal_waktu)}
								</span>
							</div>

							<div class="flex items-center gap-3">
								<div class="text-right">
									<span class="text-xs text-slate-400 block">Total Faktur</span>
									<span class="text-sm font-bold text-teal-700">Rp{formatRp(record.total_trans)}</span>
								</div>
								<Button size="sm" variant="outline" class="h-8 text-xs" onclick={() => openPrint(record)}>
									<Printer class="w-3.5 h-3.5 mr-1" /> Cetak Bukti
								</Button>
							</div>
						</CardHeader>

						<CardContent class="pt-3">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Nama Obat</TableHead>
										<TableHead>Jenis</TableHead>
										<TableHead class="text-center">Qty Masuk</TableHead>
										<TableHead class="text-right">Harga Total Per Obat</TableHead>
										<TableHead class="text-center">Diskon</TableHead>
										<TableHead class="text-right">Total Bersih</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#if record.details.length === 0}
										<TableRow>
											<TableCell colspan={6} class="text-center text-xs text-slate-400 py-4">
												Tidak ada rincian item obat tercatat untuk faktur ini.
											</TableCell>
										</TableRow>
									{:else}
										{#each record.details as d}
											<TableRow>
												<TableCell class="font-semibold text-slate-900 text-xs">
													{d.obat_nama}
													<span class="block text-[10px] text-slate-400 font-mono font-normal">{d.obat_id}</span>
												</TableCell>
												<TableCell><Badge variant="outline" class="text-[10px]">{d.jenis_nama}</Badge></TableCell>
												<TableCell class="text-center text-xs font-bold text-emerald-700">+{d.qty}</TableCell>
												<TableCell class="text-right text-xs font-mono">Rp{formatRp(d.total_per_obat)}</TableCell>
												<TableCell class="text-center text-xs">
													{#if d.disc > 0}
														<span class="text-amber-700 font-medium">-{d.disc}% (Rp{formatRp(d.disc_rp)})</span>
													{:else}
														<span class="text-slate-400">-</span>
													{/if}
												</TableCell>
												<TableCell class="text-right font-bold text-xs text-teal-700 font-mono">Rp{formatRp(d.total_line)}</TableCell>
											</TableRow>
										{/each}
									{/if}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Print View Layout for Purchase Receipt -->
{#if selectedRecord}
	<div id="printable-receipt" class="hidden print:block">
		<div style="text-align: center; margin-bottom: 8px;">
			<h3 style="font-size: 14px; font-weight: bold; margin: 0;">APOTEK PWA</h3>
			<p style="font-size: 10px; margin: 2px 0;">BUKTI HISTORI FAKTUR PEMBELIAN</p>
			<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
		</div>

		<div style="font-size: 10px; margin-bottom: 6px;">
			<div>No. Faktur : {selectedRecord.trans_id}</div>
			<div>Supplier   : {selectedRecord.pbf_nama}</div>
			<div>Tgl        : {formatTanggal(selectedRecord.tanggal_waktu)} {formatWaktu(selectedRecord.tanggal_waktu)}</div>
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
			<tbody>
				{#each selectedRecord.details as d}
					<tr>
						<td colspan="3" style="font-weight: bold; padding-top: 2px;">{d.obat_nama} ({d.qty} item)</td>
					</tr>
					<tr>
						<td style="width: 40%;">Subtotal: Rp{formatRp(d.total_per_obat)}</td>
						<td style="text-align: right;" colspan="2">Net: Rp{formatRp(d.total_line)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="font-size: 10px; line-height: 1.4;">
			<div style="display: flex; justify-content: space-between;">
				<span>Total Kotor:</span>
				<span>Rp{formatRp(subtotalKotor(selectedRecord))}</span>
			</div>
			{#if selectedRecord.total_disc > 0}
				<div style="display: flex; justify-content: space-between;">
					<span>Total Diskon PBF:</span>
					<span>-Rp{formatRp(selectedRecord.total_disc)}</span>
				</div>
			{/if}
			<div style="display: flex; justify-content: space-between; font-weight: bold;">
				<span>TOTAL FAKTUR:</span>
				<span>Rp{formatRp(selectedRecord.total_trans)}</span>
			</div>
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="text-align: center; font-size: 9px; margin-top: 8px;">
			<p>Dokumen Historis Pembelian Apotek PWA</p>
		</div>
	</div>
{/if}
