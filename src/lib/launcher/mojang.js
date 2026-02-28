import { fetch } from '@tauri-apps/plugin-http';
import { arch, platform } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir, writeTextFile, readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event'
import { config } from '$lib/stores'
import { get } from 'svelte/store';

export async function getManifest(versionId, instanceDir) {
    const path = await join('versions', `${versionId}.json`);

    if (await exists(path, { baseDir: BaseDirectory.AppData })) {
        const content = await readTextFile(path, { baseDir: BaseDirectory.AppData })
        return JSON.parse(content);
    }

    const res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
    const list = await res.json();
    const versionEntry = list.versions.find(v => v.id === versionId);

    const manifestRes = await fetch(versionEntry.url);
    const manifest = await manifestRes.json();

    if (!(await exists('versions', { baseDir: BaseDirectory.AppData }))) {
        await mkdir('versions', { baseDir: BaseDirectory.AppData });
    }

    await writeTextFile(path, JSON.stringify(manifest), { baseDir: BaseDirectory.AppData });
    return manifest;
}

export const checkLibraries = async (manifest, setScreenBlocker) => {
    const list = manifest.libraries
    const libPath = get(config).libraryPath || (await appDataDir() + "/libraries/")

    const [ _type, _arch ] = [ await platform(), await arch() ]
    console.log('Type / arch:', _type, _arch)

    const __type = {'linux':'(linux)','windows':'(windows)','macos':'(macos|osx)'}[_type];

    const __arch = {
        'x86':'(x86)',
        'x86_64':'(x86_64)',
        'arm':'(arm|arm64)',
        'aarch64':'(aarch64)'
    }[_arch] || _arch;

    // Некоторые нативные либы не имеют приписанной архитектуры
    const nativeRegex = new RegExp(`((${__type}-${__arch})|(${__type}))\\.jar$`);
    const typeRegex = new RegExp(__type);

    console.log('Constructed native regex: ' + nativeRegex)

    setScreenBlocker(`Проверка библиотек Mojang`)

    const libs = []
    const natives = []

    let counter = 0

    const entriesForDownloader = {}

    console.log(list)

    for (const lib of list) {
        const isNative = lib.name.match('native') && lib.rules || lib.natives;

        // На старых версиях, для нативов вместо artifact - classifier

        let artifact = lib.downloads.artifact;

        if (!artifact) {
            const keys = Object.keys(lib.downloads.classifiers);
            const key = keys.find(x => x.match(typeRegex));
            artifact = lib.downloads.classifiers[key];
            console.log('CLASSIFIER', artifact, key, typeRegex)
        }

        if (!artifact) continue;

        const split = lib.name.split(':')
        const name = split[1] + '-' + split[2] + (isNative ? "-native" : "") + '.jar' // name + version

        const path = libPath + split[0].replace(/\./g,"/") + "/" + split[1] + "/" + split[2] + "/" + name

        if (isNative) {
            console.log('Checking native:\n' + artifact.path + "\nPath: " + path)
            if (!artifact.path.match(nativeRegex)) {
                continue;
            }
            natives.push(path)
        }
        else {
            libs.push({ path: path, name: split[1] })
        }

        if (await invoke('exists', { path })) {
            const comparison = await invoke("get_file_sha1", { path, hash: artifact.sha1 })

            console.log(comparison + ' | checked: ' + path)

            if (comparison === 'true') continue
            console.log(path + " - Detected corruption! (sha1)")
        }

        entriesForDownloader[artifact.url] = path
    }

    let downloaded = 0;
    let total_count = Object.keys(entriesForDownloader).length
    console.log(entriesForDownloader, total_count)

    const unlisten = await listen('downloaded', (event) => {
        downloaded++
        setScreenBlocker(`Скачано библиотек: ${downloaded} (${(100/total_count*downloaded).toFixed(1)}%)`)
    })

    try {
        const response = await invoke("download_many", { urls: entriesForDownloader })
        if (!response) return null
    } catch (err) {
        throw err
    } finally {
        unlisten()
    }

    console.log('downloaded!')

    return [ libs, natives ]
}

