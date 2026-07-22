<script lang="ts">
	import { cn } from '$lib/utils';
	let { class: className = '', children, ...restProps }: { class?: string; children?: any; [key: string]: any } = $props();
</script>

<div class="relative w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
	<table class={cn("w-full caption-bottom text-sm", className)} {...restProps}>
		{@render children?.()}
	</table>
</div>
