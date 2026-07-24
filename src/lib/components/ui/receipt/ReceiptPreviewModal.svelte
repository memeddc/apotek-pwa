<script lang="ts">
	import PrintableReceipt from './PrintableReceipt.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from '$lib/components/ui/toast';
	import { Printer, X, Receipt, CheckCircle2 } from 'lucide-svelte';

	type ReceiptLine = {
		nama: string;
		qty: number;
		total: number;
		harga?: number;
	};

	type Props = {
		open?: boolean;
		onClose: () => void;
		nomorNota?: string;
		tanggalWaktu?: string | Date;
		lines?: ReceiptLine[];
		total?: number;
		bayar?: number;
		kembali?: number;
	};

	let {
		open = $bindable(false),
		onClose,
		nomorNota = '',
		tanggalWaktu = new Date(),
		lines = [],
		total = 0,
		bayar = 0,
		kembali = 0
	}: Props = $props();

	function handleSilentPrint() {
		toast.info('[TODO] Silent Printing: Perintah cetak langsung ke printer POS thermal akan dikirim di sini.');
	}

	function handleBrowserPrint() {
		window.print();
	}
</script>

{#if open}
	<!-- Modal Overlay Backdrop -->
	<div
		class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
		onclick={(e) => {
			if (e.target === e.currentTarget) onClose();
		}}
		role="button"
		tabindex="-1"
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
	>
		<!-- Modal Dialog Box matching App Design System -->
		<div class="bg-white rounded-2xl shadow-xl border border-slate-200/90 max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
			
			<!-- Header Bar matching app cards -->
			<div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
				<div class="flex items-center gap-3">
					<div class="w-9 h-9 rounded-xl bg-mint-50 border border-mint-100 flex items-center justify-center text-mint-600">
						<Receipt class="w-4.5 h-4.5" />
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h3 class="text-sm font-bold text-slate-800">Preview Nota Penjualan</h3>
							{#if nomorNota}
								<Badge variant="secondary" class="font-mono text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
									{nomorNota}
								</Badge>
							{/if}
						</div>
						<p class="text-[11px] text-slate-500">Tampilan hasil cetak nota kasir apotek</p>
					</div>
				</div>

				<button
					onclick={onClose}
					class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-all cursor-pointer"
					aria-label="Tutup"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Modal Body (Paper Container) -->
			<div class="p-6 overflow-y-auto bg-slate-100/70 flex justify-center items-center">
				<PrintableReceipt
					isModalPreview={true}
					{nomorNota}
					{tanggalWaktu}
					{lines}
					{total}
					{bayar}
					{kembali}
				/>
			</div>

			<!-- Modal Footer -->
			<div class="px-5 py-3.5 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-2.5">
				<Button variant="ghost" size="sm" onclick={onClose} class="w-full sm:w-auto text-xs text-slate-600 hover:bg-slate-100 rounded-xl">
					Tutup
				</Button>

				<div class="flex items-center gap-2 w-full sm:w-auto">
					<Button
						variant="outline"
						size="sm"
						onclick={handleBrowserPrint}
						class="flex-1 sm:flex-initial text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
						title="Cetak lewat dialog cetak standar browser"
					>
						<Printer class="w-3.5 h-3.5 mr-1.5" /> Browser Print
					</Button>

					<Button
						size="sm"
						onclick={handleSilentPrint}
						class="flex-1 sm:flex-initial text-xs font-bold rounded-xl bg-mint-500 hover:bg-mint-600 text-white shadow-xs cursor-pointer"
						title="Cetak langsung ke printer POS thermal (Silent Print)"
					>
						<CheckCircle2 class="w-3.5 h-3.5 mr-1.5" /> Silent Print (TODO)
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Hidden HTML component rendered exclusively when browser print window is called -->
<PrintableReceipt
	isModalPreview={false}
	{nomorNota}
	{tanggalWaktu}
	{lines}
	{total}
	{bayar}
	{kembali}
/>
