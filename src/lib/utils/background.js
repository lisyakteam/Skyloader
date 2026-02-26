import { fetch } from '@tauri-apps/plugin-http';

export const load = async () => {
    const response = await fetch('https://lisyak.net/background.json');
    const { launcher } = await response.json();

    const selection = launcher[Math.floor(Math.random() * launcher.length)];

    return {
        id: selection.id,
        videoUrl: selection.url
    };
}
