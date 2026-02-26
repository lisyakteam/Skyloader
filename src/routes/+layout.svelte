<script>
    import { onMount } from 'svelte';
    import { load } from '$lib/utils/background.js';
    import { exists, mkdir, writeFile, readFile } from '@tauri-apps/plugin-fs';
    import { join, appDataDir } from '@tauri-apps/api/path';
    import { fetch } from '@tauri-apps/plugin-http';
    import '../app.css';

    let videoSrc = "";
    let v1, v2;
    let activePlayer = 1;
    let transitioning = false;
    let firstVideoLoaded = false;
    const fadeTime = 2000;

    async function getCachedVideo(entry) {
        try {
            const appData = await appDataDir();
            const folder = await join(appData, 'cache/bg');
            if (!await exists(folder)) await mkdir(folder, { recursive: true })

            const fileName = 'cache/bg/' + entry.id + '.mp4';
            const filePath = await join(appData, fileName);

            if (!await exists(filePath)) {
                const response = await fetch(entry.videoUrl);
                const arrayBuffer = await response.arrayBuffer();
                await writeFile(filePath, new Uint8Array(arrayBuffer));
            }

            const videoData = await readFile(filePath);
            const blob = new Blob([videoData], { type: 'video/mp4' });
            return URL.createObjectURL(blob);
        } catch (err) {
            return entry.videoUrl;
        }
    }

    onMount(async () => {
        const entry = await load();
        if (entry.videoUrl) {
            videoSrc = await getCachedVideo(entry);
        }

        return () => {
            if (videoSrc.startsWith('blob:')) {
                URL.revokeObjectURL(videoSrc);
            }
        };
    });

    function handleInitialLoad() {
        firstVideoLoaded = true;
    }

    function handleTimeUpdate(e) {
        const video = e.currentTarget;
        const triggerTime = video.duration - (fadeTime / 1000);

        if (video.currentTime >= triggerTime && !transitioning) {
            transitioning = true;
            swapPlayers();
        }
    }

    function swapPlayers() {
        const nextPlayer = activePlayer === 1 ? v2 : v1;
        const currentPlayer = activePlayer === 1 ? v1 : v2;

        nextPlayer.currentTime = 0;
        nextPlayer.play();
        activePlayer = activePlayer === 1 ? 2 : 1;

        setTimeout(() => {
            currentPlayer.pause();
            transitioning = false;
        }, fadeTime);
    }
</script>

{#if videoSrc}
    <div class="video-container">
        <video
            bind:this={v1}
            src={videoSrc}
            autoplay
            muted
            playsinline
            on:loadeddata={handleInitialLoad}
            on:timeupdate={handleTimeUpdate}
            class:visible={activePlayer === 1 && firstVideoLoaded}
            class="bg-video"
        ></video>

        <video
            bind:this={v2}
            src={videoSrc}
            muted
            playsinline
            on:timeupdate={handleTimeUpdate}
            class:visible={activePlayer === 2}
            class="bg-video"
        ></video>
    </div>
{/if}

<slot />

<style>
    .video-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        background: black;
    }

    .bg-video {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 2s ease-in-out;
    }

    .bg-video.visible {
        opacity: 1;
    }
</style>
