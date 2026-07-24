<script lang="ts">
	import { cn } from '$lib/utils';
	import { Skeleton } from '$lib/components/ui/skeleton';

	let {
		title,
		value,
		subtext = '',
		trend = '',
		trendType = 'neutral', // 'up' | 'down' | 'neutral'
		icon: Icon = null,
		iconColor = 'bg-mint-50 text-mint-600 border-mint-100',
		loading = false,
		class: className = ''
	}: {
		title: string;
		value?: string | number;
		subtext?: string;
		trend?: string;
		trendType?: 'up' | 'down' | 'neutral';
		icon?: any;
		iconColor?: string;
		loading?: boolean;
		class?: string;
	} = $props();
</script>

<div
	class={cn(
		"p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md hover:border-mint-200 transition-all duration-200 flex flex-col justify-between relative overflow-hidden",
		className
	)}
>
	<div class="flex items-start justify-between gap-3">
		<div class="space-y-1">
			<p class="text-xs font-semibold text-slate-500">{title}</p>
			{#if loading}
				<Skeleton class="h-8 w-24 rounded-lg my-1" />
			{:else}
				<h3 class="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
					{value ?? '0'}
				</h3>
			{/if}
		</div>

		{#if Icon}
			<div
				class={cn(
					"w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 hover:scale-105",
					iconColor
				)}
			>
				<Icon class="w-6 h-6" />
			</div>
		{/if}
	</div>

	{#if subtext || trend}
		<div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs font-medium">
			{#if trend}
				<span
					class={cn(
						"px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1",
						trendType === 'up' && "bg-emerald-50 text-emerald-700 border border-emerald-200",
						trendType === 'down' && "bg-rose-50 text-rose-700 border border-rose-200",
						trendType === 'neutral' && "bg-slate-100 text-slate-600 border border-slate-200"
					)}
				>
					{#if trendType === 'up'}↑{/if}
					{#if trendType === 'down'}↓{/if}
					{trend}
				</span>
			{/if}

			{#if subtext}
				<span class="text-slate-500">{subtext}</span>
			{/if}
		</div>
	{/if}
</div>
