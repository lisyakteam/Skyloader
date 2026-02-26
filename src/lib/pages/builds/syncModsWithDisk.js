import { readTextFile, writeTextFile, writeFile, exists, BaseDirectory, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { join, appDataDir } from '@tauri-apps/api/path';

export default async function syncModsWithDisk(build) {
    try {
        const modsPath = await join('instances', build.dirName, 'mods');
        if (!(await exists(modsPath, { baseDir: BaseDirectory.AppData }))) return build;

        const files = await readDir(modsPath, { baseDir: BaseDirectory.AppData });
        const jarFiles = files.filter(f => f.name.endsWith('.jar'));
        let updatedMods = [];

        for (const file of jarFiles) {
            const fullPath = await join(await appDataDir(), 'instances', build.dirName, 'mods', file.name);
            try {
                const meta = await invoke('get_mod_metadata', { path: fullPath });
                updatedMods.push({
                    name: meta.name || file.name,
                    fileName: file.name,
                    description: meta.description || '',
                    icon: meta.icon || null,
                    version: meta.version || ''
                });
            } catch {
                updatedMods.push({ name: file.name, fileName: file.name });
            }
        }

        if (build.manifest && build.versions?.length > 0) {
            const lastVer = build.versions[build.versions.length - 1];
            const missing = lastVer.mods.some(m => m.sync !== false && !jarFiles.some(j => j.name === (m.fileName || m.name)));
            build.needsUpdate = missing;
        }

        if (!build.versions) build.versions = [];
        const currentVerName = build.manifest ? (build.versions[build.versions.length - 1]?.name || '1.0.0') : (build.currentVersion || '1.0.0');

        const vIndex = build.manifest ? (build.versions.length - 1) : 0;
        if (vIndex >= 0) {
            build.versions[vIndex] = { ...build.versions[vIndex], mods: updatedMods, name: currentVerName };
        } else {
            build.versions.push({ id: 'v1', name: currentVerName, mods: updatedMods });
        }

        return build;
    } catch { return build; }
}
