<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', children, ...restProps }: { class?: string; children?: any; [key: string]: any } = $props();
</script>

<tr class={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/60 data-[state=selected]:bg-slate-100", className)} {...restProps}>
	{@render children?.()}
</tr>
