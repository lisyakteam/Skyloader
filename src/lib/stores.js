import { writable } from 'svelte/store';
import { writeTextFile, readTextFile, BaseDirectory, exists } from '@tauri-apps/plugin-fs';
import { appDataDir, join, dirname } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';

const CONFIG_FILE = "config.json";

export const myBuilds = writable([]);

export const accounts = writable();

export const config = writable();

export const launchInfo = writable(null);

export const modal = writable(null);

config.subscribe(async data => {
    if (data === undefined) {
        let configData;
        const configFileName = 'config.json';

        try {
            if (await exists(configFileName, { baseDir: BaseDirectory.AppData })) {
                const content = await readTextFile(configFileName, { baseDir: BaseDirectory.AppData });
                configData = JSON.parse(content);
            } else {
                configData = {
                    lastInstanceId: null,
                    selectedAccountIndex: 0,
                    assetsPath: "",
                    libraryPath: ""
                };
            }
        } catch (e) {
            console.error("Ошибка при чтении конфига:", e);
            return;
        }

        if (!configData.assetsPath || !configData.libraryPath) {
            const currentPlatform = platform();
            const appDir = await appDataDir();
            const defaultAssets = await join(appDir, 'assets') + '/';
            const defaultLibraries = await join(appDir, 'libraries') + '/';

            if (currentPlatform === 'windows') {
                const roamingDir = await dirname(appDir);
                const mcAssets = await join(roamingDir, '.minecraft', 'assets') + '/';
                const mcLibraries = await join(roamingDir, '.minecraft', 'libraries') + '/';

                if (!configData.assetsPath) {
                    configData.assetsPath = (await exists(mcAssets)) ? mcAssets : defaultAssets;
                }
                if (!configData.libraryPath) {
                    configData.libraryPath = (await exists(mcLibraries)) ? mcLibraries : defaultLibraries;
                }
            } else {
                if (!configData.assetsPath) configData.assetsPath = defaultAssets;
                if (!configData.libraryPath) configData.libraryPath = defaultLibraries;
            }
        }

        config.set(configData);
    } else {
        await writeTextFile('config.json', JSON.stringify(data, null, 4), {
            baseDir: BaseDirectory.AppData
        });
    }
});

accounts.subscribe(async data => {
    if (data === undefined) {
        if (!await exists('accounts.json', { baseDir: BaseDirectory.AppData })) {
            data = [
                { name: 'Player_' + Math.ceil(Math.random() * 999), token: null, type: 'offline' }
            ]
        }
        else data = JSON.parse(await readTextFile('accounts.json', { baseDir: BaseDirectory.AppData }))
        accounts.set(data);
    }
    else {
        await writeTextFile('accounts.json', JSON.stringify(data, null, 4), { baseDir: BaseDirectory.AppData })
    }
})
