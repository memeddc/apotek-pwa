<script lang="ts">
	import { cn } from '$lib/utils';
	import { X } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';

	let {
		open = $bindable(false),
		title = '',
		description = '',
		side = 'right',
		children,
		footer
	}: {
		open: boolean;
		title?: string;
		description?: string;
		side?: 'right' | 'left' | 'bottom';
		children?: any;
		footer?: any;
	} = $props();

	function close() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop with smooth fade in/out -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		transition:fade={{ duration: 200 }}
		class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs"
		onclick={close}
	></div>

	<!-- Sheet Panel with smooth slide/fly in/out -->
	<div
		transition:fly={{
			x: side === 'right' ? 320 : side === 'left' ? -320 : 0,
			y: side === 'bottom' ? 320 : 0,
			duration: 250
		}}
		class={cn(
			"fixed z-50 bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto",
			side === 'right' && "inset-y-0 right-0 h-full w-full max-w-md border-l border-slate-200",
			side === 'left' && "inset-y-0 left-0 h-full w-full max-w-md border-r border-slate-200",
			side === 'bottom' && "inset-x-0 bottom-0 max-h-[85vh] w-full rounded-t-2xl border-t border-slate-200"
		)}
	>
		<div>
			<div class="flex items-center justify-between pb-4 border-b border-slate-100">
				<div>
					{#if title}
						<h2 class="text-lg font-semibold text-slate-900">{title}</h2>
					{/if}
					{#if description}
						<p class="text-xs text-slate-500 mt-0.5">{description}</p>
					{/if}
				</div>
				<button
					onclick={close}
					class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
					aria-label="Tutup"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<div class="py-4 space-y-4">
				{@render children?.()}
			</div>
		</div>

		{#if footer}
			<div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
				{@render footer()}
			</div>
		{/if}
	</div>
{/if}
