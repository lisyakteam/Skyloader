<script>
  import { config } from '$lib/stores.js';
  import { invoke } from '@tauri-apps/api/core';
  import { getVersion } from '@tauri-apps/api/app';
  import { open } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import { checkOrInstallJava } from '$lib/launcher/java.js';
  import { openPath, openUrl } from '@tauri-apps/plugin-opener';
  import { fly } from 'svelte/transition';

  let totalSystemRam = 16384;
  let appVersion = "1.0.0";
  let isJavaValid = false;
  let showUpdateModal = false;
  let updateData = { tag: '', body: '' };

  onMount(async () => {
    totalSystemRam = await invoke('get_total_ram');
    appVersion = await getVersion();

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
      isJavaValid = await invoke('check_java_version', { path: $config.javaPath });
    } else {
      isJavaValid = false;
    }
  }

  async function handleInstallJava() {
    const success = await checkOrInstallJava();
    if (success) await validateJava();
  }

  async function selectJavaPath() {
    const selected = await open({
      directory: false,
      multiple: false
    });
    if (selected) {
      $config.javaPath = selected;
      saveConfigToDisk();
      await validateJava();
    }
  }

  let showSuccessToast = false;

  async function checkUpdates() {
    try {
      const res = await fetch('https://api.github.com/repos/lisyakteam/skyloader/releases/latest');
      const data = await res.json();

      if (data.tag_name !== appVersion) {
        updateData = { tag: data.tag_name, url: data.html_url, body: data.body };
        showUpdateModal = true;
      } else {
        showSuccessToast = true;
        setTimeout(() => {
          showSuccessToast = false;
        }, 3000);
      }
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="profiles-container">

  <div class="settings-content">
    <div class="setting-row">
      <div class="info">
        <div class="label-group">
          <span class="label">Java Runtime</span>
          <button class="folder-btn" on:click={selectJavaPath}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>
        <span class="path-text">{$config.javaPath || 'Автопоиск не удался'}</span>
      </div>

      {#if !isJavaValid}
        <button class="btn btn-blue" on:click={handleInstallJava}>Установить</button>
      {:else}
        <button class="btn btn-success" disabled>Используется</button>
      {/if}
    </div>

    <div class="setting-row">
      <div class="info">
        <span class="label">Версия SkyLoader</span>
        <span class="path-text">Проверка новых релизов</span>
      </div>
      <button class="btn btn-gray" on:click={checkUpdates}>Обновить</button>
    </div>

    <div class="setting-row vertical">
      <div class="info-row">
        <span class="label">Память (RAM)</span>
        <span class="value">{$config.ram || 4096} / {totalSystemRam} MB</span>
      </div>
      <input type="range" min="1024" max={totalSystemRam} step="512" bind:value={$config.ram} on:change={saveConfigToDisk} class="slider"/>
    </div>

    <div class="setting-row">
      <div class="info">
        <span class="label">Каталог модпаков</span>
      </div>
      <button class="btn toggle-btn" class:active={$config.disableCatalog} on:click={() => { $config.disableCatalog = !$config.disableCatalog; saveConfigToDisk(); }}>
        {$config.disableCatalog ? 'Скрыт' : 'Отображается'}
      </button>
    </div>
  </div>

  {#if showUpdateModal}
    <div class="modal">
      <div class="modal-box">
        <h3>Версия v{updateData.tag}</h3>
        <div class="changelog">{updateData.body || ''}</div>
        <div class="modal-btns">
          <button class="btn btn-blue" on:click={() => openUrl(updateData.url)}>Загрузить</button>
          <button class="btn btn-gray" on:click={() => showUpdateModal = false}>Позже</button>
        </div>
      </div>
    </div>
  {/if}

  {#if showSuccessToast}
    <div
      transition:fly={{ y: 20, duration: 300 }}
      class="toast-notification"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Обновлений не найдено
    </div>
  {/if}
</div>

<style>
  .profiles-container {
    color: #fff;
    background: #181818;
    width: 90%;
    height: 80%;
    border-radius: 20px;
    border: 1px solid #333;
    display: flex;
    flex-direction: column;
    padding: 35px;
    box-sizing: border-box;
    position: relative;
  }

  .settings-header { margin-bottom: 10px; }
  .header-main { display: flex; align-items: baseline; gap: 12px; }
  .header-main h2 { margin: 0; font-size: 26px; }
  .v-label { color: #444; font-size: 14px; font-weight: 600; }

  .settings-content { display: flex; flex-direction: column; gap: 14px; }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: #202020;
    border-radius: 16px;
    border: 1px solid #282828;
  }

  .toast-notification {
    position: absolute;
    bottom: 25px;
    right: 25px;
    background: #1a2a1d;
    color: #4caf50;
    border: 1px solid #243a28;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
    z-index: 100;
  }


  .setting-row.vertical { flex-direction: column; align-items: stretch; gap: 14px; }
  .label-group { display: flex; align-items: center; gap: 10px; }
  .label { font-size: 14px; font-weight: 600; }
  .path-text { font-size: 12px; color: #666; max-width: 250px; overflow: hidden; text-overflow: ellipsis; }

  .folder-btn {
    background: none; border: none; color: #007aff; cursor: pointer;
    display: flex; padding: 4px; border-radius: 4px;
  }
  .folder-btn:hover { background: #2a2a2a; }

  .btn { padding: 10px 18px; border-radius: 10px; border: none; cursor: pointer; font-size: 13px; font-weight: 700; }
  .btn-blue { background: #007aff; color: #fff; }
  .btn-gray { background: #2a2a2a; color: #aaa; }
  .btn-success { background: #1a2a1d; color: #4caf50; border: 1px solid #243a28; }
  .btn:disabled { cursor: default; }

  .toggle-btn { background: #2a2a2a; color: #fff; min-width: 130px; }
  .toggle-btn.active { background: #351a1a; color: #ff5555; border: 1px solid #4a2525; }

  .slider {
    width: 100%; height: 10px; background: #2a2a2a; border-radius: 5px;
    accent-color: #007aff; cursor: pointer; -webkit-appearance: none;
  }
  .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; background: #fff; border-radius: 50%; }

  .modal { position: absolute; inset: 0; background: #000000f0; display: flex; align-items: center; justify-content: center; z-index: 50; }
  .modal-box { background: #181818; padding: 25px; border-radius: 20px; border: 1px solid #333; width: 300px; text-align: center; }
  .changelog { background: #111; padding: 10px; border-radius: 10px; font-size: 12px; color: #777; margin: 15px 0; max-height: 80px; overflow-y: auto; }

  .blocker { position: absolute; inset: 0; background: #000000cc; display: flex; align-items: center; justify-content: center; z-index: 100; }
  .spinner { width: 24px; height: 24px; border: 3px solid #333; border-top-color: #007aff; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
