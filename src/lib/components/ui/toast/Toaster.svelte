<script lang="ts">
	import { toasts, removeToast } from './toast.svelte';
	import { CheckCircle2, AlertCircle, Info, X } from 'lucide-svelte';
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
	{#each toasts as t (t.id)}
		<div
			class="pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-xl border text-xs font-medium transition-all animate-in slide-in-from-top-2 duration-200"
			class:bg-emerald-50={t.type === 'success'}
			class:border-emerald-200={t.type === 'success'}
			class:text-emerald-900={t.type === 'success'}
			class:bg-red-50={t.type === 'error'}
			class:border-red-200={t.type === 'error'}
			class:text-red-900={t.type === 'error'}
			class:bg-sky-50={t.type === 'info'}
			class:border-sky-200={t.type === 'info'}
			class:text-sky-900={t.type === 'info'}
		>
			<div class="flex items-center gap-2.5">
				{#if t.type === 'success'}
					<CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
				{:else if t.type === 'error'}
					<AlertCircle class="w-4 h-4 text-red-600 shrink-0" />
				{:else}
					<Info class="w-4 h-4 text-sky-600 shrink-0" />
				{/if}
				<span>{t.message}</span>
			</div>

			<button
				onclick={() => removeToast(t.id)}
				class="ml-3 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
				aria-label="Tutup"
			>
				<X class="w-3.5 h-3.5" />
			</button>
		</div>
	{/each}
</div>
