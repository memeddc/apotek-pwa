<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { Iresep, Idetail_resep, Idetail_racikan, IResepItemInput, IResepRacikanInput, Iobat } from '$lib/db/types';

	type ResepWithDetail = Iresep & {
		detailCount?: number;
		racikanCount?: number;
	};

	type DetailResepView = Idetail_resep & { obat_nama?: string };
	type DetailRacikanView = Idetail_racikan & { obat_nama?: string };

	let loading = $state(true);
	let toastMsg = $state('');
	let toastType = $state<'success' | 'error'>('success');
	let toastTimer: ReturnType<typeof setTimeout>;

	// List & Filter states
	let resepList = $state<ResepWithDetail[]>([]);
	let searchQuery = $state('');
	let dateFilter = $state<'all' | 'today' | '7days'>('all');

	// Detail Modal states
	let selectedResep = $state<Iresep | null>(null);
	let viewDetails = $state<DetailResepView[]>([]);
	let viewRacikan = $state<DetailRacikanView[]>([]);
	let loadingDetail = $state(false);
	let showDetailModal = $state(false);

	// Create Modal states
	let showAddModal = $state(false);
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

	function showToast(msg: string, type: 'success' | 'error' = 'success') {
		toastMsg = msg;
		toastType = type;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toastMsg = ''), 4000);
	}

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
				showToast(`Gagal memuat resep: ${error.message}`, 'error');
				resepList = [];
			} else {
				resepList = data ?? [];
			}
		} catch (e: any) {
			showToast(`Terjadi kesalahan: ${e?.message || e}`, 'error');
		} finally {
			loading = false;
		}
	}

	async function openDetailModal(resep: Iresep) {
		selectedResep = resep;
		showDetailModal = true;
		loadingDetail = true;
		viewDetails = [];
		viewRacikan = [];

		try {
			// Fetch detail_resep
			const { data: dData, error: dErr } = await supabase
				.from('detail_resep')
				.select('*')
				.eq('resep_id', resep.resep_id);

			if (dErr) console.error('Error fetching detail_resep:', dErr);

			// Fetch detail_racikan
			const { data: rData, error: rErr } = await supabase
				.from('detail_racikan')
				.select('*')
				.eq('resep_id', resep.resep_id);

			if (rErr) console.error('Error fetching detail_racikan:', rErr);

			// Get all obat IDs needed
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
			showToast(`Gagal memuat detail resep: ${e?.message || e}`, 'error');
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

	function openAddModal() {
		resetForm();
		showAddModal = true;
	}

	// Search Obat for Non-Racikan
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

		// Fetch harga_jual from stok if available
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
			showToast('Pilih obat terlebih dahulu!', 'error');
			return;
		}
		if (inputQtyResep <= 0 || inputQtyAsli <= 0) {
			showToast('Qty resep dan qty asli harus lebih besar dari 0!', 'error');
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

	// Search Obat for Racikan
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
			showToast('Pilih obat racikan terlebih dahulu!', 'error');
			return;
		}
		if (inputQtyRacikan <= 0) {
			showToast('Qty racikan harus lebih besar dari 0!', 'error');
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
			showToast('Nomor Resep tidak boleh kosong!', 'error');
			return;
		}
		if (!pasienNama) {
			showToast('Nama Pasien wajib diisi!', 'error');
			return;
		}
		if (!dokterNama) {
			showToast('Nama Dokter wajib diisi!', 'error');
			return;
		}
		if (itemLines.length === 0 && racikanLines.length === 0) {
			showToast('Tambahkan minimal 1 item obat (non-racikan atau racikan) ke dalam resep!', 'error');
			return;
		}

		saving = true;
		try {
			// Check resep_id duplicate
			const { data: existing } = await supabase
				.from('resep')
				.select('resep_id')
				.eq('resep_id', resepId)
				.maybeSingle();

			if (existing) {
				showToast(`Nomor Resep '${resepId}' sudah terdaftar. Silakan gunakan Nomor Resep lain!`, 'error');
				saving = false;
				return;
			}

			// 1. Insert header resep
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

			// 2. Insert detail_resep if any
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

			// 3. Insert detail_racikan if any
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

			showToast(`Resep '${resepId}' untuk pasien '${pasienNama}' berhasil disimpan!`, 'success');
			showAddModal = false;
			await loadResepList();
		} catch (e: any) {
			showToast(e?.message || 'Terjadi kesalahan saat menyimpan resep.', 'error');
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

<div class="page-header">
	<div>
		<h1>📋 Resep Dokter</h1>
		<p>Pencarian resep berdasarkan nama pasien dan kelola resep baru</p>
	</div>
	<div>
		<button class="btn btn-primary" onclick={openAddModal}>
			➕ Tambah Resep Baru
		</button>
	</div>
</div>

{#if toastMsg}
	<div class="toast toast-{toastType}">
		<span>{toastMsg}</span>
		<button onclick={() => (toastMsg = '')}>✕</button>
	</div>
{/if}

<!-- Filter & Search Bar -->
<div class="card" style="margin-bottom: 1.5rem;">
	<div class="filter-row">
		<div class="search-box">
			<span class="search-icon">🔍</span>
			<input
				type="text"
				placeholder="Cari berdasarkan nama pasien, nama dokter, atau no. resep..."
				bind:value={searchQuery}
				oninput={handleSearchInput}
			/>
			{#if searchQuery}
				<button class="clear-btn" onclick={() => { searchQuery = ''; loadResepList(); }}>✕</button>
			{/if}
		</div>

		<div class="filter-group">
			<label for="date-filter-select">Tanggal:</label>
			<select id="date-filter-select" bind:value={dateFilter} onchange={loadResepList}>
				<option value="all">Semua Tanggal</option>
				<option value="today">Hari Ini</option>
				<option value="7days">7 Hari Terakhir</option>
			</select>
		</div>

		<button class="btn btn-secondary" onclick={loadResepList} disabled={loading}>
			🔄 Refresh
		</button>
	</div>
</div>

<!-- Table Resep List -->
<div class="card">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Memuat data resep...</p>
		</div>
	{:else if resepList.length === 0}
		<div class="empty-state">
			<span style="font-size: 3rem;">📝</span>
			<h3>Tidak ada data resep</h3>
			<p>
				{#if searchQuery}
					Pencarian untuk "{searchQuery}" tidak ditemukan.
				{:else}
					Belum ada data resep tersimpan di sistem.
				{/if}
			</p>
			<button class="btn btn-primary" style="margin-top: 1rem;" onclick={openAddModal}>
				➕ Tambah Resep Baru
			</button>
		</div>
	{:else}
		<div class="table-responsive">
			<table class="table">
				<thead>
					<tr>
						<th>No. Resep</th>
						<th>Tanggal Resep</th>
						<th>Nama Pasien</th>
						<th>Nama Dokter</th>
						<th>Alamat Pasien</th>
						<th>Keterangan</th>
						<th style="text-align: center;">Aksi</th>
					</tr>
				</thead>
				<tbody>
					{#each resepList as item}
						<tr>
							<td>
								<span class="badge badge-primary">{item.resep_id}</span>
							</td>
							<td>{formatDateIndo(item.tanggal_resep)}</td>
							<td>
								<strong>{item.pasien_nama}</strong>
							</td>
							<td>{item.dokter_nama}</td>
							<td>{item.alamat_pasien || '-'}</td>
							<td>{item.ket_resep || '-'}</td>
							<td style="text-align: center;">
								<button class="btn btn-sm btn-info" onclick={() => openDetailModal(item)}>
									👁️ Detail
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Modal Detail Resep -->
{#if showDetailModal && selectedResep}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => (showDetailModal = false)}>
		<div class="modal-content modal-lg" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>📋 Detail Resep: {selectedResep.resep_id}</h2>
				<button class="modal-close" onclick={() => (showDetailModal = false)}>✕</button>
			</div>

			<div class="modal-body">
				<div class="info-grid">
					<div class="info-item">
						<span class="info-label">No. Resep</span>
						<span class="info-val font-mono">{selectedResep.resep_id}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Tanggal Resep</span>
						<span class="info-val">{formatDateIndo(selectedResep.tanggal_resep)}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Nama Pasien</span>
						<span class="info-val strong">{selectedResep.pasien_nama}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Nama Dokter</span>
						<span class="info-val">{selectedResep.dokter_nama}</span>
					</div>
					<div class="info-item full-width">
						<span class="info-label">Alamat Pasien</span>
						<span class="info-val">{selectedResep.alamat_pasien || '-'}</span>
					</div>
					{#if selectedResep.ket_resep}
						<div class="info-item full-width">
							<span class="info-label">Keterangan Resep</span>
							<span class="info-val">{selectedResep.ket_resep}</span>
						</div>
					{/if}
				</div>

				<hr class="divider" />

				{#if loadingDetail}
					<div class="loading-state">
						<div class="spinner"></div>
						<p>Memuat rincian obat resep...</p>
					</div>
				{:else}
					<!-- Section Obat Non-Racikan -->
					<h3 class="section-title">💊 Detail Obat (Non-Racikan)</h3>
					{#if viewDetails.length === 0}
						<p class="text-muted">Tidak ada obat non-racikan dalam resep ini.</p>
					{:else}
						<div class="table-responsive" style="margin-bottom: 1.5rem;">
							<table class="table table-striped">
								<thead>
									<tr>
										<th>No</th>
										<th>ID Obat</th>
										<th>Nama Obat</th>
										<th style="text-align: right;">Qty Resep</th>
										<th style="text-align: right;">Qty Asli</th>
										<th style="text-align: right;">Harga / Obat</th>
										<th style="text-align: right;">Subtotal</th>
									</tr>
								</thead>
								<tbody>
									{#each viewDetails as det, idx}
										<tr>
											<td>{idx + 1}</td>
											<td class="font-mono">{det.obat_id}</td>
											<td><strong>{det.obat_nama}</strong></td>
											<td style="text-align: right;">{det.qty_resep}</td>
											<td style="text-align: right;">{det.qty_asli}</td>
											<td style="text-align: right;">Rp {formatRp(det.harga_per_obat)}</td>
											<td style="text-align: right;">Rp {formatRp(det.qty_asli * det.harga_per_obat)}</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr>
										<td colspan="6" style="text-align: right; font-weight: bold;">Total Biaya Obat (Est.):</td>
										<td style="text-align: right; font-weight: bold; color: var(--color-primary, #0284c7);">
											Rp {formatRp(viewDetails.reduce((sum, d) => sum + (d.qty_asli * d.harga_per_obat), 0))}
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					{/if}

					<!-- Section Obat Racikan -->
					<h3 class="section-title">🧪 Detail Obat Racikan</h3>
					{#if viewRacikan.length === 0}
						<p class="text-muted">Tidak ada obat racikan dalam resep ini.</p>
					{:else}
						<div class="table-responsive">
							<table class="table table-striped">
								<thead>
									<tr>
										<th>No</th>
										<th>ID Obat</th>
										<th>Nama Obat</th>
										<th style="text-align: right;">Qty Racikan</th>
									</tr>
								</thead>
								<tbody>
									{#each viewRacikan as rac, idx}
										<tr>
											<td>{idx + 1}</td>
											<td class="font-mono">{rac.obat_id}</td>
											<td><strong>{rac.obat_nama}</strong></td>
											<td style="text-align: right;">{rac.qty_racikan}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn btn-secondary" onclick={() => (showDetailModal = false)}>
					Tutup
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal Form Tambah Resep Baru -->
{#if showAddModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={() => (showAddModal = false)}>
		<div class="modal-content modal-xl" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>➕ Form Tambah Resep Baru</h2>
				<button class="modal-close" onclick={() => (showAddModal = false)}>✕</button>
			</div>

			<div class="modal-body">
				<!-- Header Inputs -->
				<div class="form-grid">
					<div class="form-group">
						<label for="resep-id-input">No. Resep <span class="required">*</span></label>
						<input id="resep-id-input" type="text" bind:value={inputResepId} placeholder="e.g. RSP-20260722-001" />
					</div>

					<div class="form-group">
						<label for="resep-date-input">Tanggal Resep <span class="required">*</span></label>
						<input id="resep-date-input" type="date" bind:value={inputTanggalResep} />
					</div>

					<div class="form-group">
						<label for="pasien-nama-input">Nama Pasien <span class="required">*</span></label>
						<input id="pasien-nama-input" type="text" bind:value={inputPasienNama} placeholder="Nama lengkap pasien" />
					</div>

					<div class="form-group">
						<label for="dokter-nama-input">Nama Dokter <span class="required">*</span></label>
						<input id="dokter-nama-input" type="text" bind:value={inputDokterNama} placeholder="Nama dokter penanggung jawab" />
					</div>

					<div class="form-group full-width">
						<label for="alamat-pasien-input">Alamat Pasien</label>
						<input id="alamat-pasien-input" type="text" bind:value={inputAlamatPasien} placeholder="Alamat tinggal pasien" />
					</div>

					<div class="form-group full-width">
						<label for="ket-resep-input">Keterangan Resep</label>
						<input id="ket-resep-input" type="text" bind:value={inputKetResep} placeholder="Catatan/keterangan tambahan (opsional)" />
					</div>
				</div>

				<hr class="divider" />

				<!-- Section Input Non-Racikan -->
				<div class="section-box">
					<h3 class="section-title">💊 1. Input Obat Non-Racikan</h3>
					
					<div class="input-line-row">
						<div class="autocomplete-container" style="flex: 2; min-width: 250px;">
							<label for="search-obat-input">Cari Obat:</label>
							<input
								id="search-obat-input"
								type="text"
								placeholder="Ketik nama atau kode obat..."
								bind:value={obatSearchQuery}
								oninput={(e) => searchObatForDetail((e.target as HTMLInputElement).value)}
							/>
							{#if obatSearchResults.length > 0}
								<div class="autocomplete-results">
									{#each obatSearchResults as o}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="autocomplete-item" onclick={() => selectObatForDetail(o)}>
											<strong>{o.obat_nama}</strong> <span class="text-muted font-mono">({o.obat_id})</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div class="form-group" style="width: 100px;">
							<label for="input-qty-resep">Qty Resep:</label>
							<input id="input-qty-resep" type="number" min="1" bind:value={inputQtyResep} />
						</div>

						<div class="form-group" style="width: 100px;">
							<label for="input-qty-asli">Qty Asli:</label>
							<input id="input-qty-asli" type="number" min="1" bind:value={inputQtyAsli} />
						</div>

						<div class="form-group" style="width: 130px;">
							<label for="input-harga-per-obat">Harga / Obat (Rp):</label>
							<input id="input-harga-per-obat" type="number" min="0" bind:value={inputHargaPerObat} />
						</div>

						<div style="align-self: flex-end;">
							<button class="btn btn-success" onclick={addItemLine}>
								➕ Tambah
							</button>
						</div>
					</div>

					<!-- Table Added Non-Racikan -->
					{#if itemLines.length > 0}
						<div class="table-responsive" style="margin-top: 1rem;">
							<table class="table table-bordered">
								<thead>
									<tr>
										<th>No</th>
										<th>ID Obat</th>
										<th>Nama Obat</th>
										<th style="text-align: right;">Qty Resep</th>
										<th style="text-align: right;">Qty Asli</th>
										<th style="text-align: right;">Harga / Obat</th>
										<th style="text-align: right;">Subtotal</th>
										<th style="text-align: center;">Aksi</th>
									</tr>
								</thead>
								<tbody>
									{#each itemLines as line, idx}
										<tr>
											<td>{idx + 1}</td>
											<td class="font-mono">{line.obat_id}</td>
											<td><strong>{line.obat_nama}</strong></td>
											<td style="text-align: right;">{line.qty_resep}</td>
											<td style="text-align: right;">{line.qty_asli}</td>
											<td style="text-align: right;">Rp {formatRp(line.harga_per_obat)}</td>
											<td style="text-align: right;">Rp {formatRp(line.qty_asli * line.harga_per_obat)}</td>
											<td style="text-align: center;">
												<button class="btn btn-sm btn-danger" onclick={() => removeItemLine(idx)}>
													🗑️
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<hr class="divider" />

				<!-- Section Input Racikan -->
				<div class="section-box">
					<h3 class="section-title">🧪 2. Input Obat Racikan</h3>
					
					<div class="input-line-row">
						<div class="autocomplete-container" style="flex: 2; min-width: 250px;">
							<label for="search-racikan-input">Cari Obat Racikan:</label>
							<input
								id="search-racikan-input"
								type="text"
								placeholder="Ketik nama atau kode obat..."
								bind:value={racikanSearchQuery}
								oninput={(e) => searchObatForRacikan((e.target as HTMLInputElement).value)}
							/>
							{#if racikanSearchResults.length > 0}
								<div class="autocomplete-results">
									{#each racikanSearchResults as o}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="autocomplete-item" onclick={() => selectObatForRacikan(o)}>
											<strong>{o.obat_nama}</strong> <span class="text-muted font-mono">({o.obat_id})</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div class="form-group" style="width: 120px;">
							<label for="input-qty-racikan">Qty Racikan:</label>
							<input id="input-qty-racikan" type="number" min="1" bind:value={inputQtyRacikan} />
						</div>

						<div style="align-self: flex-end;">
							<button class="btn btn-warning" onclick={addRacikanLine}>
								➕ Tambah Racikan
							</button>
						</div>
					</div>

					<!-- Table Added Racikan -->
					{#if racikanLines.length > 0}
						<div class="table-responsive" style="margin-top: 1rem;">
							<table class="table table-bordered">
								<thead>
									<tr>
										<th>No</th>
										<th>ID Obat</th>
										<th>Nama Obat</th>
										<th style="text-align: right;">Qty Racikan</th>
										<th style="text-align: center;">Aksi</th>
									</tr>
								</thead>
								<tbody>
									{#each racikanLines as line, idx}
										<tr>
											<td>{idx + 1}</td>
											<td class="font-mono">{line.obat_id}</td>
											<td><strong>{line.obat_nama}</strong></td>
											<td style="text-align: right;">{line.qty_racikan}</td>
											<td style="text-align: center;">
												<button class="btn btn-sm btn-danger" onclick={() => removeRacikanLine(idx)}>
													🗑️
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-secondary" onclick={() => (showAddModal = false)} disabled={saving}>
					Batal
				</button>
				<button class="btn btn-primary" onclick={simpanResep} disabled={saving}>
					{#if saving}
						💾 Menyimpan...
					{:else}
						💾 Simpan Resep
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: center;
	}

	.search-box {
		position: relative;
		flex: 1;
		min-width: 280px;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		color: #94a3b8;
	}

	.search-box input {
		width: 100%;
		padding: 0.6rem 2.2rem 0.6rem 2.4rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font-size: 0.95rem;
	}

	.clear-btn {
		position: absolute;
		right: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #94a3b8;
		font-size: 0.9rem;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-group select {
		padding: 0.6rem 1rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font-size: 0.95rem;
		background-color: white;
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: #64748b;
	}

	.loading-state {
		text-align: center;
		padding: 2.5rem 1rem;
		color: #64748b;
	}

	.spinner {
		width: 2.5rem;
		height: 2.5rem;
		border: 3px solid #e2e8f0;
		border-top-color: #0284c7;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem auto;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		background: #f8fafc;
		padding: 1.25rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-item.full-width {
		grid-column: 1 / -1;
	}

	.info-label {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
		font-weight: 600;
	}

	.info-val {
		font-size: 1rem;
		color: #1e293b;
	}

	.font-mono {
		font-family: monospace;
	}

	.divider {
		border: none;
		border-top: 1px dashed #e2e8f0;
		margin: 1.5rem 0;
	}

	.section-title {
		font-size: 1.1rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: #1e293b;
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	.form-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #334155;
	}

	.required {
		color: #ef4444;
	}

	.form-group input {
		padding: 0.55rem 0.85rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.4rem;
		font-size: 0.95rem;
	}

	.section-box {
		background: #f8fafc;
		padding: 1.25rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	.input-line-row {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}

	.autocomplete-container {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.autocomplete-container label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #334155;
	}

	.autocomplete-container input {
		padding: 0.55rem 0.85rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.4rem;
		font-size: 0.95rem;
		width: 100%;
	}

	.autocomplete-results {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #cbd5e1;
		border-radius: 0.4rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		max-height: 200px;
		overflow-y: auto;
		z-index: 100;
	}

	.autocomplete-item {
		padding: 0.6rem 0.85rem;
		cursor: pointer;
		border-bottom: 1px solid #f1f5f9;
		font-size: 0.9rem;
	}

	.autocomplete-item:hover {
		background: #f0f9ff;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(15, 23, 42, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-lg {
		max-width: 800px;
	}

	.modal-xl {
		max-width: 1000px;
	}

	.modal-header {
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e2e8f0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		margin: 0;
		color: #0f172a;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #64748b;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid #e2e8f0;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		background: #f8fafc;
	}

	.toast {
		position: fixed;
		bottom: 1.5rem;
		right: 1.5rem;
		padding: 0.85rem 1.25rem;
		border-radius: 0.5rem;
		color: white;
		display: flex;
		align-items: center;
		gap: 1rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		z-index: 2000;
	}

	.toast-success {
		background: #10b981;
	}

	.toast-error {
		background: #ef4444;
	}

	.toast button {
		background: none;
		border: none;
		color: white;
		cursor: pointer;
		font-size: 1.1rem;
	}
</style>
