import { get } from 'svelte/store';
import { platform } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir, join } from '@tauri-apps/api/path';
import { myBuilds, config, accounts, launchInfo } from '$lib/stores.js';
import * as Mojang from './mojang';
import * as Fabric from './fabric';
import { checkOrInstallJava } from './java';

let timeout;

export async function launchGame() {
    if (timeout) clearTimeout(timeout);

    const currentConfig = get(config);
    const builds = get(myBuilds);
    const accs = get(accounts);

    const build = builds.find(b => b.instanceId === currentConfig.lastInstanceId);
    const account = accs[currentConfig.selectedAccountIndex];

    if (!build) return alert("Сборка не выбрана");

    const gameDir = await appDataDir();
    const instanceDir = gameDir + '/instances/' + build.dirName;

    const setScreenBlocker = text => launchInfo.set(text);

    try {
        //const javaReady = await checkOrInstallJava(setScreenBlocker);
        //if (!javaReady) return;

        setScreenBlocker("Получение данных версии...");
        const manifest = await Mojang.getManifest(build.game.version);

        console.log(manifest)

        /* Загружаем библиотеки ваниллы нахуй */
        const [ libs, natives ] = await Mojang.checkLibraries(manifest, setScreenBlocker);
        console.log(natives.join('\n'))

        /* Загружаем ассеты - типа текстуры, звуки */
        const assets = await Mojang.checkAssets(manifest, setScreenBlocker);

        if (build.game.core === 'fabric') {
            console.log('Fabric')

            await Fabric.checkLibraries(setScreenBlocker, libs, build.game.version);
        }

        console.log(assets)

        /* Загружаем саму игру (уже загрузили библиотеки и ассеты) */
        const client = await Mojang.checkClient(manifest, libs, setScreenBlocker);
        console.log(client)
        /* Нативные библиотеки которые на C++ надо распаковать и указать путь, иначе пизда */
        await Mojang.unpackNatives(natives, instanceDir, setScreenBlocker);

        const version = build.game.version.split('.').map(x => +x);
        let mainVersion = version[0] === 1 ? version[1] : version[0];

        const mainClass = build.game.core === 'fabric' ?
                          "net.fabricmc.loader.impl.launch.knot.KnotClient" :
                          mainVersion >= 6 ?
                          manifest.mainClass : "net.minecraft.client.Minecraft";

        await createBatAndFire(setScreenBlocker, currentConfig, build, account, instanceDir, gameDir, manifest, libs, mainClass)
    } catch (e) {
        console.error(e);
        alert("Ошибка при запуске: " + e);
        setScreenBlocker(null);
    }
}

const createBatAndFire = async (setScreenBlocker, currentConfig, build, account, instanceDir, gameDir, manifest, libs, clientClass) => {
    await invoke('mkdir', { path: instanceDir })

    const os = await platform();
    const cpSeparator = {'linux':':','windows':';','macos':';'}[await platform()]

    const gameVersion = manifest.id
    const assetsIndex = manifest.assets
    const nativesDir = instanceDir + "/natives"
    const assetsDir = gameDir + "/assets"
    const classPath = libs.map(x => x.path).join(cpSeparator)

    console.log(nativesDir)

    const serverAddress = "xn--h1aebz4e.xn--p1ai"

    const java = currentConfig.javaPath
    const maxMemory = currentConfig.ram || 1024

    if(!java) return setScreenBlocker('Укажите путь к джаве в настройках')

    const jvm_args = "-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M -Djava.net.preferIPv4Stack=true".split(' ')

    const args = [
        ...jvm_args,
        "-Xmx" + maxMemory + "M",
        "-Duser.language=ru",
        "-Dminecraft.launcher.brand=\"Проект Лисяк\"",
        "-cp", "\"" + classPath.replace(/ /g, '\\ ') + "\"",
        `-Djava.library.path="${nativesDir}"`,
        clientClass,
        "--username", account.name,
        "--version", build.id,
        "--gameDir", "\"" + instanceDir + "\"",
        "--assetsDir", "\"" + assetsDir + "\"",
        "--assetIndex", "\"" + assetsIndex + "\"",
        "--uuid", offlineUUID(account.name),
        "--accessToken", "0",
        "--userProperties", "{}",
    ]

    if(serverAddress) {
        args.push('--quickPlayMultiplayer')
        args.push(serverAddress)
    }

    const file_type = os === 'windows' ? '.bat' : '.sh'

    const bat = `"${java}" ${args.join(' ')}`
    const batPath = instanceDir + "/start" + file_type
    await invoke('write_executable', { path: batPath, data: bat })

    console.log(bat)
    console.log(batPath)
    const debug = `"${java.replace('javaw.exe', 'java.exe')}" ${args.join(' ')}\npause`
    const debugPath = instanceDir + "/startWithLogs" + file_type
    await invoke('write_executable', { path: debugPath, data: debug })

    invoke('execute', { path: batPath })

    setScreenBlocker(`Запуск сборки...`)

    timeout = setTimeout(() => {
        setScreenBlocker(null);
    }, 10000)
}

function offlineUUID(username) {
    let hash = 0
    const str = "OfflinePlayer:" + username

    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
    }

    const hex = (hash >>> 0).toString(16).padStart(8, '0')

    return `${hex}0000-0000-0000-000000000000`
}

function uuid() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
