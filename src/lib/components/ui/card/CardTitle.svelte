<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', children, ...restProps }: { class?: string; children?: any; [key: string]: any } = $props();
</script>

<h3 class={cn("font-semibold leading-none tracking-tight text-slate-900 text-lg", className)} {...restProps}>
	{@render children?.()}
</h3>
