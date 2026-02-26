import { fetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';
import { exists, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { get } from 'svelte/store';

import { config, accounts, myBuilds } from '$lib/stores.js';

const MAVEN_URL = "https://maven.fabricmc.net/";
const FABRIC_META = "https://meta.fabricmc.net/v2/versions/loader/";

const getJSON = async (url) => {
    const res = await fetch(url, { method: 'GET', connectTimeout: 15000 });
    return await res.json();
};

export const checkLibraries = async (setScreenBlocker, libs, build) => {
    setScreenBlocker(`Проверка библиотек Fabric`);

    const appDir = await appDataDir();
    const libPath = "libraries";

    const fmetaURL = `${FABRIC_META}${build.game.version}`;
    const data = await getJSON(fmetaURL);

    let stable;
    if (!build.game.coreVer) stable = data[0];
    else {
        const loader = data.find(x => x.loader.version === build.game.coreVer)
        if (loader) stable = loader;
        else stable = data[0];
    }

    const fabricLibs = [
        ...stable.launcherMeta.libraries.common,
        stable.intermediary,
        stable.loader
    ];

    const jars = [];
    const entriesForDownloader = {};

    for (let lib of fabricLibs) {
        const nameParts = (lib.name ?? lib.maven).split(':');
        const [group, artifact, version] = nameParts;

        const filename = `${artifact}-${version}.jar`;
        const subPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${filename}`;
        const fullRelPath = await join(libPath, subPath);

        jars.push({ path: await join(appDir, fullRelPath), name: artifact });

        if (await exists(fullRelPath, { baseDir: BaseDirectory.AppData })) {
            continue;
        }

        const url = `${MAVEN_URL}${subPath}`;
        entriesForDownloader[url] = await join(appDir, fullRelPath);
    }

    if (Object.keys(entriesForDownloader).length > 0) {
        await invoke("download_many", { urls: entriesForDownloader });
    }

    for (const jar of jars) {
        const index = libs.findIndex(x => x.name === jar.name);
        if (index !== -1) libs.splice(index, 1);
        libs.push(jar);
    }
};

const cachedVersion = {
    id: null
}

export const getLoaderVersions = async gameVersion => {
    if (cachedVersion.id === gameVersion) return cachedVersion.data;

    const fmetaURL = `${FABRIC_META}${gameVersion}`;
    const data = await getJSON(fmetaURL);

    cachedVersion.id = gameVersion;
    cachedVersion.data = data;

    return data;
}


