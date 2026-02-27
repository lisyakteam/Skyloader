import { readTextFile, writeTextFile, exists, BaseDirectory, mkdir } from '@tauri-apps/plugin-fs';
import { fetch } from '@tauri-apps/plugin-http';

const CACHE_DIR = 'cache/skin';
const MAX_BATCH_SIZE = 12;
const BATCH_INTERVAL = 1000;

const LICENSE_NICKS = [
    "fox", "lmondeus", "Endodragon9425", "Kaeryu", "TheHoneyFox", "Steelers_ForLife",
"Wh1chWitch", "JumboGameplay", "YNnalmeog", "FunFearFox", "Foxman21", "Max_J7"
];

const ramCache = new Map();
const pendingRequests = new Map();
const queue = [];
let isProcessing = false;

function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}

async function getFallbackSkinUrl(playerName) {
    try {
        const index = Math.abs(hashCode(playerName.toLowerCase())) % LICENSE_NICKS.length;
        const selectedNick = LICENSE_NICKS[index];

        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${selectedNick}`, {
            method: 'GET',
            connectTimeout: 5000
        });

        if (!profileRes.ok) return null;
        const { id: uuid } = await profileRes.json();

        const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        if (!sessionRes.ok) return null;
        const sessionData = await sessionRes.json();

        const texturesProperty = sessionData.properties.find(p => p.name === 'textures');
        if (!texturesProperty) return null;

        const decodedTextures = JSON.parse(atob(texturesProperty.value));
        return decodedTextures.textures.SKIN.url;
    } catch (e) {
        console.error(`[Fallback] Ошибка получения скина для ${playerName}:`, e);
        return null;
    }
}

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
    if (ramCache.has(name)) return ramCache.get(name);

    const fileName = `${CACHE_DIR}/${name}.txt`;
    try {
        if (await exists(fileName, { baseDir: BaseDirectory.AppData })) {
            const cachedUrl = await readTextFile(fileName, { baseDir: BaseDirectory.AppData });
            ramCache.set(name, cachedUrl);
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

    if (!isProcessing) processQueue();
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

        let json = { skins: [] };
        try {
            const response = await fetch(`https://lisyak.net/api/skins?usernames=${batchNames.join(',')}`);
            if (response.ok) json = await response.json();
        } catch (e) {
            console.warn("Основной API недоступен, перехожу на фоллбек");
        }

        await Promise.all(batchNames.map(async (name) => {
            const req = pendingRequests.get(name);
            if (!req) return;

            let finalUrl = null;

            try {
                const skinData = json.skins?.find(s => s.name === name);

                if (skinData && skinData.url) {
                    const manifestResponse = await fetch(skinData.url);
                    const { textures } = await manifestResponse.json();
                    finalUrl = textures.SKIN.url;
                }
            } catch (err) {
                console.warn(`Ошибка обработки основного API для ${name}, пробуем фоллбек`);
            }

            if (!finalUrl) {
                finalUrl = await getFallbackSkinUrl(name);
            }

            if (finalUrl) {
                ramCache.set(name, finalUrl);
                try {
                    await writeTextFile(`${CACHE_DIR}/${name}.txt`, finalUrl, { baseDir: BaseDirectory.AppData });
                } catch (fsErr) {
                    console.error("Ошибка записи в кеш:", fsErr);
                }
                req.resolve(finalUrl);
            } else {
                req.resolve(null);
            }

            pendingRequests.delete(name);
        }));

    } catch (error) {
        console.error("Критическая ошибка батча:", error);
        batchNames.forEach(name => {
            pendingRequests.get(name)?.resolve(null);
            pendingRequests.delete(name);
        });
    }

    setTimeout(processQueue, BATCH_INTERVAL);
};

export async function getHeadFromSkin(skinUrl, size = 64) {
    if (!skinUrl) return null;
    return new Promise((resolve, reject) => {
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
