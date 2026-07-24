<script lang="ts">
	import { Calendar as CalendarIcon } from 'lucide-svelte';

	let {
		value = $bindable(''),
		placeholder = 'Pilih tanggal...',
		disabled = false,
		id = '',
		onchange,
		class: className = ''
	}: {
		value: string;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
		onchange?: (val: string) => void;
		class?: string;
	} = $props();

	function formatDateIndo(dateStr: string): string {
		if (!dateStr) return placeholder;
		try {
			const parts = dateStr.split('T')[0].split('-');
			if (parts.length < 3) return dateStr;
			const y = parts[0];
			const m = parts[1];
			const d = parts[2];
			const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
			const monthIdx = parseInt(m, 10) - 1;
			if (monthIdx < 0 || monthIdx > 11) return dateStr;
			return `${parseInt(d, 10)} ${months[monthIdx]} ${y}`;
		} catch {
			return dateStr;
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;
		onchange?.(value);
	}
</script>

<div class={`relative flex items-center rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-mint-400 focus-within:border-mint-500 transition-colors cursor-pointer h-9 px-3 ${className}`}>
	<CalendarIcon class="w-4 h-4 text-mint-600 mr-2 shrink-0 pointer-events-none" />

	<span class="text-xs font-semibold text-slate-800 flex-1 truncate pointer-events-none">
		{#if value}
			{formatDateIndo(value)}
		{:else}
			<span class="text-slate-400 font-normal">{placeholder}</span>
		{/if}
	</span>

	<!-- Stretched overlay native date input for 1-click calendar picker trigger -->
	<input
		{id}
		type="date"
		bind:value={value}
		{disabled}
		oninput={handleInput}
		onclick={(e) => e.currentTarget.showPicker?.()}
		class="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs z-10"
	/>
</div>
