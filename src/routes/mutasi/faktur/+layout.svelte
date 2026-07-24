<script lang="ts">
	import { page } from '$app/state';
	import { FileSpreadsheet, History } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import { PageHeader } from '$lib/components/ui/page-header';

	let { children } = $props();

	function isHistoryTab(): boolean {
		return page.url.pathname.startsWith('/mutasi/faktur/history');
	}
</script>

<div class="space-y-6">
	<!-- Page Header for Faktur Section -->
	<PageHeader
		title="Faktur Pembelian"
		description="Kelola pencatatan penerimaan obat dari PBF dan riwayat faktur masuk"
	>
		{#snippet actions()}
			<!-- Tab Navigation Buttons -->
			<div class="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
				<a
					href="/mutasi/faktur"
					class={cn(
						"flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer",
						!isHistoryTab()
							? "bg-white text-mint-700 shadow-2xs"
							: "text-slate-500 hover:text-slate-900"
					)}
				>
					<FileSpreadsheet class="w-3.5 h-3.5" />
					<span>Input Faktur</span>
				</a>
				<a
					href="/mutasi/faktur/history"
					class={cn(
						"flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer",
						isHistoryTab()
							? "bg-white text-mint-700 shadow-2xs"
							: "text-slate-500 hover:text-slate-900"
					)}
				>
					<History class="w-3.5 h-3.5" />
					<span>Riwayat Faktur</span>
				</a>
			</div>
		{/snippet}
	</PageHeader>

	{@render children()}
</div>
