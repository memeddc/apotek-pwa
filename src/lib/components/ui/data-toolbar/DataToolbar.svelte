<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Search } from 'lucide-svelte';

	let {
		searchPlaceholder = 'Cari...',
		searchValue = $bindable(''),
		onSearchInput,
		totalItems = 0,
		filteredCount = 0,
		itemLabel = 'data',
		filters,
		actions,
		class: className = ''
	}: {
		searchPlaceholder?: string;
		searchValue?: string;
		onSearchInput?: () => void;
		totalItems?: number;
		filteredCount?: number;
		itemLabel?: string;
		filters?: any;
		actions?: any;
		class?: string;
	} = $props();
</script>

<div class={`p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3 ${className}`}>
	<div class="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
		<!-- Search Input -->
		<div class="relative flex-1 min-w-[220px] max-w-sm">
			<Search class="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
			<Input
				type="search"
				placeholder={searchPlaceholder}
				bind:value={searchValue}
				oninput={() => onSearchInput?.()}
				class="pl-9 h-9 text-xs rounded-xl border-slate-200 focus:border-mint-500 bg-slate-50/50"
			/>
		</div>

		<!-- Optional Filters Snippet -->
		{#if filters}
			<div class="flex items-center gap-2">
				{@render filters()}
			</div>
		{/if}
	</div>

	<!-- Info & Optional Actions -->
	<div class="flex items-center gap-3 ml-auto text-xs text-slate-500">
		<span class="font-medium">
			Menampilkan <strong class="text-slate-900 font-bold">{filteredCount}</strong> {#if totalItems > 0 && totalItems !== filteredCount}dari {totalItems}{/if} {itemLabel}
		</span>

		{#if actions}
			<div class="flex items-center gap-2 pl-2 border-l border-slate-200">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>
