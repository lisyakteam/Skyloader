<script>
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { slide, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { get } from 'svelte/store';
  import { onMount } from 'svelte';
  
  import PageCard from '../components/PageCard.svelte';
  import Game from '../components/pages/Game.svelte';
  import Builds from '../components/pages/Builds.svelte';
  import Servers from '../components/pages/Servers.svelte';
  import Profiles from '../components/pages/Profiles.svelte';
  import Settings from '../components/pages/Settings.svelte';
  import BackgroundEffects from '../components/BackgroundEffects.svelte';
  import Toasts from '../components/Toasts.svelte';

  import { config, myBuilds, accounts, launchInfo } from '$lib/stores.js';
  import { fetchUpdate } from '$lib/utils/updater.js';
  import { showToast } from '$lib/utils/toasts.js';

  let pages = [
    { name: 'Сервера', component: Servers },
    { name: 'Версии', component: Builds },
    { name: 'Играть', component: Game },
    { name: 'Профили', component: Profiles },
    { name: 'Настройки', component: Settings },
  ];
  pages = pages.map((x, i) => { return { ...x, index: i } })

  function springOut(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function slideFade(node, params) {
    const delay = params.delay || 0;
    const duration = params.duration || 100;
    const easing = params.easing || springOut;

    return {
      delay,
      duration,
      css: (t, u) => {
        const eased = easing(t);
        return `
          transform: translateY(${(1 - eased) * 20}px);
          opacity: ${eased};
        `;
      }
    };
  }
  
  // функция вычисления задержки по индексу: центр = 0, дальше = +/-
  function buttonDelay(index) {
    const offset = Math.abs(index - activeIndex);
    return offset * 40;
  }

  let visible = false;
  
  let temporarilyDisableHovering = false;
  let hoverIndex = null;
  let activeIndex = 2;

  function goTo(index) {
    activeIndex = index;
    temporarilyDisableHovering = true;
    hoverIndex = null;
    visible = false;
  }
  
  function mouseOnMenu() {
    if(!temporarilyDisableHovering) visible = true;
  }
  
  function mouseLeftMenu() {
    temporarilyDisableHovering = false;
    visible = false; 
    hoverIndex = null;
  }

  $: visiblePages = visible ? pages : [];

  onMount(fetchUpdate)

</script>

{#if $accounts && $myBuilds && $config}
  <div class="pages-container">
    {#each pages as page, index}
      <PageCard
        index={index}
        activeIndex={activeIndex}
        hoverIndex={hoverIndex}
        position={hoverIndex !== null ? index - hoverIndex : index - activeIndex}
        zoomOut={visible}
      >
        <svelte:component this={page.component} />
      </PageCard>
    {/each}
  </div>
{/if}

<div class="hover-wrapper"
     on:mouseenter={mouseOnMenu}
     on:mouseleave={mouseLeftMenu}>

  {#if $launchInfo}
    <div class="launch-info">
      <div class="spinner"></div>
      {$launchInfo}
    </div>
  {/if}

  <div class="hover-zone" aria-hidden="true"></div>
  <div class="panel">
    {#each visiblePages as page, index (page.index)}
      <div
        out:slideFade={{ duration: 200, delay: buttonDelay(index) }}
        in:slideFade={{ duration: 200, delay: buttonDelay(index) }}
        on:mouseenter={() => { hoverIndex = index }}>
        <button
          class="btn"
          class:active={hoverIndex === null ? index === activeIndex : index === hoverIndex}
          on:click={() => goTo(index)}>
          {page.name.toUpperCase()}
        </button>
      </div>
    {/each}
  </div>
</div>

<Toasts />
<BackgroundEffects />

<style>
  .launch-info {
    position: fixed;
    display: flex;
    align-items: center;
    gap: 10px;
    left: 20px;
    top: 10px;
    color: white;
    font-size: 16px;
    z-index: 10;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 3px solid #fff;
    border-top-color: #55ff77;
    border-radius: 100px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
    
  .pages-container {
    position: relative;
    width: 100%;
    height: calc(100% - 15px);
    overflow: visible;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1;
    overflow: hidden;
  }

  .hover-wrapper {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 80px;
    z-index: 500;
    pointer-events: auto;
  }

  .hover-zone {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60px;
  }

  .panel {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 15px;
    display: flex;
    gap: 6px;
    align-items: center;
    pointer-events: auto;
    z-index: 10000;
  }

  .btn {
    background: transparent;
    border: none;
    padding: 8px 12px;
    cursor: pointer;
    color: #fffa;
    font-size: 14px;
    font-weight: 1000;
    font-family: 'Silkscreen', sans-serif;
    z-index: 1;
    transition: color 0.2s;
  }
  
  .btn.active {
    color: #fff;
  }
</style>

