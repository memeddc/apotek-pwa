<script lang="ts">
	let {
		data = []
	}: {
		data: { label: string; value: number; color: string }[];
	} = $props();

	const total = $derived(data.reduce((acc, d) => acc + d.value, 0));

	const slices = $derived.by(() => {
		if (total === 0) return [];
		let cumulativeAngle = 0;
		return data.map((d) => {
			const angle = (d.value / total) * 360;
			const startAngle = cumulativeAngle;
			const endAngle = cumulativeAngle + angle;
			cumulativeAngle += angle;

			// SVG arc paths (donut r1=36, r2=48, cx=50, cy=50)
			const x1 = 50 + 44 * Math.cos(((startAngle - 90) * Math.PI) / 180);
			const y1 = 50 + 44 * Math.sin(((startAngle - 90) * Math.PI) / 180);
			const x2 = 50 + 44 * Math.cos(((endAngle - 90) * Math.PI) / 180);
			const y2 = 50 + 44 * Math.sin(((endAngle - 90) * Math.PI) / 180);

			const largeArcFlag = angle > 180 ? 1 : 0;
			const strokeDasharray = `${(angle / 360) * 276.46} 276.46`;
			const strokeDashoffset = -((startAngle / 360) * 276.46);

			return {
				...d,
				percentage: Math.round((d.value / total) * 100),
				strokeDasharray,
				strokeDashoffset
			};
		});
	});
</script>

<div class="flex flex-col sm:flex-row items-center gap-4 py-1">
	<!-- Donut SVG -->
	<div class="relative w-32 h-32 md:w-36 md:h-36 shrink-0 flex items-center justify-center">
		<svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
			<circle cx="50" cy="50" r="44" fill="transparent" stroke="#f1f5f9" stroke-width="12" />
			{#each slices as slice}
				<circle
					cx="50"
					cy="50"
					r="44"
					fill="transparent"
					stroke={slice.color}
					stroke-width="12"
					stroke-dasharray={slice.strokeDasharray}
					stroke-dashoffset={slice.strokeDashoffset}
					stroke-linecap="round"
					class="transition-all duration-500 hover:opacity-80"
				/>
			{/each}
		</svg>
		<div class="absolute flex flex-col items-center justify-center text-center pointer-events-none">
			<span class="text-xs font-semibold text-slate-400">Total</span>
			<span class="text-lg font-extrabold text-slate-900 leading-none mt-0.5">{total}</span>
		</div>
	</div>

	<!-- Legend List -->
	<div class="flex-1 space-y-2.5 w-full">
		{#each slices as slice}
			<div class="flex items-center justify-between text-xs">
				<div class="flex items-center gap-2 truncate pr-2">
					<span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {slice.color};"></span>
					<span class="font-medium text-slate-700 truncate">{slice.label}</span>
				</div>
				<div class="flex items-center gap-2 font-bold shrink-0">
					<span class="text-slate-900">{slice.value}</span>
					<span class="text-[11px] text-slate-400 font-medium w-8 text-right">{slice.percentage}%</span>
				</div>
			</div>
		{/each}
		{#if slices.length === 0}
			<div class="text-xs text-slate-400 text-center py-4">Tidak ada data jenis obat</div>
		{/if}
	</div>
</div>
