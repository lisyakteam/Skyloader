import { readTextFile, writeTextFile, exists, BaseDirectory, mkdir } from '@tauri-apps/plugin-fs';

const CACHE_DIR = 'skin_cache';
const MAX_BATCH_SIZE = 12;
const BATCH_INTERVAL = 1000;

const ramCache = new Map();
const pendingRequests = new Map();
const queue = [];
let isProcessing = false;

async function ensureCacheDir() {
    try {
        const dirExists = await exists(CACHE_DIR, { baseDir: BaseDirectory.AppData });
        if (!dirExists) {
            await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
        }
    } catch (e) {
        console.error("Ошибка инициализации FS:", e);
    }
}

ensureCacheDir();

export const getSkin = async (nameOrNames) => {
    if (Array.isArray(nameOrNames)) {
        return Promise.all(nameOrNames.map(n => getSingleSkin(n)));
    }
    return getSingleSkin(nameOrNames);
};

async function getSingleSkin(name) {
    if (!name) return null;

    if (ramCache.has(name)) {
        return ramCache.get(name);
    }

    const fileName = `${CACHE_DIR}/${name}.txt`;
    try {
        if (await exists(fileName, { baseDir: BaseDirectory.AppData })) {
            const cachedUrl = await readTextFile(fileName, { baseDir: BaseDirectory.AppData });
            ramCache.set(name, cachedUrl); // Сохраняем в RAM для следующего раза
            return cachedUrl;
        }
    } catch (e) {
        console.warn("Ошибка чтения кеша FS:", e);
    }

    if (pendingRequests.has(name)) {
        return pendingRequests.get(name).promise;
    }

    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    pendingRequests.set(name, { promise, resolve, reject });
    queue.push(name);

    if (!isProcessing) {
        processQueue();
    }

    return promise;
}

const processQueue = async () => {
    if (queue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;

    const batchNames = queue.splice(0, MAX_BATCH_SIZE);

    try {
        console.log(`[Batch] Запрос скинов для: ${batchNames.join(', ')}`);

        const response = await fetch(`https://lisyak.net/api/skins?usernames=${batchNames.join(',')}`);
        const json = await response.json();

        if (json.skins && Array.isArray(json.skins)) {
            await Promise.all(batchNames.map(async (name) => {
                const req = pendingRequests.get(name);
                if (!req) return;

                try {
                    const skinData = json.skins.find(s => s.name === name) || json.skins[0];

                    if (skinData) {
                        const manifestResponse = await fetch(skinData.url);
                        const { textures } = await manifestResponse.json();
                        const url = textures.SKIN.url;

                        ramCache.set(name, url);
                        await writeTextFile(`${CACHE_DIR}/${name}.txt`, url, { baseDir: BaseDirectory.AppData });

                        req.resolve(url);
                    } else {
                        req.resolve(null);
                    }
                } catch (err) {
                    req.reject(err);
                } finally {
                    pendingRequests.delete(name);
                }
            }));
        }
    } catch (error) {
        console.error("Ошибка батча:", error);
        batchNames.forEach(name => {
            pendingRequests.get(name)?.reject(error);
            pendingRequests.delete(name);
        });
    }

    setTimeout(processQueue, BATCH_INTERVAL);
};

export async function getHeadFromSkin(skinUrl, size = 64) {
    return new Promise(async (resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = skinUrl;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            canvas.width = size;
            canvas.height = size;
            ctx.imageSmoothingEnabled = false;

            ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);

            ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);

            resolve(canvas.toDataURL("image/png"));
        };

        img.onerror = (err) => reject(err);
    });
}



