<script lang="ts" module>
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export const buttonVariants = (variant: string = 'default', size: string = 'default', className: string = '') => {
		const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
		
		const variants: Record<string, string> = {
			default: "bg-teal-600 text-white shadow hover:bg-teal-700 active:bg-teal-800",
			destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
			outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-100 hover:text-slate-900",
			secondary: "bg-teal-100 text-teal-900 shadow-sm hover:bg-teal-200",
			ghost: "hover:bg-slate-100 hover:text-slate-900",
			link: "text-teal-600 underline-offset-4 hover:underline"
		};

		const sizes: Record<string, string> = {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9 p-0"
		};

		const vClass = variants[variant] || variants.default;
		const sClass = sizes[size] || sizes.default;
		return `${base} ${vClass} ${sClass} ${className}`.trim();
	};
</script>

<script lang="ts">
	import { cn } from '$lib/utils';

	type $$Props = HTMLButtonAttributes & {
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon';
		class?: string;
	};

	let {
		class: className = '',
		variant = 'default',
		size = 'default',
		type = 'button',
		children,
		disabled = false,
		...restProps
	}: $$Props & { children?: any } = $props();
</script>

<button
	{type}
	{disabled}
	class={cn(buttonVariants(variant, size, className))}
	{...restProps}
>
	{@render children?.()}
</button>
