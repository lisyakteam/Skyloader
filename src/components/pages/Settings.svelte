<script>
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { openPath, openUrl } from '@tauri-apps/plugin-opener';
  import { fly } from 'svelte/transition';
  import { fade, scale } from 'svelte/transition';

  import { config } from '$lib/stores.js';
  import { checkOrInstallJava } from '$lib/launcher/java.js';
  import { appVersion, fetchUpdate } from '$lib/utils/updater.js';
  import { showToast } from '$lib/utils/toasts.js';

  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  let totalSystemRam = 16384;
  let isJavaValid = false;
  let updateData = { tag: '', body: '' };
  let showUpdateModal = false;
  let javaVersion = null

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
      console.log(javaVersion)
      isJavaValid = javaVersion && +javaVersion.slice(0, 2) >= 25

      if (javaVersion) {
        if (+javaVersion.slice(0, 2) < 25)
            showToast("Нужна Java 25 и выше, у вас — " + javaVersion + "!", "error");
      }
      else showToast("Не удалось найти Java, укажите путь в настройках!", "error");
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

  async function checkUpdates() {
    const update = await fetchUpdate();

    if (update.tag_name !== get(appVersion)) {
      showUpdateModal = true;
      updateData = update;
    }
    else showToast('Обновлений не найдено!')
  }

  function openRelease(url) {
    showUpdateModal = false;
    openUrl(url);
  }
</script>

<div class="profiles-container">

  <div class="settings-content">
    <div class="setting-row">
      <div class="info">
        <div class="label-group">
          <span class="label">Java Runtime { javaVersion || "не определена" }</span>
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

    <div class="setting-row">
      <div class="info">
        <span class="label">Текущая версия: { $appVersion }</span>
      </div>
      <button class="btn btn-gray" on:click={checkUpdates}>Проверить обновления</button>
    </div>
  </div>

  {#if showUpdateModal}
    <div
    transition:fade={{duration: 100}}
    class="modal">
      <div class="modal-box">
        <p class="launcher-version">Обновленная версия</p>
        <div class="changelog">
          {@html renderedChangelog}
        </div>
        <div class="row">
        <div class="uploader">
          <img src={updateData.author.avatar_url}/>
          <a>@{updateData.author.login}</a>
        </div>
        <div class="modal-btns">
          <button class="btn btn-blue" on:click={() => openRelease(updateData.html_url)}>Перейти на сайт</button>
          <button class="btn btn-gray" on:click={() => showUpdateModal = false}>Позже</button>
        </div>
        </div>
      </div>
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

  .modal { position: absolute; inset: 0; background: #00000090; display: flex; align-items: center; justify-content: center; z-index: 50; }
  .modal-box { background: #181818; padding: 10px 0; border-radius: 15px; border: 1px solid #333; width: 450px; text-align: center; }
  .modal-btns {
    display: flex;
    justify-content: end;
    gap: 10px;
    margin: 10px;
  }
  .changelog { background: #111; padding: 0 20px; font-size: 12px; color: #ccc; margin: 20px 0; max-height: 200px; text-align: initial; overflow-y: auto; }
  .launcher-version {
    margin: 0;
    margin-top: 10px;
    font-weight: 700;
  }
  .row {
    display: flex;
    flex-direction: row;
    width: 100%;
    flex: 1;
    justify-content: space-between;
  }
  .uploader {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: 12px;
    cursor: pointer;
  }
  .uploader img {
    width: 32px;
    border-radius: 50%;
  }

  .blocker { position: absolute; inset: 0; background: #000000cc; display: flex; align-items: center; justify-content: center; z-index: 100; }
  .spinner { width: 24px; height: 24px; border: 3px solid #333; border-top-color: #007aff; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
