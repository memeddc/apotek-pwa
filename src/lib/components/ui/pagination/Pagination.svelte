<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Select } from '$lib/components/ui/select';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	let {
		currentPage = 1,
		totalItems = 0,
		pageSize = 25,
		onPageChange,
		onPageSizeChange,
		pageSizeOptions = [25, 50, 100],
		class: className = ''
	}: {
		currentPage: number;
		totalItems: number;
		pageSize: number;
		onPageChange: (page: number) => void;
		onPageSizeChange?: (size: number) => void;
		pageSizeOptions?: number[];
		class?: string;
	} = $props();

	let totalPages = $derived(Math.max(1, Math.ceil(totalItems / pageSize)));
	let startItem = $derived(totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	let endItem = $derived(Math.min(totalItems, currentPage * pageSize));
</script>

<div class={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 text-xs text-slate-600 ${className}`}>
	<div class="flex items-center gap-3">
		<span>
			Menampilkan <strong class="font-bold text-slate-900">{startItem}–{endItem}</strong> dari <strong class="font-bold text-slate-900">{totalItems.toLocaleString('id-ID')}</strong> data
		</span>

		{#if onPageSizeChange}
			<div class="flex items-center gap-1.5 ml-2">
				<span class="text-slate-400">Tampilkan:</span>
				<Select
					value={String(pageSize)}
					onValueChange={(val) => onPageSizeChange?.(Number(val))}
					options={pageSizeOptions.map((s) => ({ value: String(s), label: `${s} / hal` }))}
					class="w-28 h-7 text-xs rounded-lg border-slate-200 bg-white"
				/>
			</div>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<span class="text-slate-500 mr-1">
			Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
		</span>
		<div class="flex items-center gap-1">
			<Button
				variant="outline"
				size="sm"
				class="h-7 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer disabled:opacity-50"
				disabled={currentPage <= 1}
				onclick={() => onPageChange(currentPage - 1)}
			>
				<ChevronLeft class="w-3.5 h-3.5 mr-0.5" /> Sblm
			</Button>
			<Button
				variant="outline"
				size="sm"
				class="h-7 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer disabled:opacity-50"
				disabled={currentPage >= totalPages}
				onclick={() => onPageChange(currentPage + 1)}
			>
				Brkt <ChevronRight class="w-3.5 h-3.5 ml-0.5" />
			</Button>
		</div>
	</div>
</div>
