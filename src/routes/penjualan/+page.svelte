<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iobat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { RadioGroup } from '$lib/components/ui/radio-group';
	import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		ShoppingCart,
		Plus,
		Trash2,
		Printer,
		RotateCcw,
		CheckCircle2,
		AlertCircle,
		Search,
		Check,
		X
	} from 'lucide-svelte';

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

	// Nota & Date
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
	let cetakNotaValue = $state('true');

	// Printed receipt snapshot
	let lastSavedTransaction = $state<{
		nomorNota: string;
		tanggalWaktu: string;
		lines: SaleLine[];
		subtotal: number;
		diskon: number;
		total: number;
		bayar: number;
		kembali: number;
	} | null>(null);

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
		const prefix = todayPrefix();
		const startOfDay = `${todayStr()}T00:00:00+07:00`;
		const endOfDay = `${tomorrowStr()}T00:00:00+07:00`;

		const { data, error } = await supabase
			.from('penjualan')
			.select('trans_id')
			.gte('tanggal_waktu', startOfDay)
			.lt('tanggal_waktu', endOfDay)
			.like('trans_id', `${prefix}%`);

		if (error) {
			toast.error(`Gagal generate nomor nota: ${error.message}`);
			return;
		}

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
		if (error) { toast.error(`Gagal mencari obat: ${error.message}`); return; }
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

		const { data: stok, error: stokError } = await supabase
			.from('stok')
			.select('qty, harga_pbf, harga_jual, diberikan')
			.eq('obat_id', obat.obat_id)
			.maybeSingle();

		if (stokError) { toast.error(`Gagal memuat stok: ${stokError.message}`); return; }

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
			const effectiveCost = diberikan === 1
				? stok.harga_pbf * (1 - disc / 100)
				: stok.harga_pbf;
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
		if (!selectedObat) { toast.error('Pilih obat dari hasil pencarian.'); return; }
		if (inputQty <= 0) { toast.error('Jumlah harus lebih dari 0.'); return; }
		if (inputHarga <= 0) { toast.error('Harga harus lebih dari 0.'); return; }
		if (!stokInfo || stokInfo.qty < inputQty) {
			toast.error(`Stok tidak cukup. Sisa: ${stokInfo?.qty ?? 0}`);
			return;
		}
		if (lines.some((l) => l.obat_id === selectedObat!.obat_id)) {
			toast.error('Obat sudah ada dalam daftar.');
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
		if (lines.length === 0) { toast.error('Tambahkan minimal satu obat.'); return; }
		if (bayar < harusDibayar()) { toast.error('Jumlah bayar kurang.'); return; }

		saving = true;
		try {
			const now = new Date();
			const tanggalWaktu = now.toISOString();

			const { error: transError } = await supabase.from('penjualan').insert({
				trans_id: nomorNota,
				tanggal_waktu: tanggalWaktu,
				total_trans: harusDibayar(),
				total_disc: totalDiskonRp(),
				bayar: bayar,
				kembali: kembali()
			});
			if (transError) throw new Error(transError.message);

			const details = lines.map((l) => ({
				trans_id: nomorNota,
				obat_id: l.obat_id,
				qty: l.qty,
				harga_obat: l.harga_jual
			}));
			const { error: detailError } = await supabase.from('detail_penjualan').insert(details);
			if (detailError) throw new Error(detailError.message);

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

			const kartuRows = lines.map((l) => ({
				obat_id: l.obat_id,
				qty: -l.qty,
				trans_id: `J${nomorNota}`,
				tanggal_waktu: tanggalWaktu
			}));
			const { error: kartuError } = await supabase.from('kartu_stok').insert(kartuRows);
			if (kartuError) throw new Error(kartuError.message);

			// Prepare receipt snapshot for printing
			lastSavedTransaction = {
				nomorNota,
				tanggalWaktu,
				lines: [...lines],
				subtotal: hargaSebelumDiskon(),
				diskon: totalDiskonRp(),
				total: harusDibayar(),
				bayar,
				kembali: kembali()
			};

			toast.success(`Penjualan ${nomorNota} berhasil disimpan!`);

			if (cetakNota) {
				setTimeout(() => {
					window.print();
				}, 300);
			}

			resetAll();
		} catch (err) {
			toast.error(`Gagal menyimpan: ${err instanceof Error ? err.message : 'Terjadi kesalahan.'}`);
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

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<ShoppingCart class="w-6 h-6 text-teal-600" />
				Penjualan (POS)
			</h2>
			<p class="text-xs text-slate-500 mt-1">Transaksi kasir penjualan obat ke pelanggan</p>
		</div>

		<div class="flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-900 px-4 py-2 rounded-xl text-sm font-semibold">
			<span class="text-xs text-teal-600">No. Nota:</span>
			<span class="font-mono text-base">{nomorNota || '...'}</span>
		</div>
	</div>

	<!-- Main POS Grid Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

		<!-- Left 2 columns: Item Selector & Cart Table -->
		<div class="lg:col-span-2 space-y-6">
			
			<!-- Add Item Card -->
			<Card class="border-slate-200 shadow-sm">
				<CardHeader class="pb-3 border-b border-slate-100">
					<CardTitle class="text-sm font-semibold text-slate-800 flex items-center gap-2">
						<Plus class="w-4 h-4 text-teal-600" />
						Pilih & Tambahkan Obat
					</CardTitle>
				</CardHeader>
				<CardContent class="pt-4">
					<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">

						<!-- Obat Search Input (Cols 6) -->
						<div class="sm:col-span-6 space-y-1 relative">
							<label for="cari-obat-jual" class="text-xs font-semibold text-slate-600">Cari Nama / Kode Obat</label>
							<div class="relative">
								<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
								<Input
									id="cari-obat-jual"
									bind:value={obatSearch}
									oninput={searchObat}
									autocomplete="off"
									placeholder="Ketik minimal 2 karakter..."
									class="pl-9"
								/>
							</div>

							<!-- Search Results Dropdown -->
							{#if searchLoading}
								<div class="absolute left-0 right-0 top-full mt-1 bg-white p-2 rounded-lg border border-slate-200 shadow-lg text-xs text-slate-400 z-20">
									Mencari obat...
								</div>
							{:else if obatResults.length > 0}
								<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-60 overflow-y-auto z-30 divide-y divide-slate-100">
									{#each obatResults as obat}
										<button
											type="button"
											onclick={() => pilihObat(obat)}
											class="w-full text-left p-2.5 hover:bg-teal-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
										>
											<div>
												<div class="font-semibold text-slate-900">{obat.obat_nama}</div>
												<div class="text-[10px] text-slate-400">Kode: {obat.obat_id}</div>
											</div>
											<Badge variant="secondary" class="text-[10px]">{obat.jenis_nama}</Badge>
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Qty Input (Cols 2) -->
						<div class="sm:col-span-2 space-y-1">
							<label for="qty-jual" class="text-xs font-semibold text-slate-600">Jumlah</label>
							<Input id="qty-jual" type="number" min="1" bind:value={inputQty} class="text-center" />
						</div>

						<!-- Price Input (Cols 4) -->
						<div class="sm:col-span-4 space-y-1">
							<div class="flex items-center justify-between">
								<label for="harga-jual" class="text-xs font-semibold text-slate-600">Harga (Rp)</label>
								{#if stokInfo && stokInfo.min_price > 0}
									<button
										type="button"
										onclick={setHargaMinimum}
										class="text-[10px] text-amber-700 font-semibold hover:underline cursor-pointer"
									>
										Min: Rp{formatRp(stokInfo.min_price)}
									</button>
								{/if}
							</div>
							<Input
								id="harga-jual"
								type="number"
								min="0"
								bind:value={inputHarga}
								class={stokInfo && stokInfo.min_price > 0 && inputHarga < stokInfo.min_price ? 'border-amber-400 bg-amber-50' : ''}
							/>
						</div>
					</div>

					<!-- Stock Info Hint Banner -->
					{#if stokInfo}
						<div class="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="text-slate-500">Stok Siap:</span>
								<span class="font-bold text-slate-900">{stokInfo.qty} item</span>
							</div>

							{#if stokInfo.disc_pbf > 0}
								<div class="flex items-center gap-2 text-slate-600">
									<span>Disc PBF: <strong>{stokInfo.disc_pbf}%</strong></span>
									{#if stokInfo.diberikan === 1}
										<Badge variant="success" class="text-[10px]">✓ Diberikan</Badge>
									{:else}
										<Badge variant="destructive" class="text-[10px]">✗ Tidak Diberikan</Badge>
									{/if}
								</div>
							{/if}

							<Button size="sm" onclick={tambahItem} class="ml-auto">
								<Plus class="w-4 h-4 mr-1" /> Tambah Item
							</Button>
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Cart Items Table Card -->
			<Card class="border-slate-200 shadow-sm">
				<CardHeader class="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
					<CardTitle class="text-sm font-semibold text-slate-800">Daftar Transaksi Obat</CardTitle>
					<Badge variant="secondary">{lines.length} Item</Badge>
				</CardHeader>
				<CardContent class="p-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead class="w-12 text-center">No.</TableHead>
								<TableHead>Nama Obat</TableHead>
								<TableHead class="text-center">Jumlah</TableHead>
								<TableHead class="text-right">Harga</TableHead>
								<TableHead class="text-right">Total</TableHead>
								<TableHead class="w-12"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{#if lines.length === 0}
								<TableRow>
									<TableCell colspan={6} class="text-center py-8 text-slate-400 text-xs">
										Belum ada obat ditambahkan. Gunakan pencarian di atas.
									</TableCell>
								</TableRow>
							{:else}
								{#each lines as line, i}
									<TableRow>
										<TableCell class="text-center text-xs text-slate-400">{i + 1}</TableCell>
										<TableCell class="font-semibold text-slate-900 text-xs">
											{line.obat_nama}
											<span class="block text-[10px] text-slate-400 font-normal">{line.jenis_nama}</span>
										</TableCell>
										<TableCell class="text-center font-bold text-xs">{line.qty}</TableCell>
										<TableCell class="text-right text-xs">Rp{formatRp(line.harga_jual)}</TableCell>
										<TableCell class="text-right font-bold text-xs text-teal-700">
											Rp{formatRp(subtotalLine(line))}
										</TableCell>
										<TableCell class="text-center">
											<Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onclick={() => hapusItem(line.obat_id)}>
												<Trash2 class="w-3.5 h-3.5" />
											</Button>
										</TableCell>
									</TableRow>
								{/each}
							{/if}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>

		<!-- Right 1 column: Payment & Totals -->
		<div class="space-y-6">
			<Card class="border-slate-200 shadow-md bg-gradient-to-b from-white to-slate-50">
				<CardHeader class="pb-3 border-b border-slate-100">
					<CardTitle class="text-sm font-semibold text-slate-800">Ringkasan Pembayaran</CardTitle>
				</CardHeader>
				<CardContent class="pt-4 space-y-4">

					<!-- Subtotal Row -->
					<div class="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
						<span>Harga Sebelum Diskon</span>
						<span class="font-medium text-slate-900">Rp{formatRp(hargaSebelumDiskon())}</span>
					</div>

					<!-- Discount Inputs -->
					<div class="grid grid-cols-2 gap-2">
						<div class="space-y-1">
							<label for="disc-persen" class="text-[11px] font-semibold text-slate-500">Diskon (%)</label>
							<Input id="disc-persen" type="number" min="0" max="100" step="0.01" bind:value={totalDiscPersen} oninput={onDiscPersenChange} class="text-xs" />
						</div>
						<div class="space-y-1">
							<label for="disc-rp" class="text-[11px] font-semibold text-slate-500">Diskon (Rp)</label>
							<Input id="disc-rp" type="number" min="0" bind:value={totalDiscRp} oninput={onDiscRpChange} class="text-xs" />
						</div>
					</div>

					<!-- Total Pay Box -->
					<div class="p-4 rounded-xl bg-teal-900 text-white space-y-1 shadow-inner">
						<span class="text-xs text-teal-200 font-medium">TOTAL HARUS DIBAYAR</span>
						<div class="text-2xl font-extrabold tracking-tight">
							Rp{formatRp(harusDibayar())}
						</div>
					</div>

					<!-- Customer Payment Input -->
					<div class="space-y-1 pt-2">
						<label for="bayar-input" class="text-xs font-semibold text-slate-700">Jumlah Uang Bayar (Rp)</label>
						<Input id="bayar-input" type="number" min="0" bind:value={bayar} class="text-lg font-bold text-slate-900 h-11" />
					</div>

					<!-- Change Amount -->
					<div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
						<span class="text-xs text-emerald-800 font-medium">Kembalian</span>
						<span class="text-lg font-bold text-emerald-700">Rp{formatRp(kembali())}</span>
					</div>

					<!-- Receipt Toggle Option -->
					<div class="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
						<span>Cetak Nota Struk?</span>
						<RadioGroup
							name="cetak"
							bind:value={cetakNotaValue}
							onValueChange={(v) => (cetakNota = v === 'true')}
							options={[
								{ value: 'true', label: 'Ya' },
								{ value: 'false', label: 'Tidak' }
							]}
						/>
					</div>
				</CardContent>

				<CardFooter class="flex flex-col gap-2 pt-2 border-t border-slate-100">
					<Button
						class="w-full h-11 text-base font-semibold"
						disabled={saving || loading || lines.length === 0 || bayar < harusDibayar()}
						onclick={simpanPenjualan}
					>
						{#if saving}
							Menyimpan...
						{:else}
							<CheckCircle2 class="w-5 h-5 mr-2" /> Selesaikan Transaksi
						{/if}
					</Button>

					<Button variant="ghost" size="sm" class="w-full text-slate-400" onclick={resetAll} disabled={saving}>
						<RotateCcw class="w-3.5 h-3.5 mr-1" /> Reset Transaksi
					</Button>
				</CardFooter>
			</Card>
		</div>
	</div>
</div>

<!-- Hidden Thermal Printable Receipt -->
{#if lastSavedTransaction}
	<div id="printable-receipt" class="hidden print:block">
		<div style="text-align: center; margin-bottom: 8px;">
			<h3 style="font-size: 14px; font-weight: bold; margin: 0;">APOTEK PWA</h3>
			<p style="font-size: 10px; margin: 2px 0;">Jl. Apotek Farmasi No. 1</p>
			<p style="font-size: 10px; margin: 0;">Telp: (021) 555-0123</p>
			<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
		</div>

		<div style="font-size: 10px; margin-bottom: 6px;">
			<div>Nota  : {lastSavedTransaction.nomorNota}</div>
			<div>Tgl   : {new Date(lastSavedTransaction.tanggalWaktu).toLocaleString('id-ID')}</div>
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<table style="width: 100%; font-size: 10px; text-align: left; border-collapse: collapse;">
			<tbody>
				{#each lastSavedTransaction.lines as line}
					<tr>
						<td colspan="3" style="font-weight: bold; padding-top: 2px;">{line.obat_nama}</td>
					</tr>
					<tr>
						<td style="width: 30%;">{line.qty} x Rp{formatRp(line.harga_jual)}</td>
						<td style="text-align: right;" colspan="2">Rp{formatRp(subtotalLine(line))}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="font-size: 10px; line-height: 1.4;">
			<div style="display: flex; justify-content: space-between;">
				<span>Subtotal:</span>
				<span>Rp{formatRp(lastSavedTransaction.subtotal)}</span>
			</div>
			{#if lastSavedTransaction.diskon > 0}
				<div style="display: flex; justify-content: space-between;">
					<span>Diskon:</span>
					<span>-Rp{formatRp(lastSavedTransaction.diskon)}</span>
				</div>
			{/if}
			<div style="display: flex; justify-content: space-between; font-weight: bold;">
				<span>TOTAL:</span>
				<span>Rp{formatRp(lastSavedTransaction.total)}</span>
			</div>
			<div style="display: flex; justify-content: space-between;">
				<span>Bayar:</span>
				<span>Rp{formatRp(lastSavedTransaction.bayar)}</span>
			</div>
			<div style="display: flex; justify-content: space-between;">
				<span>Kembali:</span>
				<span>Rp{formatRp(lastSavedTransaction.kembali)}</span>
			</div>
		</div>

		<div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>

		<div style="text-align: center; font-size: 9px; margin-top: 8px;">
			<p>Terima Kasih Semoga Lekas Sembuh</p>
			<p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
		</div>
	</div>
{/if}
