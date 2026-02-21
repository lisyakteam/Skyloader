import { getVersion } from '@tauri-apps/api/app';
import { writable, get } from 'svelte/store';
import { showToast } from '$lib/utils/toasts.js';

export async function getLatestUpdate() {
    try {
        const res = await fetch('https://api.github.com/repos/lisyakteam/skyloader/releases/latest');
        return res.json();
    } catch (e) {
        console.error(e);
        return {}
    }
}

export async function fetchUpdate() {
    console.log('checking')

    const data = get(updateData)
    console.log(data)
    if (data) return data;

    const update = await getLatestUpdate();

    if (update.tag_name !== get(appVersion)) {
        showToast("Доступно обновление!")
    }

    updateData.set(update)
    return update;
}

export const appVersion = writable("1.0.0");
export const updateData = writable(null);

appVersion.subscribe(ver => {
    if (ver === "1.0.0") getVersion().then(v => appVersion.set(v))
})
