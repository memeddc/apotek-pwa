<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iresep, Idetail_resep, Idetail_racikan, IResepItemInput, IResepRacikanInput, Iobat } from '$lib/db/types';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select } from '$lib/components/ui/select';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Sheet } from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ClipboardList, Plus, Search, Eye, RotateCcw, Save, Trash2, Pill, FlaskConical, User, UserCheck } from 'lucide-svelte';

	type ResepWithDetail = Iresep & {
		detailCount?: number;
		racikanCount?: number;
	};

	type DetailResepView = Idetail_resep & { obat_nama?: string };
	type DetailRacikanView = Idetail_racikan & { obat_nama?: string };

	let loading = $state(true);

	// List & Filter states
	let resepList = $state<ResepWithDetail[]>([]);
	let searchQuery = $state('');
	let dateFilter = $state<'all' | 'today' | '7days'>('all');

	// Detail Sheet states
	let selectedResep = $state<Iresep | null>(null);
	let viewDetails = $state<DetailResepView[]>([]);
	let viewRacikan = $state<DetailRacikanView[]>([]);
	let loadingDetail = $state(false);
	let showDetailSheet = $state(false);

	// Create Sheet states
	let showAddSheet = $state(false);
	let saving = $state(false);

	// Form inputs
	let inputResepId = $state('');
	let inputTanggalResep = $state(todayStr());
	let inputPasienNama = $state('');
	let inputDokterNama = $state('');
	let inputAlamatPasien = $state('');
	let inputKetResep = $state('');

	// Item inputs (Non-Racikan)
	let obatSearchQuery = $state('');
	let obatSearchResults = $state<Iobat[]>([]);
	let selectedObatItem = $state<Iobat | null>(null);
	let inputQtyResep = $state(1);
	let inputQtyAsli = $state(1);
	let inputHargaPerObat = $state(0);
	let itemLines = $state<IResepItemInput[]>([]);

	// Item inputs (Racikan)
	let racikanSearchQuery = $state('');
	let racikanSearchResults = $state<Iobat[]>([]);
	let selectedRacikanObat = $state<Iobat | null>(null);
	let inputQtyRacikan = $state(1);
	let racikanLines = $state<IResepRacikanInput[]>([]);

	function formatRp(val: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(val));
	}

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function formatDateIndo(dateStr: string): string {
		if (!dateStr) return '-';
		try {
			const d = new Date(dateStr);
			if (isNaN(d.getTime())) return dateStr;
			return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
		} catch {
			return dateStr;
		}
	}

	async function loadResepList() {
		loading = true;
		try {
			let query = supabase.from('resep').select('*').order('tanggal_buat', { ascending: false });

			const q = searchQuery.trim();
			if (q) {
				const safe = q.replaceAll('%', '');
				query = query.or(`pasien_nama.ilike.%${safe}%,dokter_nama.ilike.%${safe}%,resep_id.ilike.%${safe}%`);
			}

			if (dateFilter === 'today') {
				query = query.eq('tanggal_resep', todayStr());
			} else if (dateFilter === '7days') {
				const d = new Date();
				d.setDate(d.getDate() - 7);
				const d7 = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				query = query.gte('tanggal_resep', d7);
			}

			const { data, error } = await query.limit(50);
			if (error) {
				toast.error(`Gagal memuat resep: ${error.message}`);
				resepList = [];
			} else {
				resepList = data ?? [];
			}
		} catch (e: any) {
			toast.error(`Terjadi kesalahan: ${e?.message || e}`);
		} finally {
			loading = false;
		}
	}

	async function openDetailSheet(resep: Iresep) {
		selectedResep = resep;
		showDetailSheet = true;
		loadingDetail = true;
		viewDetails = [];
		viewRacikan = [];

		try {
			const { data: dData, error: dErr } = await supabase
				.from('detail_resep')
				.select('*')
				.eq('resep_id', resep.resep_id);

			if (dErr) console.error('Error fetching detail_resep:', dErr);

			const { data: rData, error: rErr } = await supabase
				.from('detail_racikan')
				.select('*')
				.eq('resep_id', resep.resep_id);

			if (rErr) console.error('Error fetching detail_racikan:', rErr);

			const obatIds = Array.from(new Set([
				...(dData ?? []).map(i => i.obat_id),
				...(rData ?? []).map(i => i.obat_id)
			]));

			let obatMap: Record<string, string> = {};
			if (obatIds.length > 0) {
				const { data: oData } = await supabase
					.from('obat')
					.select('obat_id, obat_nama')
					.in('obat_id', obatIds);

				(oData ?? []).forEach(o => {
					obatMap[o.obat_id] = o.obat_nama;
				});
			}

			viewDetails = (dData ?? []).map(item => ({
				...item,
				obat_nama: obatMap[item.obat_id] || item.obat_id
			}));

			viewRacikan = (rData ?? []).map(item => ({
				...item,
				obat_nama: obatMap[item.obat_id] || item.obat_id
			}));

		} catch (e: any) {
			toast.error(`Gagal memuat detail resep: ${e?.message || e}`);
		} finally {
			loadingDetail = false;
		}
	}

	async function generateResepId() {
		const d = new Date();
		const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
		const prefix = `RSP-${datePart}-`;

		try {
			const { data, error } = await supabase
				.from('resep')
				.select('resep_id')
				.like('resep_id', `${prefix}%`)
				.order('resep_id', { ascending: false })
				.limit(1);

			let seq = 1;
			if (!error && data && data.length > 0) {
				const lastId = data[0].resep_id;
				const lastSeqStr = lastId.replace(prefix, '');
				const parsed = parseInt(lastSeqStr, 10);
				if (!isNaN(parsed)) seq = parsed + 1;
			}
			inputResepId = `${prefix}${String(seq).padStart(3, '0')}`;
		} catch {
			inputResepId = `${prefix}001`;
		}
	}

	function resetForm() {
		inputTanggalResep = todayStr();
		inputPasienNama = '';
		inputDokterNama = '';
		inputAlamatPasien = '';
		inputKetResep = '';
		itemLines = [];
		racikanLines = [];
		resetObatInput();
		resetRacikanInput();
		generateResepId();
	}

	function openAddSheet() {
		resetForm();
		showAddSheet = true;
	}

	async function searchObatForDetail(term: string) {
		const q = term.trim();
		if (!q) {
			obatSearchResults = [];
			return;
		}
		try {
			const safe = q.replaceAll('%', '');
			const { data } = await supabase
				.from('obat')
				.select('*')
				.eq('isActive', 1)
				.or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`)
				.order('obat_nama')
				.limit(15);
			obatSearchResults = data ?? [];
		} catch (e) {
			console.error(e);
		}
	}

	async function selectObatForDetail(obat: Iobat) {
		selectedObatItem = obat;
		obatSearchQuery = `${obat.obat_nama} (${obat.obat_id})`;
		obatSearchResults = [];

		try {
			const { data: stokData } = await supabase
				.from('stok')
				.select('harga_jual')
				.eq('obat_id', obat.obat_id)
				.maybeSingle();

			if (stokData && stokData.harga_jual) {
				inputHargaPerObat = Math.round(stokData.harga_jual);
			} else {
				inputHargaPerObat = 0;
			}
		} catch {
			inputHargaPerObat = 0;
		}
	}

	function resetObatInput() {
		selectedObatItem = null;
		obatSearchQuery = '';
		obatSearchResults = [];
		inputQtyResep = 1;
		inputQtyAsli = 1;
		inputHargaPerObat = 0;
	}

	function addItemLine() {
		if (!selectedObatItem) {
			toast.error('Pilih obat terlebih dahulu!');
			return;
		}
		if (inputQtyResep <= 0 || inputQtyAsli <= 0) {
			toast.error('Qty resep dan qty asli harus lebih besar dari 0!');
			return;
		}

		const existingIndex = itemLines.findIndex(i => i.obat_id === selectedObatItem!.obat_id);
		if (existingIndex >= 0) {
			itemLines[existingIndex].qty_resep += inputQtyResep;
			itemLines[existingIndex].qty_asli += inputQtyAsli;
			itemLines[existingIndex].harga_per_obat = inputHargaPerObat;
			itemLines = [...itemLines];
		} else {
			itemLines = [
				...itemLines,
				{
					obat_id: selectedObatItem.obat_id,
					obat_nama: selectedObatItem.obat_nama,
					qty_resep: inputQtyResep,
					qty_asli: inputQtyAsli,
					harga_per_obat: inputHargaPerObat
				}
			];
		}

		resetObatInput();
	}

	function removeItemLine(index: number) {
		itemLines = itemLines.filter((_, i) => i !== index);
	}

	async function searchObatForRacikan(term: string) {
		const q = term.trim();
		if (!q) {
			racikanSearchResults = [];
			return;
		}
		try {
			const safe = q.replaceAll('%', '');
			const { data } = await supabase
				.from('obat')
				.select('*')
				.eq('isActive', 1)
				.or(`obat_id.ilike.%${safe}%,obat_nama.ilike.%${safe}%`)
				.order('obat_nama')
				.limit(15);
			racikanSearchResults = data ?? [];
		} catch (e) {
			console.error(e);
		}
	}

	function selectObatForRacikan(obat: Iobat) {
		selectedRacikanObat = obat;
		racikanSearchQuery = `${obat.obat_nama} (${obat.obat_id})`;
		racikanSearchResults = [];
	}

	function resetRacikanInput() {
		selectedRacikanObat = null;
		racikanSearchQuery = '';
		racikanSearchResults = [];
		inputQtyRacikan = 1;
	}

	function addRacikanLine() {
		if (!selectedRacikanObat) {
			toast.error('Pilih obat racikan terlebih dahulu!');
			return;
		}
		if (inputQtyRacikan <= 0) {
			toast.error('Qty racikan harus lebih besar dari 0!');
			return;
		}

		const existingIndex = racikanLines.findIndex(r => r.obat_id === selectedRacikanObat!.obat_id);
		if (existingIndex >= 0) {
			racikanLines[existingIndex].qty_racikan += inputQtyRacikan;
			racikanLines = [...racikanLines];
		} else {
			racikanLines = [
				...racikanLines,
				{
					obat_id: selectedRacikanObat.obat_id,
					obat_nama: selectedRacikanObat.obat_nama,
					qty_racikan: inputQtyRacikan
				}
			];
		}

		resetRacikanInput();
	}

	function removeRacikanLine(index: number) {
		racikanLines = racikanLines.filter((_, i) => i !== index);
	}

	async function simpanResep() {
		const resepId = inputResepId.trim();
		const pasienNama = inputPasienNama.trim();
		const dokterNama = inputDokterNama.trim();
		const tanggalResep = inputTanggalResep;

		if (!resepId) {
			toast.error('Nomor Resep tidak boleh kosong!');
			return;
		}
		if (!pasienNama) {
			toast.error('Nama Pasien wajib diisi!');
			return;
		}
		if (!dokterNama) {
			toast.error('Nama Dokter wajib diisi!');
			return;
		}
		if (itemLines.length === 0 && racikanLines.length === 0) {
			toast.error('Tambahkan minimal 1 item obat ke dalam resep!');
			return;
		}

		saving = true;
		try {
			const { data: existing } = await supabase
				.from('resep')
				.select('resep_id')
				.eq('resep_id', resepId)
				.maybeSingle();

			if (existing) {
				toast.error(`Nomor Resep '${resepId}' sudah terdaftar. Gunaan Nomor Resep lain!`);
				saving = false;
				return;
			}

			const { error: resepErr } = await supabase.from('resep').insert({
				resep_id: resepId,
				pasien_nama: pasienNama,
				dokter_nama: dokterNama,
				alamat_pasien: inputAlamatPasien.trim(),
				tanggal_resep: tanggalResep,
				tanggal_buat: new Date().toISOString(),
				ket_resep: inputKetResep.trim() || null
			});

			if (resepErr) {
				throw new Error(`Gagal menyimpan header resep: ${resepErr.message}`);
			}

			if (itemLines.length > 0) {
				const detailRows = itemLines.map(item => ({
					resep_id: resepId,
					obat_id: item.obat_id,
					qty_resep: item.qty_resep,
					qty_asli: item.qty_asli,
					harga_per_obat: item.harga_per_obat
				}));

				const { error: detailErr } = await supabase.from('detail_resep').insert(detailRows);
				if (detailErr) {
					throw new Error(`Gagal menyimpan detail obat: ${detailErr.message}`);
				}
			}

			if (racikanLines.length > 0) {
				const racikanRows = racikanLines.map(item => ({
					resep_id: resepId,
					obat_id: item.obat_id,
					qty_racikan: item.qty_racikan
				}));

				const { error: racikanErr } = await supabase.from('detail_racikan').insert(racikanRows);
				if (racikanErr) {
					throw new Error(`Gagal menyimpan detail racikan: ${racikanErr.message}`);
				}
			}

			toast.success(`Resep '${resepId}' untuk pasien '${pasienNama}' berhasil disimpan!`);
			showAddSheet = false;
			await loadResepList();
		} catch (e: any) {
			toast.error(e?.message || 'Terjadi kesalahan saat menyimpan resep.');
		} finally {
			saving = false;
		}
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadResepList();
		}, 300);
	}

	onMount(() => {
		loadResepList();
	});
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<ClipboardList class="w-6 h-6 text-teal-600" />
				Resep Dokter
			</h2>
			<p class="text-xs text-slate-500 mt-1">Kelola resep pasien dari dokter dan obat racikan</p>
		</div>

		<Button onclick={openAddSheet}>
			<Plus class="w-4 h-4 mr-2" /> Resep Baru
		</Button>
	</div>

	<!-- Toolbar & Search -->
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex flex-wrap items-center gap-3 flex-1">
			<div class="relative min-w-[240px] max-w-sm">
				<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
				<Input
					type="text"
					placeholder="Cari pasien, dokter, no resep..."
					bind:value={searchQuery}
					oninput={handleSearchInput}
					class="pl-9"
				/>
			</div>

			<Select
				bind:value={dateFilter}
				onValueChange={loadResepList}
				options={[
					{ value: 'all', label: 'Semua Tanggal' },
					{ value: 'today', label: 'Hari Ini' },
					{ value: '7days', label: '7 Hari Terakhir' }
				]}
				class="w-40"
			/>

			<Button variant="outline" size="sm" onclick={loadResepList} disabled={loading}>
				<RotateCcw class="w-3.5 h-3.5 mr-1" /> Refresh
			</Button>
		</div>
	</div>

	<!-- Data Table -->
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead class="w-36">No. Resep</TableHead>
				<TableHead>Tgl Resep</TableHead>
				<TableHead>Nama Pasien</TableHead>
				<TableHead>Dokter Penanggung Jawab</TableHead>
				<TableHead>Alamat</TableHead>
				<TableHead class="w-24 text-center">Aksi</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{#if loading}
				{#each Array(5) as _}
					<TableRow>
						<TableCell><Skeleton class="h-5 w-24" /></TableCell>
						<TableCell><Skeleton class="h-5 w-20" /></TableCell>
						<TableCell><Skeleton class="h-5 w-32" /></TableCell>
						<TableCell><Skeleton class="h-5 w-32" /></TableCell>
						<TableCell><Skeleton class="h-5 w-40" /></TableCell>
						<TableCell><Skeleton class="h-5 w-16 mx-auto" /></TableCell>
					</TableRow>
				{/each}
			{:else if resepList.length === 0}
				<TableRow>
					<TableCell colspan={6} class="text-center py-8 text-slate-400 text-xs">
						Tidak ada data resep ditemukan.
					</TableCell>
				</TableRow>
			{:else}
				{#each resepList as item}
					<TableRow>
						<TableCell>
							<Badge variant="secondary" class="font-mono text-xs text-sky-700 bg-sky-50">{item.resep_id}</Badge>
						</TableCell>
						<TableCell class="text-xs text-slate-600">{formatDateIndo(item.tanggal_resep)}</TableCell>
						<TableCell class="font-semibold text-slate-900 text-xs">
							<span class="flex items-center gap-1.5">
								<User class="w-3.5 h-3.5 text-teal-600 shrink-0" /> {item.pasien_nama}
							</span>
						</TableCell>
						<TableCell class="text-xs text-slate-700">
							<span class="flex items-center gap-1.5">
								<UserCheck class="w-3.5 h-3.5 text-slate-400 shrink-0" /> {item.dokter_nama}
							</span>
						</TableCell>
						<TableCell class="text-xs text-slate-500 truncate max-w-xs">{item.alamat_pasien || '—'}</TableCell>
						<TableCell class="text-center">
							<Button variant="outline" size="sm" class="h-7 text-xs hover:bg-sky-50 hover:text-sky-700" onclick={() => openDetailSheet(item)}>
								<Eye class="w-3 h-3 mr-1" /> Detail
							</Button>
						</TableCell>
					</TableRow>
				{/each}
			{/if}
		</TableBody>
	</Table>
</div>

<!-- Slide-in Sheet Detail Resep -->
<Sheet
	bind:open={showDetailSheet}
	title={`Detail Resep ${selectedResep?.resep_id ?? ''}`}
	description="Rincian pasien, dokter, dan daftar obat resep."
>
	{#if selectedResep}
		<div class="space-y-6 pt-2">

			<!-- Pasien Header Card -->
			<div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
				<div class="flex items-center justify-between border-b border-slate-200 pb-2">
					<span class="font-bold text-slate-900 text-sm">{selectedResep.pasien_nama}</span>
					<Badge variant="secondary">{formatDateIndo(selectedResep.tanggal_resep)}</Badge>
				</div>
				<div class="grid grid-cols-2 gap-2 text-slate-600">
					<div>Dokter: <strong class="text-slate-800">{selectedResep.dokter_nama}</strong></div>
					<div>Alamat: <span class="text-slate-800">{selectedResep.alamat_pasien || '—'}</span></div>
				</div>
				{#if selectedResep.ket_resep}
					<div class="text-slate-500 pt-1 border-t border-slate-100">
						Ket: <em>{selectedResep.ket_resep}</em>
					</div>
				{/if}
			</div>

			{#if loadingDetail}
				<div class="space-y-2">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-16 w-full" />
				</div>
			{:else}
				<!-- Non-Racikan Table -->
				<div class="space-y-2">
					<h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
						<Pill class="w-4 h-4 text-teal-600" /> Detail Obat (Non-Racikan)
					</h4>

					{#if viewDetails.length === 0}
						<p class="text-xs text-slate-400 italic">Tidak ada obat non-racikan.</p>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Nama Obat</TableHead>
									<TableHead class="text-right">Qty</TableHead>
									<TableHead class="text-right">Harga</TableHead>
									<TableHead class="text-right">Subtotal</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each viewDetails as det}
									<TableRow>
										<TableCell class="font-medium text-xs">{det.obat_nama}</TableCell>
										<TableCell class="text-right text-xs">{det.qty_asli}</TableCell>
										<TableCell class="text-right text-xs">Rp{formatRp(det.harga_per_obat)}</TableCell>
										<TableCell class="text-right font-bold text-xs text-teal-700">
											Rp{formatRp(det.qty_asli * det.harga_per_obat)}
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{/if}
				</div>

				<!-- Racikan Table -->
				<div class="space-y-2 pt-2">
					<h4 class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
						<FlaskConical class="w-4 h-4 text-purple-600" /> Detail Obat Racikan
					</h4>

					{#if viewRacikan.length === 0}
						<p class="text-xs text-slate-400 italic">Tidak ada obat racikan.</p>
					{:else}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Nama Obat Racikan</TableHead>
									<TableHead class="text-right">Qty Racik</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each viewRacikan as rac}
									<TableRow>
										<TableCell class="font-medium text-xs">{rac.obat_nama}</TableCell>
										<TableCell class="text-right font-bold text-xs">{rac.qty_racikan}</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showDetailSheet = false)}>Tutup</Button>
	{/snippet}
</Sheet>

<!-- Slide-in Sheet Form Resep Baru -->
<Sheet
	bind:open={showAddSheet}
	title="Form Tambah Resep Baru"
	description="Input data resep dokter beserta rincian obat."
	side="right"
>
	<div class="space-y-4 pt-2">

		<!-- Pasien & Dokter Info -->
		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<label for="resep-id-input" class="text-xs font-semibold text-slate-700">No. Resep</label>
				<Input id="resep-id-input" type="text" bind:value={inputResepId} class="font-mono bg-slate-50 text-xs" />
			</div>
			<div class="space-y-1">
				<label for="resep-date-input" class="text-xs font-semibold text-slate-700">Tgl Resep</label>
				<Input id="resep-date-input" type="date" bind:value={inputTanggalResep} class="text-xs" />
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div class="space-y-1">
				<label for="pasien-nama-input" class="text-xs font-semibold text-slate-700">Nama Pasien *</label>
				<Input id="pasien-nama-input" type="text" bind:value={inputPasienNama} placeholder="Nama pasien..." class="text-xs" />
			</div>
			<div class="space-y-1">
				<label for="dokter-nama-input" class="text-xs font-semibold text-slate-700">Nama Dokter *</label>
				<Input id="dokter-nama-input" type="text" bind:value={inputDokterNama} placeholder="Nama dokter..." class="text-xs" />
			</div>
		</div>

		<div class="space-y-1">
			<label for="alamat-pasien-input" class="text-xs font-semibold text-slate-700">Alamat Pasien</label>
			<Input id="alamat-pasien-input" type="text" bind:value={inputAlamatPasien} placeholder="Alamat lengkap..." class="text-xs" />
		</div>

		<!-- Non-Racikan Input Box -->
		<div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
			<h4 class="text-xs font-bold text-slate-800 flex items-center gap-1">
				<Pill class="w-3.5 h-3.5 text-teal-600" /> Tambah Obat Non-Racikan
			</h4>

			<div class="space-y-2">
				<div class="relative">
					<Input
						type="text"
						placeholder="Cari obat..."
						bind:value={obatSearchQuery}
						oninput={(e) => searchObatForDetail((e.target as HTMLInputElement).value)}
						class="text-xs"
					/>
					{#if obatSearchResults.length > 0}
						<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-40 overflow-y-auto z-30 text-xs">
							{#each obatSearchResults as o}
								<button
									type="button"
									onclick={() => selectObatForDetail(o)}
									class="w-full text-left p-2 hover:bg-teal-50 flex justify-between cursor-pointer"
								>
									<span>{o.obat_nama}</span>
									<span class="text-slate-400">{o.obat_id}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-3 gap-2 items-center">
					<Input type="number" min="1" placeholder="Qty Asli" bind:value={inputQtyAsli} class="text-xs" />
					<Input type="number" min="0" placeholder="Harga/Obat" bind:value={inputHargaPerObat} class="text-xs" />
					<Button size="sm" class="h-9 text-xs" onclick={addItemLine}>+ Tambah</Button>
				</div>
			</div>

			{#if itemLines.length > 0}
				<div class="space-y-1 pt-1">
					{#each itemLines as line, idx}
						<div class="flex items-center justify-between p-1.5 rounded bg-white border border-slate-200 text-xs">
							<span>{line.obat_nama} ({line.qty_asli}x @ Rp{formatRp(line.harga_per_obat)})</span>
							<Button variant="ghost" size="icon" class="h-6 w-6 text-red-500" onclick={() => removeItemLine(idx)}>
								<Trash2 class="w-3 h-3" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Racikan Input Box -->
		<div class="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-3">
			<h4 class="text-xs font-bold text-purple-900 flex items-center gap-1">
				<FlaskConical class="w-3.5 h-3.5 text-purple-600" /> Tambah Obat Racikan
			</h4>

			<div class="space-y-2">
				<div class="relative">
					<Input
						type="text"
						placeholder="Cari obat racikan..."
						bind:value={racikanSearchQuery}
						oninput={(e) => searchObatForRacikan((e.target as HTMLInputElement).value)}
						class="text-xs"
					/>
					{#if racikanSearchResults.length > 0}
						<div class="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-40 overflow-y-auto z-30 text-xs">
							{#each racikanSearchResults as o}
								<button
									type="button"
									onclick={() => selectObatForRacikan(o)}
									class="w-full text-left p-2 hover:bg-purple-50 flex justify-between cursor-pointer"
								>
									<span>{o.obat_nama}</span>
									<span class="text-slate-400">{o.obat_id}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-2 items-center">
					<Input type="number" min="1" placeholder="Qty Racik" bind:value={inputQtyRacikan} class="text-xs" />
					<Button size="sm" variant="secondary" class="h-9 text-xs" onclick={addRacikanLine}>+ Tambah Racik</Button>
				</div>
			</div>

			{#if racikanLines.length > 0}
				<div class="space-y-1 pt-1">
					{#each racikanLines as line, idx}
						<div class="flex items-center justify-between p-1.5 rounded bg-white border border-purple-200 text-xs">
							<span>{line.obat_nama} (Qty: {line.qty_racikan})</span>
							<Button variant="ghost" size="icon" class="h-6 w-6 text-red-500" onclick={() => removeRacikanLine(idx)}>
								<Trash2 class="w-3 h-3" />
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#snippet footer()}
		<Button variant="outline" size="sm" onclick={() => (showAddSheet = false)}>Batal</Button>
		<Button size="sm" onclick={simpanResep} disabled={saving}>
			{#if saving}Menyimpan...{:else}<Save class="w-3.5 h-3.5 mr-1" /> Simpan Resep{/if}
		</Button>
	{/snippet}
</Sheet>
