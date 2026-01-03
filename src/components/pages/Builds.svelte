<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { readTextFile, writeTextFile, writeFile, exists, BaseDirectory, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
  import { openPath } from '@tauri-apps/plugin-opener';
  import { join, appDataDir } from '@tauri-apps/api/path';
  import { fetch } from '@tauri-apps/plugin-http';
  import { invoke } from '@tauri-apps/api/core';
  import { myBuilds, config } from '$lib/stores.js';

  const API_URL = "https://лисяк.рф/launcher";
  const MOJANG_MANIFEST = "https://launchermeta.mojang.com/mc/game/version_manifest.json";

  let communityBuilds = [];
  let mcVersions = [];
  let activeTab = 'my';
  let selectedInstanceId = null;
  let selectedVersionId = null;
  let isSyncing = false;
  let isLoading = true;
  let syncProgress = "";
  let isEditing = false;

  let editData = { name: '', description: '', version: '', core: 'fabric' };

  onMount(async () => {
    try {
      await initFileSystem();
      await loadLocalBuilds();
      await fetchCommunityBuilds();
      await fetchMcVersions();
    } catch (e) {
      alert("Ошибка: " + e.message);
    } finally {
      isLoading = false;
    }
  });

  async function initFileSystem() {
    if (!(await exists('.', { baseDir: BaseDirectory.AppData }))) {
      await mkdir('.', { baseDir: BaseDirectory.AppData, recursive: true });
    }
    if (!(await exists('instances', { baseDir: BaseDirectory.AppData }))) {
      await mkdir('instances', { baseDir: BaseDirectory.AppData });
    }
  }

  async function fetchMcVersions() {
    try {
      const res = await fetch(MOJANG_MANIFEST);
      const data = await res.json();
      mcVersions = data.versions.filter(v => v.type === 'release').map(v => v.id);
    } catch (e) {
      mcVersions = ["1.21.11", "1.19.2", "1.18.2", "1.16.5"];
    }
  }

  async function loadLocalBuilds() {
    const folders = await readDir('instances', { baseDir: BaseDirectory.AppData });
    let loaded = [];
    for (const folder of folders) {
      const infoPath = await join('instances', folder.name, 'instance.json');
      if (await exists(infoPath, { baseDir: BaseDirectory.AppData })) {
        const rawInfo = await readTextFile(infoPath, { baseDir: BaseDirectory.AppData });
        const data = JSON.parse(rawInfo);
        loaded.push(await syncModsWithDisk(data));
      }
    }
    myBuilds.set(loaded);
  }

  async function syncModsWithDisk(build) {
    try {
      const modsPath = await join('instances', build.dirName, 'mods');
      if (!(await exists(modsPath, { baseDir: BaseDirectory.AppData }))) return build;

      const files = await readDir(modsPath, { baseDir: BaseDirectory.AppData });
      const jarFiles = files.filter(f => f.name.endsWith('.jar'));
      let updatedMods = [];

      for (const file of jarFiles) {
        const fullPath = await join(await appDataDir(), 'instances', build.dirName, 'mods', file.name);
        try {
          const meta = await invoke('get_mod_metadata', { path: fullPath });
          updatedMods.push({
            name: meta.name || file.name,
            fileName: file.name,
            description: meta.description || '',
            icon: meta.icon || null,
            version: meta.version || ''
          });
        } catch {
          updatedMods.push({ name: file.name, fileName: file.name });
        }
      }

      if (build.manifest && build.versions?.length > 0) {
        const lastVer = build.versions[build.versions.length - 1];
        const missing = lastVer.mods.some(m => m.sync !== false && !jarFiles.some(j => j.name === (m.fileName || m.name)));
        build.needsUpdate = missing;
      }

      if (!build.versions) build.versions = [];
      const currentVerName = build.manifest ? (build.versions[build.versions.length - 1]?.name || '1.0.0') : (build.currentVersion || '1.0.0');

      const vIndex = build.manifest ? (build.versions.length - 1) : 0;
      if (vIndex >= 0) {
        build.versions[vIndex] = { ...build.versions[vIndex], mods: updatedMods, name: currentVerName };
      } else {
        build.versions.push({ id: 'v1', name: currentVerName, mods: updatedMods });
      }

      return build;
    } catch { return build; }
  }

  async function fetchCommunityBuilds() {
    try {
      const response = await fetch(`${API_URL}/modpacks`);
      if (!response.ok) throw response;
      communityBuilds = await response.json();
      checkUpdates();
    } catch (e) { console.error(e); }
  }

  async function loadRemoteMods(item) {
    if (!item || !item.latestVersion || item.modsLoaded) return;
    try {
      const res = await fetch(`${API_URL}/modpacks/${item.id}-${item.latestVersion.id}`);
      if (!res.ok) return;
      const manifest = await res.json();
      const mods = manifest.map(m => ({
        name: m.path.split('/').pop().replace('\.jar', ''),
        fileName: m.path.split('/').pop(),
        description: m.path.includes('options.txt') ? 'Файл настроек' : 'Файл в каталоге'
      }));

      communityBuilds = communityBuilds.map(b => {
        if (b.id === item.id) {
          return { ...b, latestVersion: { ...b.latestVersion, mods }, modsLoaded: true };
        }
        return b;
      });
    } catch (e) { console.error(e); }
  }

  function checkUpdates() {
    myBuilds.update(list => list.map(local => {
      if (!local.manifest) return local;
      const remote = communityBuilds.find(r => r.id === local.sourceBuildId);
      if (remote && local.versions?.length > 0) {
        if (local.versions[local.versions.length - 1].id !== remote.latestVersion.id) {
          return { ...local, updateAvailable: remote.latestVersion };
        }
      }
      return { ...local, updateAvailable: null };
    }));
  }

  function transliterate(word) {
    const converter = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z',
      'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
      'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ь': '', 'ы': 'y', 'ъ': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', '-': '_'
    };
    let answer = '';
    for (let i = 0; i < word.length; ++i) {
      const char = word[i].toLowerCase();
      answer += converter[char] !== undefined ? converter[char] : word[i];
    }
    return answer.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  async function getUniqueDirName(name) {
    let base = transliterate(name) || "instance";
    let candidate = base;
    let counter = 1;
    while (true) {
      const existsInArr = $myBuilds.some(b => b.dirName === candidate);
      if (!existsInArr && !(await exists(await join('instances', candidate), { baseDir: BaseDirectory.AppData }))) return candidate;
      candidate = `${base}_${counter++}`;
    }
  }

  async function createCustomBuild() {
    const dirName = await getUniqueDirName("new_build");
    const instanceId = crypto.randomUUID();
    const newInstance = {
      instanceId,
      name: "Моя сборка",
      description: "Новая локальная сборка",
      game: { core: 'fabric', version: '1.21.11' },
      dirName,
      manifest: false,
      currentVersion: '1.0.0',
      versions: [{ id: 'local', name: '1.0.0', mods: [] }]
    };
    await mkdir(await join('instances', dirName), { baseDir: BaseDirectory.AppData, recursive: true });
    await mkdir(await join('instances', dirName, 'mods'), { baseDir: BaseDirectory.AppData, recursive: true });
    await saveInstanceInfo(newInstance);
    myBuilds.update(list => [...list, newInstance]);
    activeTab = 'my';
    selectInstance(instanceId);
  }

  async function addInstance(communityBuild) {
    const dirName = await getUniqueDirName(communityBuild.id);
    const instanceId = crypto.randomUUID();
    const newInstance = {
      instanceId,
      sourceBuildId: communityBuild.id,
      name: communityBuild.name,
      description: communityBuild.description,
      game: communityBuild.game,
      dirName,
      manifest: true,
      versions: [{ id: 'v_sync', name: 'Синхронизация...', mods: [] }],
      updateAvailable: communityBuild.latestVersion
    };
    await mkdir(await join('instances', dirName), { baseDir: BaseDirectory.AppData, recursive: true });
    await mkdir(await join('instances', dirName, 'mods'), { baseDir: BaseDirectory.AppData, recursive: true });
    await saveInstanceInfo(newInstance);
    myBuilds.update(list => [ ...list, newInstance ]);
    activeTab = 'my';
    selectInstance(instanceId);
  }

  const saveInstanceInfo = async instance => {
    if (!instance.dirName) {
      console.error('No dirName', instance.dirName)
    }
    await writeTextFile(await join('instances', instance.dirName, 'instance.json'), JSON.stringify(instance, null, 1), { baseDir: BaseDirectory.AppData });
  }

  function startEditing() {
    editData = {
      name: selectedItem.name,
      description: selectedItem.description,
      version: selectedItem.manifest ? (selectedVersion?.name || '') : (selectedItem.currentVersion || ''),
      core: selectedItem.game?.core || 'fabric',
      gameVersion: selectedItem.game?.version || '1.21.11'
    };
    isEditing = true;
  }

  async function saveEdit() {
  let updatedBuild = null;

  myBuilds.update(list => {
    return list.map(b => {
      if (b.instanceId === selectedItem.instanceId) {
        updatedBuild = {
          ...b,
          name: editData.name,
          description: editData.description,
          game: { core: editData.core, version: editData.gameVersion }
        };

        if (updatedBuild.manifest === false) {
          updatedBuild.currentVersion = editData.version;
          if (updatedBuild.versions && updatedBuild.versions[0]) {
            updatedBuild.versions[0].name = editData.version;
          }
        }
        return updatedBuild;
      }
      return b;
    });
  });

  if (updatedBuild) {
    try {
      await saveInstanceInfo(updatedBuild);
    } catch (e) {
      console.error("Ошибка при сохранении файла:", e);
      alert("Не удалось сохранить файл конфигурации");
    }
  }

  isEditing = false;
}

  async function deleteInstance(instance) {
    if (!await confirm(`Удалить сборку "${instance.name}"?`)) return;
    await remove(await join('instances', instance.dirName), { baseDir: BaseDirectory.AppData, recursive: true });
    myBuilds.update(list => list.filter(b => b.instanceId !== instance.instanceId));
    selectInstance(null);
  }

  async function openInstanceFolder() {
    if (!selectedItem || !selectedItem.dirName) return;
    const path = await join(await appDataDir(), 'instances', selectedItem.dirName);
    await openPath(path);
  }

  async function runSync(build) {
    if (isSyncing) return;
    isSyncing = true;

    const initial = selectedItem.versions.length === 1;
    console.log(initial ? 'Initial syncing...' : 'Resyncing...')

    try {
      const update = build.updateAvailable || build.versions[build.versions.length-1];
      const res = await fetch(`${API_URL}/modpacks/${build.sourceBuildId}-${update.id}`);
      const manifest = await res.json();
      for (const file of manifest) {
        const fileName = file.path.split('/').pop();
        if (file.sync === false && !initial) continue; // skipping options.txt if modpack was already installed, yes
        const relPath = await join('instances', build.dirName, ...file.path.split('/'));
        let download = true;
        if (await exists(relPath, { baseDir: BaseDirectory.AppData })) {
          const hash = await invoke('get_file_sha256', { path: await join(await appDataDir(), relPath) });
          if (hash === file.sha256) download = false;
        }
        if (download) {
          syncProgress = `Загрузка: ${fileName}`;
          const fResp = await fetch(file.urls[0]);
          await writeFile(relPath, new Uint8Array(await fResp.arrayBuffer()), { baseDir: BaseDirectory.AppData });
        }
      }
      if (build.updateAvailable) {
        build.versions.push({ id: update.id, name: update.name, mods: [] });
        build.updateAvailable = null;
      }
      build.needsUpdate = false;
      const synced = await syncModsWithDisk(build);
      myBuilds.update(l => l.map(b => b.instanceId === build.instanceId ? synced : b));
      await writeTextFile(await join('instances', build.dirName, 'instance.json'), JSON.stringify(synced, null, 1), { baseDir: BaseDirectory.AppData });
    } catch (e) { alert(e); } finally { isSyncing = false; syncProgress = ""; }
  }

  function selectInstance(id) {
    selectedInstanceId = id;
    config.update(c => ({ ...c, lastInstanceId: id }));
  }

  $: if (activeTab === 'community' && selectedItem && !selectedItem.modsLoaded) {
    loadRemoteMods(selectedItem);
  }

  $: availableList = activeTab === 'my' ? $myBuilds : communityBuilds;
  $: selectedItem = activeTab === 'my' ? $myBuilds.find(b => b.instanceId === selectedInstanceId) : communityBuilds.find(b => b.id === selectedInstanceId);
  $: selectedVersion = activeTab === 'my' && selectedItem ? (selectedItem.versions?.find(v => v.id === selectedVersionId) || selectedItem.versions?.[selectedItem.versions.length - 1]) : (selectedItem?.latestVersion || selectedItem?.versions?.[0]);
  $: versionTag = !selectedItem?.game ? '' : (selectedItem.game.core + ' ' + selectedItem.game.version);

  function ucase(text) {
    return text?.[0]?.toUpperCase() + text?.slice(1);
  }
</script>

<div class="builds-page">
  <aside class="sidebar">
    <nav class="tabs">
      <button class:active={activeTab === 'my'} on:click={() => { activeTab = 'my'; selectedInstanceId = null; }}>Мои</button>
      <button class:active={activeTab === 'community'} on:click={() => { activeTab = 'community'; selectedInstanceId = null; }}>Каталог</button>
    </nav>

    <div class="list-container">
      {#each availableList as item}
        <div class="build-card" class:active={(activeTab === 'my' ? item.instanceId : item.id) === selectedInstanceId}
             on:click={() => { selectedInstanceId = activeTab === 'my' ? item.instanceId : item.id; isEditing = false; }}>
          <div class="card-header">
            <span class="name">{item.name}</span>
            <span class="game-badge">{item.game?.version}</span>
          </div>
          <div class="card-footer">
            {#if activeTab === 'my'}
               <span class="core-tag {item.game?.core}">{ucase(item.game?.core)}</span>
               <div class="indicators">
                {#if item.manifest === false}<span class="local-label">LOCAL</span>{/if}
                {#if item.updateAvailable || item.needsUpdate}<span class="upd-label">!</span>{/if}
               </div>
            {:else}
               <span class="author">от {item.author}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {#if activeTab === 'my'}
      <button class="create-btn" on:click={createCustomBuild}>+ Создать сборку</button>
    {/if}
  </aside>

  <main class="content">
    {#if selectedItem}
      <div class="content-settings-scroll">
        <header class="content-header">

          { #if isEditing }

           <div class="title-row">
            <div class="title-wrap">
               {#if selectedItem.icon}<img src={selectedItem.icon} alt="" class="build-header-icon" />{/if}
               <div class="header-text">
                  <input class="edit-input" bind:value={editData.name} />
               </div>
            </div>

            <div class="actions">
                <button class="icon-btn save" on:click={saveEdit}><img src="icons/save.svg"/></button>
            </div>
          </div>

          <textarea class="edit-area" bind:value={editData.description}></textarea>
          <div class="edit-grid">
            <div class="field">Версия игры:
              <select bind:value={editData.gameVersion}>
                {#each mcVersions as v}<option value={v}>{v}</option>{/each}
              </select>
            </div>
            <div class="field">Ядро:
              <select bind:value={editData.core}>
                <option value="fabric">Fabric</option>
                <option value="vanilla">Vanilla</option>
              </select>
            </div>
            {#if selectedItem.manifest === false}
              <div class="field">Версия сборки: <input class="small-input" bind:value={editData.version} /></div>
            {/if}
          </div>

          { :else }

           <div class="title-row">
            <div class="title-wrap">
               {#if selectedItem.icon}<img src={selectedItem.icon} alt="" class="build-header-icon" />{/if}
               <div class="header-text">
                    <h1>{selectedItem.name}</h1>
                    <span class="version-tag">{versionTag}</span>
               </div>
            </div>
            <div class="actions">
              {#if activeTab === 'my'}
                  <button class="icon-btn" on:click={startEditing}><img src="icons/edit.svg"/></button>
                  <button class="icon-btn" on:click={openInstanceFolder}><img src="icons/folder.svg"/></button>
                  <button class="icon-btn del" on:click={() => deleteInstance(selectedItem)}><img src="icons/delete.svg"/></button>
              {:else}
                  <button class="add-btn" on:click={() => addInstance(selectedItem)}>УСТАНОВИТЬ</button>
              {/if}
            </div>
          </div>

          <p class="description">{selectedItem.description}</p>

          {#if activeTab === 'my' && (selectedItem.updateAvailable || selectedItem.needsUpdate)}
            <div class="update-banner">
              <div class="upd-text">
                <strong>{selectedItem.needsUpdate ? 'Требуется синхронизация' : 'Доступно обновление: ' + selectedItem.updateAvailable.name}</strong>
              </div>
              <button class="sync-btn" disabled={isSyncing} on:click={() => runSync(selectedItem)}>{isSyncing ? syncProgress : 'ОБНОВИТЬ'}</button>
            </div>
          {/if}

          { /if }
        </header>
      </div>

      <section class="mods-viewer" style="{isEditing ? 'padding-top: 0' : ''}">
        <h3>Моды ({selectedVersion?.mods?.length || 0})</h3>
        <div class="mods-list">
          {#if selectedVersion?.mods?.length > 0}
            {#each selectedVersion.mods as mod}
              <div class="mod-item" in:fade={{ duration: 200 }}>
                <div class="mod-main">
                  {#if mod.icon}
                    <img src={mod.icon} alt="" class="mod-icon" />
                  {:else}
                    <div class="mod-icon-placeholder"></div>
                  {/if}
                  <div class="mod-info">
                    <span class="m-name">{mod.name}</span>
                    <span class="m-desc">{mod.description || mod.fileName}</span>
                  </div>
                </div>
                {#if mod.version}<span class="m-ver">{mod.version}</span>{/if}
              </div>
            {/each}
          {:else if activeTab === 'community' && !selectedItem.modsLoaded}
            <div class="empty">Загрузка списка модов...</div>
          {:else}
            <div class="empty">Нет модов.</div>
          {/if}
        </div>
      </section>
    {:else}
      <div class="empty-state">Выберите сборку</div>
    {/if}
  </main>
</div>

<style>
  :root {
    --bg-main: #0d0d0d;
    --bg-sidebar: #141414;
    --bg-card: #1e1e1e;
    --bg-card-active: #232d23;
    --bg-input: #1a1a1a;
    --accent: #4CAF50;
    --accent-hover: #45a049;
    --blue: #3b5da7;
    --blue-hover: #4a6ebf;
    --text-main: #ffffff;
    --text-dim: #a0a0a0;
    --text-hint: #666666;
    --border: #2a2a2a;
    --danger: #9e3a3a;
    --upd-bg: #ff5577;
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-color: #222;
    color: #fff;
  }

  .builds-page {
    display: flex;
    width: 95%;
    max-width: 900px;
    height: 84vh;
    margin: 0 auto;
    margin-bottom: 20px;
    background: var(--bg-main);
    color: var(--text-main);
    border-radius: 12px;
    border: 1px solid var(--border);
    overflow: hidden;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background: var(--bg-main);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    color: var(--text-main);
    font-size: 1.2rem;
  }

  .sidebar {
    width: 280px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    padding: 20px;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 8px;
    background: #000;
    padding: 5px;
    border-radius: 10px;
    margin-bottom: 20px;
  }

  .tabs button {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-dim);
    padding: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border-radius: 7px;
    transition: all 0.2s ease;
  }

  .tabs button.active {
    background: var(--bg-card);
    color: var(--text-main);
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  .list-container {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .build-card {
    background: var(--bg-card);
    padding: 15px;
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: border 0.2s, background 0.2s;
    flex-shrink: 0;
  }

  .build-card.active {
    border-color: var(--accent);
    background: var(--bg-card-active);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .name {
    font-weight: 700;
    font-size: 14px;
    color: var(--text-main);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .game-badge {
    font-size: 10px;
    background: #333;
    color: #ccc;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: var(--text-dim);
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-main);
  }

  .content-settings-scroll {
    overflow-y: auto;
    flex-shrink: 0;
    max-height: 45%;
    border-bottom: 1px solid var(--border);
    padding: 30px 40px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    gap: 20px;
  }

  .title-wrap {
    display: flex;
    align-items: center;
    gap: 15px;
    flex: 1;
  }

  .build-header-icon {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    background: var(--bg-card);
    object-fit: cover;
  }

  .header-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  h1 {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
    color: var(--text-main);
  }

  .version-tag {
    background: var(--blue);
    color: white;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    width: fit-content;
  }

  .description {
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 20px;
  }

  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .content-header {
    position: relative;
  }

  .edit-actions {
    align-self: flex-end;
    margin: 10px 10px 0 0;
  }

  .icon-btn {
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-main);
    padding: 7px 7px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 35px;
    width: 35px;
  }

  .icon-btn.save { background: var(--blue); }
  .icon-btn.del:hover { background: var(--danger); }

  .add-btn {
    background: var(--accent);
    color: white;
    border: none;
    padding: 0 18px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    height: 38px;
    display: inline-flex;
    align-items: center;
  }

  .edit-input {
    background: var(--bg-input);
    border: 1px solid var(--blue);
    color: var(--text-main);
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 20px;
    font-weight: 700;
    width: 260px;
  }

  .edit-area {
    background: var(--bg-input);
    border: 1px solid var(--border);
    color: var(--text-main);
    padding: 12px;
    border-radius: 8px;
    width: 100%;
    height: 100px;
    resize: none;
    margin-bottom: 15px;
    font-size: 13px;
  }

  .edit-grid {
    display: flex;
    gap: 15px;
    background: #121212;
    padding: 15px;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .field { display: flex; flex-direction: column; gap: 5px; font-size: 11px; color: var(--text-hint); font-weight: 700; }
  .field select, .small-input { background: #000; border: 1px solid var(--border); color: #fff; padding: 6px; border-radius: 4px; font-size: 13px; }

  .update-banner {
    background: rgba(59, 93, 167, 0.1);
    border: 1px solid var(--blue);
    padding: 15px;
    border-radius: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
  }

  .sync-btn { background: var(--blue); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; }

  .mods-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 20px 40px;
  }

  .mods-viewer h3 { font-size: 11px; color: var(--text-hint); text-transform: uppercase; margin-bottom: 12px; }

  .mods-list {
    background: #080808;
    border-radius: 12px;
    padding: 5px;
    overflow-y: auto;
    flex: 1;
    border: 1px solid var(--border);
  }

  .mod-item { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #141414; }
  .mod-main { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
  .mod-icon { width: 34px; height: 34px; border-radius: 6px; background: #1a1a1a; flex-shrink: 0; }
  .mod-icon-placeholder { width: 34px; height: 34px; border-radius: 6px; background: #1a1a1a; flex-shrink: 0; border: 1px solid #222; }
  .mod-info { display: flex; flex-direction: column; min-width: 0; }
  .m-name { color: #eee; font-weight: 600; font-size: 13px; }
  .m-desc { color: #555; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .m-ver { color: var(--blue); font-size: 11px; background: rgba(59, 93, 167, 0.1); padding: 2px 6px; border-radius: 4px; }

  .empty { text-align: center; color: var(--text-hint); margin-top: 20px; font-size: 13px; }
  .empty-state { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-hint); }
  .create-btn {
  flex-shrink: 0;
  margin-top: 15px; background: transparent; border: 1px dashed var(--text-hint); color: var(--text-dim); padding: 10px; border-radius: 8px; cursor: pointer; font-size: 12px; }
  .local-label { font-size: 9px; color: var(--text-hint); border: 1px solid var(--border); padding: 1px 4px; border-radius: 3px; }
  .upd-label { background: var(--upd-bg); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; }
  .core-tag.fabric { color: #f1c40f; font-size: 10px; font-weight: 800; }
  .indicators { display: flex; gap: 5px; align-items: center; }
</style>
