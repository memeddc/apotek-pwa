<script lang="ts">
	let {
		value = $bindable(0),
		placeholder = '0',
		disabled = false,
		id = '',
		oninput,
		class: className = ''
	}: {
		value: number;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
		oninput?: () => void;
		class?: string;
	} = $props();

	function formatDisplay(num: number): string {
		if (!num || isNaN(num) || num <= 0) return '';
		return new Intl.NumberFormat('id-ID').format(Math.round(num));
	}

	let displayValue = $state(formatDisplay(value));

	$effect(() => {
		displayValue = formatDisplay(value);
	});

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const raw = input.value.replace(/[^0-9]/g, '');
		const parsed = parseInt(raw, 10);
		value = isNaN(parsed) ? 0 : parsed;
		displayValue = value > 0 ? new Intl.NumberFormat('id-ID').format(value) : '';
		oninput?.();
	}
</script>

<div class={`relative flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-mint-500 focus-within:ring-1 focus-within:ring-mint-500 ${className}`}>
	<span class="pl-3 text-xs font-bold text-slate-400 select-none pointer-events-none">Rp</span>
	<input
		{id}
		type="text"
		inputmode="numeric"
		value={displayValue}
		{placeholder}
		{disabled}
		oninput={handleInput}
		onfocus={(e) => e.currentTarget.select()}
		class="w-full h-full pl-1 pr-3 text-xs font-mono font-bold text-slate-900 bg-transparent outline-none disabled:bg-slate-50"
	/>
</div>
