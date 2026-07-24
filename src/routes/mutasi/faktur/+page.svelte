<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { IFakturItemInput, IFakturSimpanInput, Iobat, Ipbf } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { RadioGroup } from '$lib/components/ui/radio-group';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PageHeader } from '$lib/components/ui/page-header';
	import { NumberStepper } from '$lib/components/ui/number-stepper';
	import { DatePicker } from '$lib/components/ui/date-picker';
	import { FileSpreadsheet, Plus, Search, Trash2, Save, RotateCcw, Building2, Calendar, Pill } from 'lucide-svelte';

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

	function today(): string {
		const date = new Date();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${date.getFullYear()}-${month}-${day}`;
	}

	let header = $state({ pbf_id: '', tanggal: today() });
	let diberikanValue = $state('0');
	let item = $state({
		obat_id: '',
		jumlah_box: 1,
		isi_per_box: 1,
		harga_per_box: 0,
		disc: 0,
		expired_date: '',
		diberikan: 0 as 0 | 1
	});

	function number(value: number): string {
		return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value || 0);
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
		if (error) toast.error(`Gagal memuat PBF: ${error.message}`);
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
			toast.error(`Gagal mencari obat: ${error.message}`);
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
		diberikanValue = '0';
		selectedObat = null;
		obatSearch = '';
		obatResults = [];
	}

	function tambahItem() {
		const obat = selectedObat;
		if (!obat) {
			toast.error('Pilih obat dari hasil pencarian.');
			return;
		}
		if (item.jumlah_box <= 0 || item.isi_per_box <= 0 || item.harga_per_box < 0) {
			toast.error('Jumlah box, isi per box, dan harga per box harus valid.');
			return;
		}
		if (!item.expired_date) {
			toast.error('Tanggal kedaluwarsa wajib diisi.');
			return;
		}
		if (lines.some((line) => line.obat_id === obat.obat_id)) {
			toast.error('Obat yang sama sudah ada dalam faktur.');
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
			toast.error('Tanggal dan PBF wajib diisi.');
			return;
		}
		if (lines.length === 0) {
			toast.error('Tambahkan minimal satu obat ke faktur.');
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
			toast.success(`Faktur ${transId} berhasil tersimpan.`);
			resetFaktur();
		} catch (error) {
			toast.error(`Faktur gagal disimpan: ${error instanceof Error ? error.message : 'Terjadi kesalahan.'}`);
		} finally {
			saving = false;
		}
	}

	onMount(loadInitialData);
</script>

<div class="space-y-4">
	<!-- Page Header -->
	<PageHeader
		title="Input Mutasi Faktur Pembelian"
		description="Catat penerimaan faktur dari PBF supplier dan penambahan stok obat"
		badge={`${lines.length} Item Input`}
	/>

	<!-- Header Form Card (Supplier & Date) -->
	<Card class="border border-slate-200/80 rounded-2xl shadow-2xs bg-white">
		<CardContent class="pt-4 pb-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

				<!-- Tanggal Faktur -->
				<div class="space-y-1.5">
					<label for="faktur-date" class="text-xs font-semibold text-slate-700 block">Tanggal Faktur</label>
					<DatePicker id="faktur-date" bind:value={header.tanggal} placeholder="Pilih tanggal faktur..." />
				</div>

				<!-- PBF Selector -->
				<div class="space-y-1.5 relative">
					<label for="pbf-search" class="text-xs font-semibold text-slate-700 flex items-center gap-1">
						<Building2 class="w-3.5 h-3.5 text-mint-600" /> PBF / Supplier *
					</label>
					<div class="relative">
						<Input
							id="pbf-search"
							type="text"
							placeholder="Cari & pilih PBF..."
							bind:value={pbfSearch}
							class="text-xs h-9 rounded-xl border-slate-200 focus:border-mint-500"
						/>
						{#if filteredPbf().length > 0}
							<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
								{#each filteredPbf() as pbf}
									<button
										type="button"
										onclick={() => pilihPbf(pbf)}
										class="w-full text-left p-2.5 hover:bg-mint-50 text-xs flex justify-between cursor-pointer"
									>
										<span class="font-semibold text-slate-900">{pbf.pbf_nama}</span>
										<Badge variant="secondary" class="text-[10px]">{pbf.pbf_id}</Badge>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Add Items Form Card -->
	<Card class="border border-slate-200/80 rounded-2xl shadow-2xs">
		<CardHeader class="pb-3 border-b border-slate-100">
			<CardTitle class="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
				<Plus class="w-4 h-4 text-mint-600" /> Tambah Item Obat ke Faktur
			</CardTitle>
		</CardHeader>
		<CardContent class="pt-4">
			<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">

				<!-- Search Obat (Cols 4) -->
				<div class="sm:col-span-4 space-y-1 relative">
					<label for="search-obat-faktur" class="text-xs font-semibold text-slate-600">Cari Obat</label>
					<div class="relative">
						<Input
							id="search-obat-faktur"
							type="text"
							placeholder="Pilih obat..."
							bind:value={obatSearch}
							oninput={searchObat}
							class="text-xs h-9 rounded-xl border-slate-200 focus:border-mint-500"
						/>
					</div>
					{#if searchLoading}
						<div class="absolute left-0 right-0 top-full mt-1 bg-white p-2 rounded-xl border border-slate-200 shadow-lg text-xs text-slate-400 z-20">
							Mencari...
						</div>
					{:else if obatResults.length > 0}
						<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto z-30 divide-y divide-slate-100">
							{#each obatResults as o}
								<button
									type="button"
									onclick={() => pilihObat(o)}
									class="w-full text-left p-2.5 hover:bg-mint-50 text-xs flex justify-between cursor-pointer"
								>
									<span class="font-semibold text-slate-900">{o.obat_nama}</span>
									<Badge variant="secondary" class="text-[10px]">{o.obat_id}</Badge>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Jml Box (Cols 3) -->
				<div class="sm:col-span-3 space-y-1">
					<label for="jml-box" class="text-xs font-semibold text-slate-600 block">Jml Box</label>
					<NumberStepper bind:value={item.jumlah_box} min={1} class="w-full" />
				</div>

				<!-- Isi / Box (Cols 3) -->
				<div class="sm:col-span-3 space-y-1">
					<label for="isi-box" class="text-xs font-semibold text-slate-600 block">Isi/Box</label>
					<NumberStepper bind:value={item.isi_per_box} min={1} class="w-full" />
				</div>

				<!-- Harga / Box (Cols 3) -->
				<div class="sm:col-span-3 space-y-1">
					<label for="harga-box" class="text-xs font-semibold text-slate-600">Harga/Box (Rp)</label>
					<Input id="harga-box" type="number" min="0" bind:value={item.harga_per_box} onfocus={(e) => e.currentTarget.select()} class="text-xs h-9 rounded-xl font-mono" />
				</div>

				<!-- Disc % (Cols 3) -->
				<div class="sm:col-span-3 space-y-1">
					<label for="disc-item" class="text-xs font-semibold text-slate-600">Disc (%)</label>
					<Input id="disc-item" type="number" min="0" max="100" step="0.1" bind:value={item.disc} onfocus={(e) => e.currentTarget.select()} class="text-xs h-9 rounded-xl" />
				</div>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mt-3 pt-3 border-t border-slate-100">
				<!-- Tgl Expired (Cols 4) -->
				<div class="sm:col-span-4 space-y-1">
					<label for="exp-date" class="text-xs font-semibold text-slate-600 block">Tgl Kedaluwarsa *</label>
					<DatePicker id="exp-date" bind:value={item.expired_date} placeholder="Pilih tgl exp..." />
				</div>

				<!-- Diberikan Radio (Cols 4) -->
				<div class="sm:col-span-4 space-y-1">
					<span class="text-xs font-semibold text-slate-600 block">Status Diskon</span>
					<div class="flex items-center h-9">
						<RadioGroup
							name="diberikan"
							bind:value={diberikanValue}
							onValueChange={(v) => (item.diberikan = Number(v) as 0 | 1)}
							options={[
								{ value: '1', label: 'Diberikan (✓)' },
								{ value: '0', label: 'Tidak (✗)' }
							]}
						/>
					</div>
				</div>

				<!-- Add Button (Cols 4) -->
				<div class="sm:col-span-4 flex justify-end">
					<Button size="sm" onclick={tambahItem} class="w-full sm:w-auto h-9 bg-mint-500 hover:bg-mint-600 text-white font-bold rounded-xl gap-1 cursor-pointer">
						<Plus class="w-4 h-4 mr-1" /> Tambah Obat
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Table Added Items Card -->
	<Card class="border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
		<CardHeader class="pb-3 pt-3 border-b border-slate-100 flex flex-row items-center justify-between">
			<CardTitle class="text-xs font-bold text-slate-800 uppercase tracking-wider">Daftar Item Faktur</CardTitle>
			<div class="text-sm font-extrabold text-mint-700 font-mono">
				Total Faktur: Rp{number(totalFaktur())}
			</div>
		</CardHeader>
		<CardContent class="p-0">
			<Table class="table-compact table-striped">
				<TableHeader class="bg-slate-50/80">
					<TableRow>
						<TableHead class="w-12 text-center font-bold text-slate-700">No.</TableHead>
						<TableHead class="font-bold text-slate-700">Nama Obat</TableHead>
						<TableHead class="text-center font-bold text-slate-700">Jml Box</TableHead>
						<TableHead class="text-center font-bold text-slate-700">Isi/Box</TableHead>
						<TableHead class="text-right font-bold text-slate-700">Harga Satuan</TableHead>
						<TableHead class="text-center font-bold text-slate-700">Disc (%)</TableHead>
						<TableHead class="text-right font-bold text-slate-700">Total Net</TableHead>
						<TableHead class="w-12"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{#if lines.length === 0}
						<TableRow>
							<TableCell colspan={8} class="text-center py-8 text-slate-400 text-xs italic">
								Belum ada obat dimasukkan ke faktur.
							</TableCell>
						</TableRow>
					{:else}
						{#each lines as line, i}
							<TableRow>
								<TableCell class="text-center text-xs text-slate-400">{i + 1}</TableCell>
								<TableCell class="font-semibold text-slate-900 text-xs">
									{line.obat_nama}
									<span class="block text-[10px] text-slate-400 font-normal">Exp: {line.expired_date}</span>
								</TableCell>
								<TableCell class="text-center text-xs">{line.jumlah_box}</TableCell>
								<TableCell class="text-center text-xs">{line.isi_per_box}</TableCell>
								<TableCell class="text-right text-xs">Rp{number(hargaSatuan(line))}</TableCell>
								<TableCell class="text-center text-xs">{line.disc}%</TableCell>
								<TableCell class="text-right font-bold text-xs text-teal-700">
									Rp{number(totalBaris(line))}
								</TableCell>
								<TableCell class="text-center">
									<Button variant="ghost" size="icon" class="h-7 w-7 text-red-500 hover:bg-red-50" onclick={() => hapusItem(line.obat_id)}>
										<Trash2 class="w-3.5 h-3.5" />
									</Button>
								</TableCell>
							</TableRow>
						{/each}
					{/if}
				</TableBody>
			</Table>
		</CardContent>

		<CardFooter class="flex items-center justify-between pt-4 border-t border-slate-100">
			<Button variant="ghost" size="sm" onclick={resetFaktur} disabled={saving}>
				<RotateCcw class="w-3.5 h-3.5 mr-1" /> Reset Faktur
			</Button>

			<Button size="sm" onclick={simpanFaktur} disabled={saving || lines.length === 0 || !header.pbf_id}>
				{#if saving}
					Menyimpan...
				{:else}
					<Save class="w-3.5 h-3.5 mr-1" /> Simpan Faktur
				{/if}
			</Button>
		</CardFooter>
	</Card>
</div>
