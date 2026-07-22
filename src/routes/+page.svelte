<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';

	let counts = $state({ jenisobat: 0, obat: 0, pbf: 0, purchase: 0, resep: 0 });
	let loading = $state(true);

	async function loadCounts() {
		loading = true;
		try {
			const [jenisRes, obatRes, pbfRes, purchaseRes, resepRes] = await Promise.all([
				supabase.from('jenisobat').select('*', { count: 'exact', head: true }),
				supabase.from('obat').select('*', { count: 'exact', head: true }),
				supabase.from('pbf').select('*', { count: 'exact', head: true }),
				supabase.from('purchase').select('*', { count: 'exact', head: true }),
				supabase.from('resep').select('*', { count: 'exact', head: true })
			]);
			counts = {
				jenisobat: jenisRes.count ?? 0,
				obat: obatRes.count ?? 0,
				pbf: pbfRes.count ?? 0,
				purchase: purchaseRes.count ?? 0,
				resep: resepRes.count ?? 0
			};
		} catch (e) {
			console.error('Error loading counts:', e);
		}
		loading = false;
	}

	onMount(loadCounts);
</script>

<div class="page-header">
	<h1>Dashboard</h1>
	<p>Selamat datang di Sistem Manajemen Apotek</p>
</div>

<div class="dashboard-grid">
	<a href="/resep" class="dash-card">
		<div class="dash-card-icon" style="background: #e0f2fe; color: #0284c7;">📋</div>
		<div>
			<h3>Resep Dokter</h3>
			<p>Pencarian resep nama pasien dan pembuatan resep baru</p>
		</div>
		<div class="card-count">
			{#if loading}
				<span style="font-size: 0.9rem; color: var(--color-text-muted);">Memuat...</span>
			{:else}
				{counts.resep}
			{/if}
		</div>
	</a>

	<a href="/jenisobat" class="dash-card">
		<div class="dash-card-icon" style="background: #ccfbf1; color: #0f766e;">🏷️</div>
		<div>
			<h3>Jenis Obat</h3>
			<p>Kelola kategori dan jenis obat yang tersedia di apotek</p>
		</div>
	</a>

	<a href="/obat" class="dash-card">
		<div class="dash-card-icon" style="background: #ede9fe; color: #6d28d9;">💊</div>
		<div>
			<h3>Obat</h3>
			<p>Kelola data master obat-obatan yang dijual di apotek</p>
		</div>
		<div class="card-count">
			{#if loading}
				<span style="font-size: 0.9rem; color: var(--color-text-muted);">Memuat...</span>
			{:else}
				{counts.obat}
			{/if}
		</div>
	</a>

	<a href="/pbf" class="dash-card">
		<div class="dash-card-icon" style="background: #fef3c7; color: #b45309;">🏢</div>
		<div>
			<h3>PBF / Supplier</h3>
			<p>Kelola data Pedagang Besar Farmasi sebagai pemasok obat</p>
		</div>
		<div class="card-count">
			{#if loading}
				<span style="font-size: 0.9rem; color: var(--color-text-muted);">Memuat...</span>
			{:else}
				{counts.pbf}
			{/if}
		</div>
	</a>

	<a href="/faktur" class="dash-card">
		<div class="dash-card-icon" style="background: #dbeafe; color: #1d4ed8;">F</div>
		<div>
			<h3>Faktur</h3>
			<p>Catat penerimaan obat dari PBF dan perbarui stok</p>
		</div>
	</a>

	<a href="/stok" class="dash-card">
		<div class="dash-card-icon" style="background: #dcfce7; color: #15803d;">S</div>
		<div>
			<h3>Stok</h3>
			<p>Lihat stok obat yang tersedia saat ini</p>
		</div>
	</a>

	<a href="/kartu_stok" class="dash-card">
		<div class="dash-card-icon" style="background: #fef3c7; color: #b45309;">K</div>
		<div>
			<h3>Kartu Stok</h3>
			<p>Lihat riwayat masuk, keluar, dan stok opname</p>
		</div>
	</a>
</div>
