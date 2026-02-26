<script>
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { openPath, openUrl } from '@tauri-apps/plugin-opener';
  import { fly, fade, scale } from 'svelte/transition';
  import { join, appDataDir } from '@tauri-apps/api/path';
  import { exists, mkdir } from '@tauri-apps/plugin-fs';

  import { modal, config } from '$lib/stores.js';
  import { checkOrInstallJava } from '$lib/launcher/java.js';
  import { appVersion, fetchUpdate } from '$lib/utils/updater.js';
  import { showToast } from '$lib/utils/toasts.js';

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let totalSystemRam = 16384;
  let isJavaValid = false;
  let javaVersion = null;
  let currentView = 'menu';

  let updateData = {
    tag_name: '',
    body: '',
    author: { avatar_url: '', login: '' },
    html_url: ''
  };

  $: renderedChangelog = updateData?.body
    ? DOMPurify.sanitize(marked.parse(updateData.body))
    : '';

  onMount(async () => {
    totalSystemRam = await invoke('get_total_ram');
    if ($config.ram > totalSystemRam) $config.ram = totalSystemRam;

    if (!$config.javaPath) {
      const foundPath = await invoke('find_system_java');
      if (foundPath) {
        $config.javaPath = foundPath;
        saveConfigToDisk();
      }
    }
    await validateJava();
  });

  let timeout;
  function saveConfigToDisk() {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      config.update(current => current)
    }, 500);
  };

  async function validateJava() {
    if ($config.javaPath) {
      javaVersion = await invoke('get_java_version', { path: $config.javaPath });

      if (javaVersion) {
        const verNum = parseInt(javaVersion.split('.')[0]);
        isJavaValid = verNum >= 25;

        if (!isJavaValid) {
          showToast(`Ваша версия джава ${javaVersion}, необходима 25`, "error");
        }
      } else {
        isJavaValid = false;
        showToast("Java не обнаружена, обновите в настройках", "error");
      }
    } else {
      isJavaValid = false;
    }
  }

  async function handleInstallJava() {
    const success = await checkOrInstallJava();
    if (success) await validateJava();
  }

  async function getDefaultPath(key) {
    const dir = await appDataDir();
    let result;

    if (key === 'assetsPath') result = `${dir}/assets`
    else if (key === 'libraryPath') result = `${dir}/libraries`
    else result = dir;

    if (!await exists(result)) await mkdir(result, { recursive: true });
    return result;
  }

  async function selectPath(key, isDirectory = true) {
    const defaultPath = $config[key] || await getDefaultPath(key);

    const selected = await open({
      directory: isDirectory,
      multiple: false,
      defaultPath
    });

    if (selected) {
      $config[key] = selected + (isDirectory ? '/' : '');
      saveConfigToDisk();
      if (key === 'javaPath') await validateJava();
    }
  }

  async function checkUpdates() {
    const update = await fetchUpdate();
    if (update && update.tag_name !== get(appVersion)) {
      updateData = update;
      modal.set('update')
    } else {
      showToast('Обновлений не найдено!');
    }
  }

  function openRelease(url) {
    modal.set(null)
    openUrl(url);
  }
</script>

