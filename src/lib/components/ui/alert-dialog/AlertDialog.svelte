<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle } from 'lucide-svelte';

	let {
		open = $bindable(false),
		title = 'Konfirmasi Hapus',
		description = 'Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.',
		confirmText = 'Hapus',
		cancelText = 'Batal',
		onConfirm = () => {}
	}: {
		open: boolean;
		title?: string;
		description?: string;
		confirmText?: string;
		cancelText?: string;
		onConfirm?: () => void;
	} = $props();

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		open = false;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
		onclick={handleCancel}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-start gap-4">
				<div class="p-3 bg-red-50 text-red-600 rounded-full shrink-0">
					<AlertTriangle class="w-6 h-6" />
				</div>
				<div class="space-y-1">
					<h3 class="font-semibold text-slate-900 text-base">{title}</h3>
					<p class="text-xs text-slate-500 leading-relaxed">{description}</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2">
				<Button variant="outline" size="sm" onclick={handleCancel}>{cancelText}</Button>
				<Button variant="destructive" size="sm" onclick={handleConfirm}>{confirmText}</Button>
			</div>
		</div>
	</div>
{/if}
