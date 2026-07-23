<script lang="ts">
	import { Select } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { ChevronDown, Check } from 'lucide-svelte';

	type SelectOption = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	type $$Props = {
		value?: string;
		onValueChange?: (value: string) => void;
		placeholder?: string;
		options: SelectOption[];
		class?: string;
		id?: string;
		disabled?: boolean;
	};

	let {
		value = $bindable(''),
		onValueChange,
		placeholder = 'Select...',
		options = [],
		class: className = '',
		id,
		disabled = false
	}: $$Props = $props();

	function handleValueChange(newValue: string) {
		value = newValue;
		onValueChange?.(newValue);
	}

	let selectedLabel = $derived.by(() => {
		const valStr = String(value ?? '');
		const found = (options || []).find((o) => String(o.value) === valStr);
		return found ? found.label : valStr;
	});
</script>

<Select.Root type="single" bind:value onValueChange={handleValueChange} {disabled}>
	<Select.Trigger
		{id}
		class={cn(
			'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm ring-offset-white transition-colors',
			'placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50',
			'[&>span]:line-clamp-1',
			className
		)}
	>
		{#snippet children()}
			<Select.Value {placeholder} class="text-slate-700">
				{selectedLabel || placeholder}
			</Select.Value>
			<ChevronDown class="ml-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
		{/snippet}
	</Select.Trigger>

	<Select.Portal>
		<Select.Content
			class={cn(
				'relative z-50 max-h-[240px] min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white text-slate-900 shadow-lg',
				'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
				'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
			)}
			sideOffset={4}
		>
			<Select.Viewport class="p-1">
				{#each options as option}
					<Select.Item
						value={String(option.value)}
						label={option.label}
						disabled={option.disabled}
						class={cn(
							'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none',
							'data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900',
							'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
						)}
					>
						{#snippet children({ selected })}
							{#if selected}
								<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
									<Check class="h-3.5 w-3.5 text-teal-600" />
								</span>
							{/if}
							{option.label}
						{/snippet}
					</Select.Item>
				{/each}
			</Select.Viewport>
		</Select.Content>
	</Select.Portal>
</Select.Root>
