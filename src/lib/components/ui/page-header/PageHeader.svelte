<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		title,
		description = '',
		badge = '',
		actions,
		class: className = ''
	}: {
		title: string;
		description?: string;
		badge?: string;
		actions?: any;
		class?: string;
	} = $props();
</script>

<div class={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200/80", className)}>
	<div class="space-y-1">
		<div class="flex items-center gap-2.5">
			<h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
			{#if badge}
				<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mint-100 text-mint-800 border border-mint-200">
					{badge}
				</span>
			{/if}
		</div>
		{#if description}
			<p class="text-sm text-slate-500 max-w-2xl leading-relaxed">{description}</p>
		{/if}
	</div>

	{#if actions}
		<div class="flex items-center gap-2 shrink-0">
			{@render actions()}
		</div>
	{/if}
</div>
