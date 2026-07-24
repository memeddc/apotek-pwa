<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Minus, Plus } from 'lucide-svelte';

	let {
		value = $bindable(1),
		min = 1,
		max = 999999,
		step = 1,
		disabled = false,
		onChange,
		class: className = ''
	}: {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		onChange?: (val: number) => void;
		class?: string;
	} = $props();

	function decrement() {
		if (disabled || value <= min) return;
		value = Math.max(min, value - step);
		onChange?.(value);
	}

	function increment() {
		if (disabled || value >= max) return;
		value = Math.min(max, value + step);
		onChange?.(value);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		let num = parseInt(target.value, 10);
		if (isNaN(num)) num = min;
		num = Math.max(min, Math.min(max, num));
		value = num;
		onChange?.(value);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			increment();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			decrement();
		}
	}
</script>

<div class={`inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden h-9 ${className}`}>
	<Button
		type="button"
		variant="ghost"
		size="icon"
		class="h-full w-8 shrink-0 rounded-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-r border-slate-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
		disabled={disabled || value <= min}
		onclick={decrement}
		tabindex={-1}
	>
		<Minus class="w-3.5 h-3.5" />
	</Button>

	<input
		type="number"
		bind:value={value}
		{min}
		{max}
		{step}
		{disabled}
		oninput={handleInput}
		onkeydown={handleKeyDown}
		onfocus={(e) => e.currentTarget.select()}
		class="flex-1 w-full min-w-0 text-center font-bold text-slate-900 text-xs bg-transparent focus:outline-none focus:bg-mint-50/50 transition-colors h-full px-1"
	/>

	<Button
		type="button"
		variant="ghost"
		size="icon"
		class="h-full w-8 shrink-0 rounded-none text-slate-500 hover:bg-slate-100 hover:text-slate-900 border-l border-slate-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
		disabled={disabled || value >= max}
		onclick={increment}
		tabindex={-1}
	>
		<Plus class="w-3.5 h-3.5" />
	</Button>
</div>
