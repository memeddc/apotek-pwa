<script lang="ts">
	import { RadioGroup, Label } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { Circle } from 'lucide-svelte';

	type RadioOption = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	type $$Props = {
		value?: string;
		onValueChange?: (value: string) => void;
		options: RadioOption[];
		orientation?: 'horizontal' | 'vertical';
		class?: string;
		name?: string;
		disabled?: boolean;
	};

	let {
		value = $bindable(''),
		onValueChange,
		options,
		orientation = 'horizontal',
		class: className = '',
		name,
		disabled = false
	}: $$Props = $props();

	function handleValueChange(newValue: string) {
		value = newValue;
		onValueChange?.(newValue);
	}
</script>

<RadioGroup.Root
	bind:value
	onValueChange={handleValueChange}
	{orientation}
	{name}
	{disabled}
	class={cn(
		'flex gap-3',
		orientation === 'vertical' ? 'flex-col' : 'flex-row items-center',
		className
	)}
>
	{#each options as option}
		{@const itemId = `radio-${name ?? 'group'}-${option.value}`}
		<div class="flex items-center gap-2">
			<RadioGroup.Item
				id={itemId}
				value={option.value}
				disabled={option.disabled}
				class={cn(
					'aspect-square h-4 w-4 rounded-full border border-slate-300 shadow-sm transition-colors',
					'focus:outline-none focus-visible:ring-1 focus-visible:ring-teal-500',
					'disabled:cursor-not-allowed disabled:opacity-50',
					'data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600',
					'cursor-pointer'
				)}
			>
				{#snippet children({ checked })}
					{#if checked}
						<span class="flex h-full w-full items-center justify-center">
							<Circle class="h-2 w-2 fill-white text-white" />
						</span>
					{/if}
				{/snippet}
			</RadioGroup.Item>
			<Label.Root
				for={itemId}
				class={cn(
					'text-xs font-medium leading-none cursor-pointer select-none',
					'text-slate-700 peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
				)}
			>
				{option.label}
			</Label.Root>
		</div>
	{/each}
</RadioGroup.Root>
