import { readTextFile, writeTextFile, writeFile, exists, BaseDirectory, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';
import { get } from 'svelte/store';

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

export default async function getUniqueDirName(myBuilds, name) {
    let base = transliterate(name) || "instance";
    let candidate = base;
    let counter = 1;
    while (true) {
        const existsInArr = get(myBuilds).some(b => b.dirName === candidate);
        if (!existsInArr && !(await exists(await join('instances', candidate), { baseDir: BaseDirectory.AppData }))) return candidate;
        candidate = `${base}_${counter++}`;
    }
    return candidate
}