export const checkAssets = async(manifest, setScreenBlocker) => {
    setScreenBlocker(`Проверка ресурсов`)
    const dir = get(config).assetsPath || (await appDataDir() + '/assets');
    const indexesDir = dir + "/indexes/"
    const objectsDir = dir + "/objects/"

    const indexPath = indexesDir + manifest.assets + ".json"

    if (!await invoke('exists', { path: indexPath })) {
        const data = await getJSON(manifest.assetIndex.url)
        await invoke('mkdir', { path: indexesDir })
        await invoke('write_text_file', { path: indexPath, data: JSON.stringify(data, null, 2) })
    }

    const index = JSON.parse(await invoke('read_text_file', { path: indexPath }))

    try {
        await invoke('mkdir', { path: objectsDir })
    } catch (e) {}

    const entriesForDownloader = {}
    const assetList = Object.values(index.objects)
    const paths = []

    for (let asset of assetList) {
        const name = asset.hash.slice(0, 2) + '/' + asset.hash
        const path = objectsDir + name
        paths.push(name)
    }

    let entries
    try {
        entries = await invoke("get_not_installed", { objectsDir, paths })
        console.log(entries)
    } catch(e) {
        console.log(e)
        throw e
    }

    entries.forEach(name => {
        const url = "https://resources.download.minecraft.net/" + name
        entriesForDownloader[url] = objectsDir + name
    })

    let total_count = Object.keys(entriesForDownloader).length
    let downloaded = 0

    const unlisten = await listen('downloaded', (event) => {
        downloaded++
        setScreenBlocker(`Скачано текстур и звуков: ${downloaded} (${(100/total_count*downloaded).toFixed(1)}%)`)
    })

    try {
        const response = await invoke("download_many", { urls: entriesForDownloader })
        if (response !== 'true') return null
    } catch (err) {
        throw err
    } finally {
        unlisten()
    }

    return dir
}

export const checkClient = async(manifest, instanceDir, build, libs, setScreenBlocker) => {
    const client = manifest.downloads.client

    const { url, sha1 } = client

    const isForge = build.game.core === "forge";

    let clientDir; /* 1.1.0: if it's forge, client jar will be modified, so must separate it */
    if (isForge) {
        clientDir = instanceDir + "/forge/versions/" + manifest.id + "/"
    }
    else {
        clientDir = await appDataDir() + "/versions/" + manifest.id + "/"
    }

    const path = clientDir + manifest.id + ".jar"

    if (await invoke('exists', { path })) {
        const comparison = await invoke("get_file_sha1", { path, hash: sha1 })
        console.log(comparison + ' | checked: ' + path.slice(-30))
        if (comparison === 'true') {
            if (!isForge) libs.push({ path, name: 'client' })
            return true
        }
        console.log("Corrupted!")
    } else invoke('mkdir', { path: clientDir })

    const unlisten = await listen('progress', (event) => {
        const { downloaded, total_size } = event.payload

        setScreenBlocker(`Скачано игры: ${(downloaded / 1024 / 1024).toFixed(2)}Mb (${Math.ceil(100/total_size*downloaded)}%)`)
    });

    try {
        const response = await invoke("large_download", { path, url })
        if(response !== 'true') return path
    } catch (err) {
        throw err
    } finally {
        unlisten()
    }

    if (!isForge) libs.push({ path, name: 'client' })

    return true
}

export const unpackNatives = async (natives, instanceDir, setScreenBlocker) => {
    const nativeDir = instanceDir + "/natives/"
    await invoke('mkdir', { path: nativeDir })

    let i = 0

    for (let n of natives) {
        i++
        setScreenBlocker(`Распаковка ${i}/${natives.length}`)

        await invoke('unpack', { from: n, to: nativeDir })
    }

    return nativeDir
}

const getJSON = async (url) => {
    return await ( await fetch(url, { method: 'GET', timeout: 15 }) ).json()
}




















