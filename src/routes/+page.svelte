<script lang="ts">
	import { onMount } from 'svelte';
	import { localDB } from '$lib/db/db';
	import { supabase } from '$lib/supabase';
	import type { IMasterObat } from '$lib/db/types';

	let statusOnline = $state(true);
	let daftarObat = $state<IMasterObat[]>([]);
	let statusSync = $state('');
	
	// Variabel input disesuaikan dengan struktur baru
	let inputId = $state('');
	let inputNama = $state('');
	let inputJenis = $state('30'); // Default jenis obat untuk tes

	async function muatDataLokal() {
		daftarObat = await localDB.masterobat.toArray();
	}

	async function tambahObatLokal() {
		if (!inputId || !inputNama) return;
		
		// Insert menggunakan struktur kolom yang baru
		await localDB.masterobat.put({
			obat_id: inputId,
			obat_nama: inputNama,
			jenis_id: inputJenis
		});

		inputId = '';
		inputNama = '';
		await muatDataLokal();
	}

	async function sinkronisasiKeCloud() {
		if (!statusOnline) {
			statusSync = 'Gagal: Komputer sedang offline!';
			return;
		}

		statusSync = 'Sedang menyinkronkan...';
		
		try {
			const dataLokal = await localDB.masterobat.toArray();
			
			if (dataLokal.length === 0) {
				statusSync = 'Tidak ada data lokal untuk disinkronkan.';
				return;
			}

			const { error } = await supabase
				.from('masterobat')
				.upsert(dataLokal);

			if (error) throw error;

			statusSync = '✅ Sinkronisasi sukses! Data aman di Cloud.';
		} catch (err: any) {
			statusSync = `❌ Error: ${err.message}`;
		}
	}

	onMount(() => {
		statusOnline = navigator.onLine;
		muatDataLokal();

		const goOnline = () => statusOnline = true;
		const goOffline = () => statusOnline = false;

		window.addEventListener('online', goOnline);
		window.addEventListener('offline', goOffline);

		return () => {
			window.removeEventListener('online', goOnline);
			window.removeEventListener('offline', goOffline);
		};
	});
</script>

<main style="padding: 2rem; font-family: sans-serif; max-width: 600px; margin: 0 auto;">
	<h1>Sistem Kasir Apotek 💊</h1>
	
	<div style="padding: 1rem; border-radius: 8px; color: white; margin-bottom: 1.5rem; background-color: {statusOnline ? '#10B981' : '#EF4444'}">
		Status Koneksi: <strong>{statusOnline ? 'ONLINE (Cloud Ready)' : 'OFFLINE (Mode Lokal Aktif)'}</strong>
	</div>

	<section style="background: #f3f4f6; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
		<h3>Test Input Obat Lokal (Offline-First)</h3>
		<div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
			<input type="text" placeholder="ID Obat (e.g., OB01)" bind:value={inputId} style="padding: 0.5rem; flex: 1;" />
			<input type="text" placeholder="Nama Obat (e.g., Paracetamol)" bind:value={inputNama} style="padding: 0.5rem; flex: 2;" />
		</div>
		<button on:click={tambahObatLokal} style="padding: 0.5rem 1rem; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">
			Simpan di PC Kasir
		</button>
	</section>

	<section style="margin-bottom: 2rem;">
		<button on:click={sinkronisasiKeCloud} disabled={!statusOnline} style="padding: 0.75rem 1.5rem; width: 100%; background: #7c3aed; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; opacity: {statusOnline ? 1 : 0.5};">
			🔄 Sinkronisasikan Data Lokal ke Cloud Supabase
		</button>
		{#if statusSync}
			<p style="margin-top: 0.5rem; font-size: 0.9rem; color: #374151;">{statusSync}</p>
		{/if}
	</section>

	<section>
		<h3>Daftar Obat Terindeks di Browser:</h3>
		{#if daftarObat.length === 0}
			<p style="color: #6b7280;">Belum ada data obat.</p>
		{:else}
			<ul style="padding-left: 1.2rem;">
				{#each daftarObat as obat}
					<li><strong>{obat.obat_id}</strong> - {obat.obat_nama}</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>