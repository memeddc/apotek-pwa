<script lang="ts">
	import { page } from '$app/state';
	import { FileSpreadsheet, History } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let { children } = $props();

	function isHistoryTab(): boolean {
		return page.url.pathname.startsWith('/mutasi/faktur/history');
	}
</script>

<div class="space-y-6">
	<!-- Top Header / Title for Faktur Section -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
		<div>
			<h1 class="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
				<FileSpreadsheet class="w-6 h-6 text-teal-600" />
				Faktur Pembelian
			</h1>
			<p class="text-xs text-slate-500 mt-0.5">Kelola pencatatan dan riwayat faktur masuk dari PBF/Supplier</p>
		</div>

		<!-- Tab Navigation Buttons -->
		<div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 self-start sm:self-auto">
			<a
				href="/mutasi/faktur"
				class={cn(
					"flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
					!isHistoryTab()
						? "bg-white text-teal-700 shadow-xs"
						: "text-slate-600 hover:text-slate-900"
				)}
			>
				<FileSpreadsheet class="w-3.5 h-3.5" />
				<span>Input Faktur</span>
			</a>
			<a
				href="/mutasi/faktur/history"
				class={cn(
					"flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
					isHistoryTab()
						? "bg-white text-teal-700 shadow-xs"
						: "text-slate-600 hover:text-slate-900"
				)}
			>
				<History class="w-3.5 h-3.5" />
				<span>Riwayat Faktur</span>
			</a>
		</div>
	</div>

	{@render children()}
</div>
