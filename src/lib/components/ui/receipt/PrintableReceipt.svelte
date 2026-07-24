<script lang="ts">
	type ReceiptLine = {
		nama: string;
		qty: number;
		total: number;
		harga?: number;
	};

	type Props = {
		nomorNota?: string;
		tanggalWaktu?: string | Date;
		lines?: ReceiptLine[];
		total?: number;
		bayar?: number;
		kembali?: number;
		isModalPreview?: boolean;
	};

	let {
		nomorNota = '',
		tanggalWaktu = new Date(),
		lines = [],
		total = 0,
		bayar = 0,
		kembali = 0,
		isModalPreview = false
	}: Props = $props();

	function formatDateStr(dtInput: string | Date): { dateStr: string; timeStr: string } {
		if (!dtInput) return { dateStr: '-', timeStr: '' };
		const d = new Date(dtInput);
		if (isNaN(d.getTime())) return { dateStr: String(dtInput), timeStr: '' };
		const day = String(d.getDate()).padStart(2, '0');
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const year = d.getFullYear();
		const hours = String(d.getHours()).padStart(2, '0');
		const minutes = String(d.getMinutes()).padStart(2, '0');
		const seconds = String(d.getSeconds()).padStart(2, '0');
		return {
			dateStr: `${day}/${month}/${year}`,
			timeStr: `${hours}:${minutes}:${seconds}`
		};
	}

	function formatRp(v: number): string {
		return new Intl.NumberFormat('id-ID').format(Math.round(v || 0));
	}

	let formattedDt = $derived(formatDateStr(tanggalWaktu));
</script>

<div
	id={isModalPreview ? undefined : 'printable-receipt'}
	class={`font-mono text-[12px] text-slate-900 leading-normal select-none ${
		isModalPreview
			? 'block w-[290px] sm:w-[320px] bg-white p-5 shadow-md rounded-xl border border-slate-200/90'
			: 'hidden print:block print:w-[76mm] print:max-w-[76mm] print:p-2 print:bg-white'
	}`}
	style="font-family: 'Courier New', Courier, monospace;"
>
	<!-- Heading: NOTA PENJUALAN with spacing -->
	<div class="text-center font-bold text-sm tracking-wider text-black uppercase mb-4">
		NOTA PENJUALAN
	</div>

	<!-- Top Dashed Divider -->
	<div class="border-b border-dashed border-slate-400 my-2"></div>

	<!-- Items List -->
	<div class="space-y-2.5 my-2">
		{#each lines as item}
			{@const unitPrice = item.harga ?? (item.qty > 0 ? Math.round(item.total / item.qty) : 0)}
			<div class="space-y-0.5">
				<!-- Item Name -->
				<div class="font-bold text-black uppercase text-[12px] leading-tight">
					{item.nama}
				</div>
				<!-- Qty x Unit Price -> Subtotal Line -->
				<div class="flex justify-between text-[11px] text-slate-700">
					<span>{item.qty} x Rp{formatRp(unitPrice)}</span>
					<span class="font-bold text-slate-900 font-mono">Rp{formatRp(item.total)}</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- Middle Dashed Divider -->
	<div class="border-b border-dashed border-slate-400 my-2"></div>

	<!-- Summary Totals -->
	<div class="space-y-1 my-2 text-[12px]">
		<div class="flex justify-between font-bold text-black text-[13px] pt-0.5">
			<span>TOTAL</span>
			<span class="font-mono">Rp{formatRp(total)}</span>
		</div>
		<div class="flex justify-between text-slate-700">
			<span>Bayar</span>
			<span class="font-mono">Rp{formatRp(bayar)}</span>
		</div>
		<div class="flex justify-between text-slate-700">
			<span>Kembali</span>
			<span class="font-mono">Rp{formatRp(kembali)}</span>
		</div>
	</div>

	<!-- Dashed Divider -->
	<div class="border-b border-dashed border-slate-400 my-2"></div>

	<!-- Timestamp Line -->
	<div class="flex justify-between my-2 text-[11px] text-slate-700">
		<span>{formattedDt.dateStr}</span>
		<span>{formattedDt.timeStr}</span>
	</div>

	<!-- Footer Notice: ONLY OBAT YANG DITERIMA HARAP DICEK -->
	<div class="text-center pt-3 pb-1 text-[11px] font-bold text-black uppercase tracking-wide leading-tight">
		<div>OBAT YANG DITERIMA</div>
		<div>HARAP DICEK</div>
	</div>
</div>
