<script>
    import { getSkin, getHeadFromSkin } from '$lib/utils/skins.js';

    export let username = "N3k0t1na_o";
    let headUrl = "";

    async function updateHead() {
        try {
            const skinUrl = await getSkin(username);

            console.log(skinUrl)

            if (skinUrl) {
                headUrl = await getHeadFromSkin(skinUrl, 32);
            }
            else headUrl = null;
        } catch (e) {
            console.error("Не удалось загрузить голову:", e);
        }
    }

    $: if (username) updateHead();
</script>

<div class="head-container">
    {#if headUrl}
        <img src={headUrl} alt={username} />
    {:else}
        <div class="placeholder" />
    {/if}
</div>

<style>
    img {
        display: block;
        image-rendering: pixelated;
        width: 32px;
        height: 32px;
        border-radius: 4px;
    }

    .placeholder {
        width: 32px;
        height: 32px;
        background: #333;
    }
</style>
