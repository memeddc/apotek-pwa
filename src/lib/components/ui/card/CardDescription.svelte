<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', children, ...restProps }: { class?: string; children?: any; [key: string]: any } = $props();
</script>

<p class={cn("text-sm text-slate-500", className)} {...restProps}>
	{@render children?.()}
</p>
