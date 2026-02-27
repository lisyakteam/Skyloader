<script>
  import { onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { myBuilds, config, accounts } from '$lib/stores.js';
  import { launchGame } from '$lib/launcher/loader.js';
  import { getSkin } from '$lib/utils/skins.js';
  import PlayerHead from '$components/PlayerHead.svelte';
  import Select from '$components/Select.svelte'

  $: buildIndex = $myBuilds.findIndex(b => b.instanceId === $config.lastInstanceId);
  $: activeIdx = buildIndex !== -1 ? buildIndex : 0;
  $: currentBuild = $myBuilds[activeIdx] || { name: 'Нет сборок', game: { version: '?' } };
  $: currentAccount = $accounts?.[$config.selectedAccountIndex || 0] || { name: 'Guest' };

  let isMenuOpen = false;
  let skinViewer;
  let skinUrl;

  onMount(() => {
    if (!window.skinview3d) {
      const script = document.createElement('script');
      script.src = "https://bs-community.github.io/skinview3d/js/skinview3d.bundle.js";
      script.onload = init3D;
      document.head.appendChild(script);
    } else { init3D(); }
  });

  $: if (skinViewer && currentAccount) {
    getSkin(currentAccount.name).then(url => {
      skinUrl = url;
      skinViewer.loadSkin(url)
    });
  }

  function init3D() {
    getSkin(currentAccount.name).then(url => {
      const canvas = document.getElementById("skin_canvas");
      if (!canvas) return;
      skinViewer = new skinview3d.SkinViewer({
        canvas, width: 260, height: 380,
        skin: url
      });
      skinViewer.animation = new skinview3d.IdleAnimation();
    })
  }

  function selectAccount(index) {
    config.update(c => ({ ...c, selectedAccountIndex: index }));
    isMenuOpen = false;
  }

  function changeVersion(step) {
    if ($myBuilds.length === 0) return;
    const nextIdx = (activeIdx + step + $myBuilds.length) % $myBuilds.length;
    const nextId = $myBuilds[nextIdx].instanceId;
    config.update(c => ({ ...c, lastInstanceId: nextId }));
  }

  function clickOutside(node) {
    const handleClick = (event) => {
      if (node && !node.contains(event.target) && !event.defaultPrevented) {
        node.dispatchEvent(new CustomEvent('click_outside'));
      }
    };

    document.addEventListener('click', handleClick, true);
    return {
      destroy() { document.removeEventListener('click', handleClick, true); }
    };
  }

</script>

<div class="center-wrapper">
<div class="launcher-card">
    <div class="left-panel"><canvas id="skin_canvas"></canvas></div>
    <div class="right-panel">
      <div class="section-account"
          use:clickOutside
          on:click_outside={() => isMenuOpen = false}>
        <button class="acc-btn" on:click={() => isMenuOpen = !isMenuOpen}>
          <PlayerHead username={currentAccount.name}/>
          <span>{currentAccount.name}</span>
          <span class="arrow">{isMenuOpen ? '▲' : '▼'}</span>
        </button>
        {#if isMenuOpen}
          <div
          class="dropdown-list"
          transition:slide={{ duration: 200 }}>
            <div class="list-scroll">
              {#each ($accounts || []) as acc, i}
                <div class="list-item" class:sel={i === $config.selectedAccountIndex} on:click={() => selectAccount(i)}>
                   <PlayerHead username={acc.name}/>
                  {acc.name}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="section-version">
        <div class="ver-selector">
           <button class="nav-btn" on:click={() => changeVersion(-1)}>‹</button>
           <div class="build-info">
              <div class="build-badge">{currentBuild.game?.core || 'Vanilla'}</div>
              <div class="build-name">{currentBuild.name}</div>
              <div class="build-ver">{currentBuild.game?.version}</div>
           </div>
           <button class="nav-btn" on:click={() => changeVersion(1)}>›</button>
        </div>
      </div>

      <div class="play-wrapper">
        <button
        class="play-btn"
        disabled={$myBuilds.length === 0}
        on:click={() => { console.log('123'); launchGame(log => console.log(log)) }}
        >
          ИГРАТЬ
        </button>
      </div>
    </div>
</div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

  .launcher-card {
    width: 750px; height: 380px;
    background: #181818;
    border-radius: 16px;
    border: 1px solid #333; display: flex;
    box-shadow: 0 10px 10px rgba(0,0,0,0.6);
  }

  .left-panel {
    width: 260px;
    background: radial-gradient(circle at 50% 40%, #252525 0%, #0a0a0a 100%);
  }

  #skin_canvas { width: 100%; height: 100%; outline: none; }

  .right-panel {
    flex: 1; padding: 30px;
    display: flex; flex-direction: column; gap: 20px;
  }

  .section-account { position: relative; z-index: 100; }

  .acc-btn {
    width: 100%; background: #222; border: 1px solid #333;
    padding: 12px 15px; border-radius: 10px;
    display: flex; align-items: center; gap: 12px;
    color: white; cursor: pointer; transition: 0.2s;
  }
  .acc-btn img { border-radius: 3px; }
  .acc-btn:hover { background: #2a2a2a; border-color: #444; }
  .arrow { margin-left: auto; font-size: 10px; color: #666; }

  .dropdown-list {
    position: absolute;
    top: -5px;
    left: 0;
    z-index: 100;
    overflow-y: auto;
    max-height: 250px;
    background: #1f1f1f; border: 1px solid #333;
    border-radius: 10px; margin-top: 5px;
  }
  .dropdown-list::-webkit-scrollbar {
    width: 6px;
  }
  .dropdown-list::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 10px;
  }
  .list-item {
    padding: 10px 15px; display: flex; align-items: center; gap: 10px;
    cursor: pointer; font-size: 14px; color: #ccc;
  }
  .list-item:hover { background: #333; color: white; }
  .list-item.sel { color: #4CAF50; background: rgba(76, 175, 80, 0.05); }
  .list-item img { border-radius: 2px; }

  .ver-selector {
    display: flex; align-items: center;
    background: #222; border: 1px solid #333;
    border-radius: 12px; padding: 5px; height: 80px;
  }
  .nav-btn {
    background: none; border: none; color: #555;
    font-size: 24px; width: 40px; height: 100%;
    cursor: pointer; transition: 0.2s;
  }
  .nav-btn:hover { color: white; background: #2a2a2a; border-radius: 8px; }

  .build-info {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 4px;
  }
  .build-badge {
    font-size: 9px; font-weight: 800; background: #333;
    padding: 2px 8px; border-radius: 20px; color: #aaa;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .build-name { font-weight: 700; font-size: 15px; color: #eee; }
  .build-ver { font-size: 12px; color: #666; }

  .play-wrapper { margin-top: auto; }
  .play-btn {
    width: 100%; height: 56px;
    background: linear-gradient(135deg, #4CAF50 0%, #388E3C 100%);
    color: white; border: none; border-radius: 12px;
    font-size: 18px; font-weight: 900; cursor: pointer;
    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
    transition: 0.2s;
  }
  .play-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.1); }
  .play-btn:active:not(:disabled) { transform: translateY(0); }
  .play-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
</style>
