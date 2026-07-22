<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', children, ...restProps }: { class?: string; children?: any; [key: string]: any } = $props();
</script>

<thead class={cn("[&_tr]:border-b bg-slate-50/80", className)} {...restProps}>
	{@render children?.()}
</thead>
