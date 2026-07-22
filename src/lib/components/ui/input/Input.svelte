<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';

	type $$Props = HTMLInputAttributes & {
		class?: string;
		value?: any;
	};

	let { class: className = '', value = $bindable(''), ...restProps }: $$Props = $props();
</script>

<input
	bind:value
	class={cn(
		"flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:opacity-50",
		className
	)}
	{...restProps}
/>
