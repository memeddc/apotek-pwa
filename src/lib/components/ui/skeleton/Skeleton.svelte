<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', ...restProps }: { class?: string; [key: string]: any } = $props();
</script>

<div class={cn("animate-pulse rounded-md bg-slate-200/80", className)} {...restProps}></div>
