import { writable } from 'svelte/store';

export const toasts = writable([]);

export const showToast = (message, type = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);

    toasts.update((all) => [{ id, message, type }, ...all]);

    setTimeout(() => {
        toasts.update((all) => all.filter((t) => t.id !== id));
    }, duration);
};
