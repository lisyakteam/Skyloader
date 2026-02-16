import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os'; // Добавь этот плагин
import { exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { config, launchInfo } from '$lib/stores.js';
import { listen } from '@tauri-apps/api/event'

async function getJavaConfig() {
    const osType = await platform(); // 'windows', 'linux', 'macos'
    if (osType === 'windows') {
        return {
            url: "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.1%2B8/OpenJDK25U-jre_x64_windows_hotspot_25.0.1_8.zip",
            binPath: ['jdk-25.0.1+8-jre', 'bin', 'javaw.exe'],
            ext: 'zip'
        };
    } else {
        return {
            url: "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.1%2B8/OpenJDK25U-jre_x64_linux_hotspot_25.0.1_8.tar.gz",
            binPath: ['jdk-25.0.1+8-jre', 'bin', 'java'],
            ext: 'tar.gz'
        };
    }
}

export async function checkOrInstallJava() {
    launchInfo.set("Начинаем загрузку Java 25.")
    const javaCfg = await getJavaConfig();
    const appDir = await appDataDir();
    launchInfo.set("Начинаем загрузку Java 25..")
    const runtimeDir = await join(appDir, 'java');
    const executablePath = await join(runtimeDir, ...javaCfg.binPath);

    launchInfo.set("Начинаем загрузку Java 25...")
    if (await exists(executablePath)) {
        if (await invoke('check_java_version', { path: executablePath })) {
            launchInfo.set("Java уже установлена!")
            updateConfig(executablePath);
            return true;
        }
    }

    launchInfo.set("Загрузка Java 25...");
    if (!(await exists(runtimeDir))) await mkdir(runtimeDir, { recursive: true });

    const unlisten = await listen('progress', (event) => {
        const { downloaded, total_size } = event.payload;
        const percent = Math.ceil((downloaded / total_size) * 100);
        launchInfo.set(`Загрузка Java: ${percent}%`);
    });

    const archivePath = await join(runtimeDir, `java25.${javaCfg.ext}`);

    try {
        await invoke("large_download", { path: archivePath, url: javaCfg.url });
        launchInfo.set("Распаковка...");
        await invoke("unpack", { from: archivePath, to: runtimeDir });
        await remove(archivePath);

        if (await platform() !== 'windows') {
            await invoke('make_executable', { path: executablePath });
        }

        if (await invoke('check_java_version', { path: executablePath })) {
            updateConfig(executablePath);
            return true;
        }
    } catch (e) {
        console.error(e);
    } finally {
        unlisten()
    }
    return false;
}

function updateConfig(path) {
    config.update(c => ({ ...c, javaPath: path, javaVersion: 25 }));
}
