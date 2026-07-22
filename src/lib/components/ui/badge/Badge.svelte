<script lang="ts">
	import { cn } from '$lib/utils';

	type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
	let {
		class: className = '',
		variant = 'default',
		children,
		...restProps
	}: { class?: string; variant?: Variant; children?: any; [key: string]: any } = $props();

	const variantStyles: Record<Variant, string> = {
		default: 'border-transparent bg-teal-600 text-white shadow hover:bg-teal-700',
		secondary: 'border-transparent bg-teal-100 text-teal-800 hover:bg-teal-200',
		destructive: 'border-transparent bg-red-100 text-red-700 hover:bg-red-200',
		outline: 'text-slate-950 border-slate-200',
		success: 'border-transparent bg-emerald-100 text-emerald-800',
		warning: 'border-transparent bg-amber-100 text-amber-800'
	};
</script>

<div
	class={cn(
		"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variantStyles[variant],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</div>
