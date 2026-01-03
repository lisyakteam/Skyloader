import { writable } from 'svelte/store';
import { writeTextFile, readTextFile, BaseDirectory, exists } from '@tauri-apps/plugin-fs';

const CONFIG_FILE = "config.json";

export const myBuilds = writable([]);

export const accounts = writable();

export const config = writable();

export const launchInfo = writable(null);

config.subscribe(async data => {
    console.log('config', data)
    if (data === undefined) {
        if (!await exists('config.json', { baseDir: BaseDirectory.AppData })) {
            data = {
                lastInstanceId: null,
                selectedAccountIndex: 0
            }
        }
        else data = JSON.parse(await readTextFile('config.json', { baseDir: BaseDirectory.AppData }))
        console.log(data)
        config.set(data);
    }
    else {
        await writeTextFile('config.json', JSON.stringify(data, null, 4), { baseDir: BaseDirectory.AppData })
    }
})

accounts.subscribe(async data => {
    console.log('data', data)
    if (data === undefined) {
        if (!await exists('accounts.json', { baseDir: BaseDirectory.AppData })) {
            data = [
                { name: 'Player_' + Math.ceil(Math.random() * 999), token: null, type: 'offline' }
            ]
        }
        else data = JSON.parse(await readTextFile('accounts.json', { baseDir: BaseDirectory.AppData }))
        console.log(data)
        accounts.set(data);
    }
    else {
        await writeTextFile('accounts.json', JSON.stringify(data, null, 4), { baseDir: BaseDirectory.AppData })
    }
})
