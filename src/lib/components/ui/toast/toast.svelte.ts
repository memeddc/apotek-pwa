export type ToastItem = {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info';
};

export const toasts = $state<ToastItem[]>([]);

export const toast = {
	success(message: string) {
		addToast(message, 'success');
	},
	error(message: string) {
		addToast(message, 'error');
	},
	info(message: string) {
		addToast(message, 'info');
	}
};

function addToast(message: string, type: 'success' | 'error' | 'info') {
	const id = Math.random().toString(36).substring(2, 9);
	toasts.push({ id, message, type });
	setTimeout(() => {
		const index = toasts.findIndex((t) => t.id === id);
		if (index !== -1) toasts.splice(index, 1);
	}, 4000);
}

export function removeToast(id: string) {
	const index = toasts.findIndex((t) => t.id === id);
	if (index !== -1) toasts.splice(index, 1);
}
