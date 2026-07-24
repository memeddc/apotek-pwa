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
	import { Pagination } from '$lib/components/ui/pagination';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import ReceiptPreviewModal from '$lib/components/ui/receipt/ReceiptPreviewModal.svelte';
	import { Receipt, Search, Printer, ShoppingCart, SearchX } from 'lucide-svelte';

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
		details: TransDetail[];
	};

	let loading = $state(false);
	let transactions = $state<TransRecord[]>([]);
	let dateFrom = $state('');
	let dateTo = $state('');
	let obatQuery = $state('');
	let selectedTrans = $state<TransRecord | null>(null);
	let showPreviewModal = $state(false);

	// Pagination states
	let currentPage = $state(1);
	let pageSize = $state(10);

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
		d: { trans_id: string; obat_id: string; qty: number; harga_obat?: number },
		transTotal: number,
		rawGroup: any[]
	) {
		const qty = d.qty || 1;
		const val = Number(d.harga_obat) || 0;
		const sumLine = rawGroup.reduce((s, item) => s + (Number(item.harga_obat) || 0), 0);
		const sumUnit = rawGroup.reduce((s, item) => s + ((Number(item.harga_obat) || 0) * (item.qty || 1)), 0);

		if (val > 0) {
			if (sumLine === transTotal) {
				return { obat_id: d.obat_id, qty, harga_obat: Math.round(val / qty), disc: 0, total_line: val };
			}
			if (sumUnit === transTotal) {
				return { obat_id: d.obat_id, qty, harga_obat: val, disc: 0, total_line: val * qty };
			}
			return { obat_id: d.obat_id, qty, harga_obat: val, disc: 0, total_line: val * qty };
		}
		return { obat_id: d.obat_id, qty, harga_obat: 0, disc: 0, total_line: 0 };
	}

	async function loadTransactions() {
		loading = true;
		currentPage = 1;
		try {
			let salesQuery = supabase.from('penjualan').select('*').order('tanggal_waktu', { ascending: false });

			if (dateFrom) salesQuery = salesQuery.gte('tanggal_waktu', `${dateFrom}T00:00:00`);
			if (dateTo) salesQuery = salesQuery.lt('tanggal_waktu', `${tomorrowOf(dateTo)}T00:00:00`);

			const { data: salesData, error: salesErr } = await salesQuery;
			if (salesErr) throw new Error(salesErr.message);
			if (!salesData || salesData.length === 0) {
				transactions = [];
				loading = false;
				return;
			}

			const transIds = salesData.map((s) => s.trans_id);
			const { data: detailData, error: detailErr } = await supabase
				.from('detail_penjualan')
				.select('*')
				.in('trans_id', transIds);

			if (detailErr) throw new Error(detailErr.message);

			const detailMap = new Map<string, any[]>();
			(detailData ?? []).forEach((d) => {
				const list = detailMap.get(d.trans_id) ?? [];
				list.push(d);
				detailMap.set(d.trans_id, list);
			});

			const allObatIds = [...new Set((detailData ?? []).map((d) => d.obat_id))];
			let obatMap = new Map<string, { obat_nama: string; jenis_nama: string }>();
			if (allObatIds.length > 0) {
				const { data: obatData } = await supabase
					.from('obat')
					.select('obat_id, obat_nama, jenis_obat(jenis_nama)')
					.in('obat_id', allObatIds);

				(obatData ?? []).forEach((o: any) => {
					obatMap.set(o.obat_id, {
						obat_nama: o.obat_nama,
						jenis_nama: o.jenis_obat?.jenis_nama ?? '-'
					});
				});
			}

			transactions = salesData.map((s) => {
				const rawItems = detailMap.get(s.trans_id) ?? [];
				const itemDetails: TransDetail[] = rawItems.map((d) => {
					const parsed = parseDetailItem(d, s.total_trans, rawItems);
					const oInfo = obatMap.get(d.obat_id);
					return {
						...parsed,
						obat_nama: oInfo?.obat_nama ?? d.obat_id,
						jenis_nama: oInfo?.jenis_nama ?? '-'
					};
				});

				return {
					trans_id: s.trans_id,
					tanggal_waktu: parseTransDate(s.trans_id, s.tanggal_waktu),
					total_trans: Number(s.total_trans) || 0,
					total_disc: Number(s.total_disc) || 0,
					bayar: Number(s.bayar) || Number(s.total_trans) || 0,
					kembali: Number(s.kembali) || 0,
					details: itemDetails
				};
			});
		} catch (err) {
			toast.error(`Gagal memuat transaksi: ${err instanceof Error ? err.message : 'Kesalahan server'}`);
			transactions = [];
		} finally {
			loading = false;
		}
	}

	let filteredTransactions = $derived(
		transactions.filter((t) => {
			const q = obatQuery.trim().toLowerCase();
			if (!q) return true;
			const matchTransId = t.trans_id.toLowerCase().includes(q);
			const matchObat = t.details.some(
				(d) => d.obat_nama.toLowerCase().includes(q) || d.obat_id.toLowerCase().includes(q)
			);
			return matchTransId || matchObat;
		})
	);

	let pagedTransactions = $derived(
		filteredTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	function subtotalBeforeDisc(trans: TransRecord): number {
		return trans.details.reduce((s, d) => s + d.qty * d.harga_obat, 0);
	}

	function openPrint(trans: TransRecord) {
		selectedTrans = trans;
		showPreviewModal = true;
	}

	onMount(() => {
		dateFrom = daysAgoStr(7);
		dateTo = todayStr();
		loadTransactions();
	});
</script>

<div class="space-y-4">
	<!-- Page Header -->
	<div class="print:hidden">
		<PageHeader
			title="Cetak Nota Penjualan"
			description="Cari, rangkum, dan cetak ulang nota bukti pembayaran transaksi kasir"
			badge={`${filteredTransactions.length} Transaksi`}
		/>
	</div>

	<!-- Filter Card -->
	<Card class="rounded-2xl border-slate-200/80 shadow-2xs print:hidden">
		<CardContent class="pt-4 pb-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
				<!-- Date From -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-from" class="text-xs font-semibold text-slate-600">Dari Tanggal</label>
					<DatePicker id="date-from" bind:value={dateFrom} placeholder="Pilih dari tanggal..." />
				</div>

				<!-- Date To -->
				<div class="lg:col-span-3 space-y-1">
					<label for="date-to" class="text-xs font-semibold text-slate-600">Sampai Tanggal</label>
					<DatePicker id="date-to" bind:value={dateTo} placeholder="Pilih sampai tanggal..." />
				</div>

				<!-- Search Input -->
				<div class="lg:col-span-6 space-y-1 relative">
					<label for="obat-filter" class="text-xs font-semibold text-slate-600">Cari Nama Obat / No. Nota</label>
					<div class="flex gap-2">
						<div class="relative flex-1">
							<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
							<Input
								id="obat-filter"
								type="text"
								bind:value={obatQuery}
								placeholder="Ketik nama obat atau nomor nota..."
								class="pl-9 text-xs rounded-xl border-slate-200 focus:border-mint-500 h-9"
							/>
						</div>
						<Button size="sm" onclick={loadTransactions} disabled={loading} class="bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-xl px-4 cursor-pointer h-9 text-xs">
							{loading ? '...' : 'Cari'}
						</Button>
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Results List -->
	<div class="space-y-3 print:hidden">
		<div class="flex items-center justify-between">
			<h3 class="text-xs font-bold text-slate-700 uppercase tracking-wider">
				Daftar Transaksi Kasir ({filteredTransactions.length})
			</h3>
		</div>

		{#if loading}
			<div class="space-y-3">
				{#each Array(3) as _}
					<Skeleton class="h-24 w-full rounded-2xl" />
				{/each}
			</div>
		{:else if filteredTransactions.length === 0}
			<Card class="border-slate-200/80 rounded-2xl">
				<CardContent class="py-12 text-center text-xs text-slate-400">
					<div class="flex flex-col items-center justify-center gap-2">
						<SearchX class="w-8 h-8 text-slate-300" />
						<p class="text-xs font-semibold text-slate-600">Tidak ada data penjualan ditemukan</p>
						<p class="text-[11px] text-slate-400">Coba sesuaikan rentang tanggal atau kata kunci pencarian.</p>
					</div>
				</CardContent>
			</Card>
		{:else}
			<div class="space-y-3">
				{#each pagedTransactions as trans}
					<Card class="border border-slate-200/80 rounded-2xl shadow-2xs hover:border-mint-300 transition-all overflow-hidden">
						<CardHeader class="py-3 px-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-row items-center justify-between">
							<div class="flex items-center gap-2.5">
								<Badge variant="secondary" class="font-mono text-xs font-bold text-slate-800 bg-white border-slate-200">{trans.trans_id}</Badge>
								<Badge variant="success" class="text-[10px] inline-flex items-center gap-1">
									<ShoppingCart class="w-3 h-3" /> Penjualan
								</Badge>
								<span class="text-xs text-slate-500 font-medium">
									{formatTanggal(trans.tanggal_waktu)} • {formatWaktu(trans.tanggal_waktu)}
								</span>
							</div>

							<div class="flex items-center gap-3">
								<span class="text-sm font-extrabold text-mint-700 font-mono">Rp{formatRp(trans.total_trans)}</span>
								<Button size="sm" variant="outline" class="h-7 text-xs rounded-lg border-slate-200 cursor-pointer hover:bg-mint-50 hover:text-mint-700" onclick={() => openPrint(trans)}>
									<Printer class="w-3.5 h-3.5 mr-1" /> Cetak Nota
								</Button>
							</div>
						</CardHeader>

						<CardContent class="p-0">
							<Table class="table-compact table-striped">
								<TableHeader class="bg-slate-50/40">
									<TableRow>
										<TableHead class="font-semibold text-slate-700">Nama Obat</TableHead>
										<TableHead class="font-semibold text-slate-700">Jenis</TableHead>
										<TableHead class="text-center font-semibold text-slate-700">Qty</TableHead>
										<TableHead class="text-right font-semibold text-slate-700">Harga Satuan</TableHead>
										<TableHead class="text-right font-semibold text-slate-700">Subtotal</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#if trans.details.length === 0}
										<TableRow>
											<TableCell colspan={5} class="text-center text-xs text-slate-400 py-4">
												Tidak ada detail item obat tercatat untuk nota ini.
											</TableCell>
										</TableRow>
									{:else}
										{#each trans.details as d}
											<TableRow>
												<TableCell class="font-medium text-slate-800 text-xs">
													<span class="font-semibold text-slate-900">{d.obat_nama}</span>
													<span class="block text-[10px] text-slate-400 font-mono">{d.obat_id}</span>
												</TableCell>
												<TableCell><Badge variant="outline" class="text-[10px] font-normal">{d.jenis_nama}</Badge></TableCell>
												<TableCell class="text-center text-xs font-bold">{d.qty}</TableCell>
												<TableCell class="text-right text-xs font-mono text-slate-600">Rp{formatRp(d.harga_obat)}</TableCell>
												<TableCell class="text-right font-bold text-xs text-mint-700 font-mono">Rp{formatRp(d.total_line)}</TableCell>
											</TableRow>
										{/each}
									{/if}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				{/each}
			</div>

			<!-- Pagination Controls -->
			<div class="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
				<Pagination
					currentPage={currentPage}
					totalItems={filteredTransactions.length}
					pageSize={pageSize}
					pageSizeOptions={[5, 10, 25]}
					onPageChange={(page) => (currentPage = page)}
					onPageSizeChange={(size) => {
						pageSize = size;
						currentPage = 1;
					}}
				/>
			</div>
		{/if}
	</div>
</div>


<!-- Receipt Preview Modal & Printable Receipt -->
<ReceiptPreviewModal
	open={showPreviewModal}
	onClose={() => (showPreviewModal = false)}
	nomorNota={selectedTrans?.trans_id ?? ''}
	tanggalWaktu={selectedTrans?.tanggal_waktu ?? new Date()}
	lines={(selectedTrans?.details ?? []).map((d) => ({ nama: d.obat_nama, qty: d.qty, total: d.total_line, harga: d.harga_obat }))}
	total={selectedTrans?.total_trans ?? 0}
	bayar={selectedTrans?.bayar ?? 0}
	kembali={selectedTrans?.kembali ?? 0}
/>
