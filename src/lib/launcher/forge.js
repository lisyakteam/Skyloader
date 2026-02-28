import { fetch } from '@tauri-apps/plugin-http';
import { invoke } from '@tauri-apps/api/core';
import { exists, mkdir, BaseDirectory, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { get } from 'svelte/store';
import { config } from '$lib/stores.js';

const FORGE_MAVEN = "https://maven.minecraftforge.net/net/minecraftforge/forge/";

const FORGE_PROMOTIONS = "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json";
const BMCLAPI_FORGE = "https://bmclapi2.bangbang93.com/forge/minecraft/";

export const checkLibraries = async (setScreenBlocker, instanceDir, libs, build) => {
    const appDir = await appDataDir();
    const mcVersion = build.game.version;
    const forgeVersion = build.game.coreVer;
    const fullVersion = `${mcVersion}-${forgeVersion}`;
    const minecraftDir = instanceDir + "/forge";

    const versionPath = `${mcVersion}-forge-${forgeVersion}`;
    const forgeJsonPath = `${minecraftDir}/versions/${versionPath}/${versionPath}.json`;

    const profilesPath = minecraftDir + "/launcher_profiles.json";

    if (!await exists(profilesPath, { baseDir: BaseDirectory.AppData })) {
        const dummyProfiles = {
            profiles: {},
            settings: {
                crashAssistance: true,
                enableAdvanced: true
            },
            launcherVersion: {
                name: "0.0.0",
                format: 21
            }
        };

        await writeTextFile(profilesPath, JSON.stringify(dummyProfiles), { baseDir: BaseDirectory.AppData });
    }

    if (!await exists(forgeJsonPath, { baseDir: BaseDirectory.AppData })) {
        setScreenBlocker("Загрузка инсталлятора Forge...");

        const installerName = `forge-${fullVersion}-installer.jar`;
        const installerUrl = `${FORGE_MAVEN}${fullVersion}/${installerName}`;

        if (!await exists("cache/forge", { baseDir: BaseDirectory.AppData })) {
            await mkdir("cache/forge", { baseDir: BaseDirectory.AppData, recursive: true });
        }

        const tempDir = await join(appDir, "cache/forge");
        const installerPath = await join(tempDir, installerName);

        await invoke("download_many", { urls: { [installerUrl]: installerPath } });

        setScreenBlocker("Запуск установки Forge...");
        const os = await platform();
        const file_type = os === 'windows' ? '.bat' : '.sh';
        const java = get(config).javaPath;

        const installCmd = `"${java}" -jar "${installerPath}" --installClient "${minecraftDir}"`;
        const installScriptPath = await join(tempDir, "install_forge" + file_type);

        await invoke('write_executable', { path: installScriptPath, data: installCmd });

        const success = await invoke('execute', { path: installScriptPath });

        if (!success) {
            throw new Error("Инсталлятор Forge завершился с ошибкой. Проверьте логи в папке forge.");
        }

        if (!await exists(forgeJsonPath, { baseDir: BaseDirectory.AppData })) {
            throw new Error("Установка Forge завершена, но файл конфигурации не найден.");
        }
    }

    setScreenBlocker("Анализ библиотек Forge...");
    const configRaw = await readTextFile(forgeJsonPath);
    const forgeConfig = JSON.parse(configRaw);

    //let modules = []
    const forgeLibsPath = await join(minecraftDir, "libraries")
    const os = await platform();
    const separator = {'linux':':','windows':';','macos':';'}[await platform()]

    for (const lib of forgeConfig.libraries) {
        if (lib.downloads?.artifact) {
            const absPath = await join(minecraftDir, "libraries", lib.downloads.artifact.path);
            if (!libs.find(x => x.path === absPath)) libs.push({ path: absPath, name: lib.name.split(':')[1] });
            continue;
        }

        const nameParts = lib.name.split(':');
        const [group, artifact, version] = nameParts;
        const filename = `${artifact}-${version}.jar`;
        const subPath = `${group.replace(/\./g, '/')}/${artifact}/${version}/${filename}`;
        const fullPath = await join(minecraftDir, "libraries", subPath);

        if (!libs.find(x => x.path === fullPath)) libs.push({ path: fullPath, name: artifact });
    }

    const { jvm, game } = forgeConfig.arguments

    for (let i = 0; i < jvm.length; i++) {
        const arg = jvm[i];
        if (arg.includes("${library_directory}")) jvm[i] = jvm[i].replace(/\$\{library_directory\}/g, forgeLibsPath);
        if (arg.includes("${classpath_separator}")) jvm[i] = jvm[i].replace(/\$\{classpath_separator\}/g, separator);
        if (arg.includes("${version_name}")) jvm[i] = jvm[i].replace(/\$\{version_name\}/g, forgeVersion);
    }

    const modulesIdx = jvm.indexOf('-p')
    jvm[modulesIdx + 1] = `"${jvm[modulesIdx + 1]}"`

    return [ forgeConfig.mainClass, jvm, game ];
};

const getJSON = async (url) => {
    const res = await fetch(url, { method: 'GET', connectTimeout: 15000 });
    return await res.json();
};

export const getForgePromotions = async (mcVersion) => {
    const data = await getJSON(FORGE_PROMOTIONS);
    const promos = data.promos;
    const result = [];

    if (promos[`${mcVersion}-latest`]) {
        result.push({
            version: promos[`${mcVersion}-latest`],
            type: 'latest'
        });
    }

    if (promos[`${mcVersion}-recommended`]) {
        result.push({
            version: promos[`${mcVersion}-recommended`],
            type: 'recommended'
        });
    }

    return result;
};

export const getAllForgeVersions = async (mcVersion) => {
    try {
        const data = await getJSON(`${BMCLAPI_FORGE}${mcVersion}`);
        return data.map(v => ({
            version: v.version,
            date: v.date,
            type: 'common'
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
        console.error(e);
        return await getForgePromotions(mcVersion);
    }
};