<div class="profiles-container">
  <div class="view-wrapper">
    {#if currentView === 'menu'}
      <div class="menu-grid" in:fade={{ duration: 100 }}>
        <button class="menu-item" on:click={() => currentView = 'performance'}>
          <div class="icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <div class="text">
            <span>Производительность</span>
            <small>RAM, Java Runtime, Оптимизация</small>
          </div>
        </button>

        <button class="menu-item" on:click={() => currentView = 'folders'}>
          <div class="icon purple">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="text">
            <span>Файлы и папки</span>
            <small>Ресурсы, библиотеки, пути</small>
          </div>
        </button>

        <button class="menu-item" on:click={() => currentView = 'launcher'}>
          <div class="icon orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </div>
          <div class="text">
            <span>Лаунчер</span>
            <small>Обновления, интерфейс, каталог</small>
          </div>
        </button>
      </div>
    {:else}
      <div class="sub-view" in:fly={{ x: 10, duration: 150 }}>
        <header>
          <button class="back-btn" on:click={() => currentView = 'menu'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6"/></svg>
            Назад
          </button>
        </header>

        <div class="content">
          {#if currentView === 'performance'}
            <div class="card vertical">
              <div class="info-row">
                <span class="label">Выделение памяти (RAM)</span>
                <span class="val">{$config.ram || 4096} MB</span>
              </div>
              <input type="range" min="1024" max={totalSystemRam} step="512" bind:value={$config.ram} on:change={saveConfigToDisk} class="slider"/>
            </div>

            <div class="card">
              <div class="info">
                <span class="label">Java Runtime</span>
                <span class="sub-label">{javaVersion || 'Не выбрана'}</span>
              </div>
              <div class="actions">
                {#if !isJavaValid}
                  <button class="btn btn-blue" on:click={handleInstallJava}>Установить</button>
                {/if}
                <button class="btn btn-gray" on:click={() => selectPath('javaPath', false)}>Обзор</button>
              </div>
            </div>
          {/if}

          {#if currentView === 'folders'}
            <div class="card path-card">
              <div class="info">
                <span class="label">Игровые ресурсы</span>
                <span class="path-display" title={$config.assetsPath}>{$config.assetsPath || 'По умолчанию'}</span>
              </div>
              <button class="icon-btn" on:click={() => selectPath('assetsPath')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </button>
            </div>

            <div class="card path-card">
              <div class="info">
                <span class="label">Игровые библиотеки</span>
                <span class="path-display" title={$config.libraryPath}>{$config.libraryPath || 'По умолчанию'}</span>
              </div>
              <button class="icon-btn" on:click={() => selectPath('libraryPath')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </button>
            </div>
          {/if}

          {#if currentView === 'launcher'}
            <div class="card">
              <div class="info">
                <span class="label">Каталог модпаков</span>
                <span class="sub-label">{$config.disableCatalog ? 'Скрыт в интерфейсе' : 'Доступен'}</span>
              </div>
              <button
                class="btn"
                class:active={!$config.disableCatalog}
                style="width: 115px;"
                on:click={() => { $config.disableCatalog = !$config.disableCatalog; saveConfigToDisk(); }}>
                {!$config.disableCatalog ? 'Включен ' : 'Выключен'}
              </button>
            </div>

            <div class="card">
              <div class="info">
                <span class="label">Версия: {$appVersion}</span>
                <span class="sub-label">Проверка последних обновлений</span>
              </div>
              <button class="btn btn-blue" on:click={checkUpdates}>Проверить</button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

{#if $modal === 'update'}
  <div transition:fade={{duration: 100}} class="modal" on:click|self={() => $modal = null}>
    <div class="modal-box" in:scale={{start: 0.95, duration: 150}}>
      <p class="launcher-version">Доступно обновление</p>
      <div class="changelog">
        {@html renderedChangelog}
      </div>
      <div class="row">
        <div class="uploader">
          {#if updateData?.author?.avatar_url}
            <img src={updateData.author.avatar_url} alt="author"/>
          {/if}
          <a>@{updateData?.author?.login || 'launcher'}</a>
        </div>
        <div class="modal-btns">
          <button class="btn btn-blue" on:click={() => openRelease(updateData.html_url)}>Перейти на сайт</button>
          <button class="btn btn-gray" on:click={() => modal.set(null)}>Закрыть</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .profiles-container {
    color: #fff;
    background: #121212;
    width: 580px;
    height: 280px;
    border-radius: 20px;
    border: 1px solid #252525;
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .view-wrapper { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .menu-grid { display: flex; flex-direction: column; gap: 8px; height: 100%; justify-content: center; }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    background: #1a1a1a;
    border: 1px solid #222;
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    transition: 0.2s;
    color: white;
  }
  .menu-item:hover { background: #222; border-color: #333; transform: translateX(4px); }

  .menu-item .icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
  }
  .icon.blue { background: rgba(0, 122, 255, 0.1); color: #007aff; }
  .icon.purple { background: rgba(175, 82, 222, 0.1); color: #af52de; }
  .icon.orange { background: rgba(255, 159, 10, 0.1); color: #ff9f0a; }

  .menu-item .text span { display: block; font-size: 14px; font-weight: 700; }
  .menu-item .text small { font-size: 11px; color: #555; }

  .sub-view { display: flex; flex-direction: column; height: 100%; }
  .sub-view header { margin-bottom: 16px; }

  .back-btn {
    background: none; border: none; color: #666; cursor: pointer;
    display: flex; align-items: center; gap: 4px; font-weight: 700;
    font-size: 14px; transition: 0.2s;
    margin-bottom: 5px;
  }
  .back-btn:hover { color: #fff; }

  .content { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }

  .card {
    background: #1a1a1a; padding: 16px 16px; border-radius: 14px;
    border: 1px solid #222; display: flex; justify-content: space-between; align-items: center;
  }
  .card.vertical { flex-direction: column; align-items: stretch; gap: 10px; }

  .label { margin-left: 3px; font-size: 14px; font-weight: 700; color: #ccc; }
  .sub-label { font-size: 12px; color: #555; display: block; }

  .path-display {
    font-size: 12px; color: #444; background: #0f0f0f;
    padding: 6px 8px; border-radius: 6px; margin-top: 4px;
    display: block; overflow: hidden; text-overflow: ellipsis; max-width: 380px;
  }

  .btn { padding: 10px 16px; border-radius: 8px; border: none; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; background: #252525; color: #ccc; }
  .btn-blue { background: #007aff; color: #fff; }
  .btn-blue:hover { background: #0063d1; }
  .btn.active { background: #1a2a1d; color: #4caf50; }

  .actions { display: flex; gap: 6px; }
  .icon-btn {
    background: #252525;
    border: none;
    color: #007aff;
    cursor: pointer;
    border-radius: 8px;
    transition: 0.2s;
    padding: 6px 10px;
  }
  .icon-btn svg {
    margin-top: 3px;
  }
  .icon-btn:hover { background: #333; color: #fff; }

  .info {
    display: flex;
    flex-direction: column;
    gap: 5px;
    width: 100%;
  }
  .info-row { display: flex; justify-content: space-between; align-items: center; }
  .val { font-size: 12px; font-weight: 800; color: #007aff; }

  .slider { width: 100%; height: 4px; background: #333; border-radius: 10px; accent-color: #007aff; cursor: pointer; -webkit-appearance: none; }
  .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #fff; border-radius: 50%; }

  .modal { position: absolute; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 100; color: white; }
  .modal-box { background: #181818; padding: 20px; border-radius: 20px; border: 1px solid #333; width: 100%; max-width: 400px; }
  .changelog { background: #111; padding: 0 12px; font-size: 11px; color: #999; margin: 12px 0; max-height: 200px; overflow-y: auto; border-radius: 10px; }
  .launcher-version { margin: 0; font-weight: 800; font-size: 16px; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  .uploader { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #999; }
  .uploader img { width: 22px; height: 22px; border-radius: 50%; border: 1px solid #252525; }

  ::-webkit-scrollbar { width: 2px; }
  ::-webkit-scrollbar-thumb { background: #333; }
</style>
