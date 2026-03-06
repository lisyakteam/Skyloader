use tauri::{AppHandle, Manager};
use serde_json::{Value, json};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use rayon::prelude::*;
use zip::ZipArchive;
use base64::{engine::general_purpose, Engine as _};

fn get_mod_metadata_internal(path: &Path) -> Value {
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

    let process = || -> Result<Value, Box<dyn std::error::Error>> {
        let file = File::open(path)?;
        let mut archive = ZipArchive::new(file)?;
        let mut contents = String::new();
        archive.by_name("fabric.mod.json")?.read_to_string(&mut contents)?;
        let parsed: Value = serde_json::from_str(&contents)?;

        let mut icon_base64 = Value::Null;
        if let Some(icon_val) = parsed.get("icon") {
            let icon_p = if icon_val.is_string() { icon_val.as_str().map(|s| s.to_string()) }
            else { icon_val.get("128").or(icon_val.get("64")).and_then(|v| v.as_str()).map(|s| s.to_string()) };

            if let Some(p) = icon_p {
                if let Ok(mut img_f) = archive.by_name(&p) {
                    let mut buf = Vec::new();
                    if img_f.read_to_end(&mut buf).is_ok() {
                        icon_base64 = json!(format!("data:image/png;base64,{}", general_purpose::STANDARD.encode(buf)));
                    }
                }
            }
        }

        Ok(json!({
            "name": parsed.get("name").or(Some(&json!(file_name))).unwrap(),
                 "fileName": file_name,
                 "description": parsed.get("description").unwrap_or(&json!("")),
                 "icon": icon_base64,
                 "version": parsed.get("version").unwrap_or(&json!(""))
        }))
    };

    process().unwrap_or_else(|_| json!({
        "name": file_name,
        "fileName": file_name
    }))
}

#[tauri::command]
pub async fn sync_local_instances(app_handle: AppHandle) -> Result<Vec<Value>, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| e.to_string())?;
    let instances_root = app_dir.join("instances");
    if !instances_root.exists() { return Ok(vec![]); }

    let entries = fs::read_dir(instances_root).map_err(|e| e.to_string())?;

    let results: Vec<Value> = entries
    .filter_map(|e| e.ok())
    .filter(|e| e.path().is_dir())
    .map(|entry| {
        let instance_path = entry.path();
        let config_path = instance_path.join("instance.json");
        let mods_path = instance_path.join("mods");

        let config_data = fs::read_to_string(&config_path).ok();
        let mut build: Value = config_data
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({ "dirName": entry.file_name().to_string_lossy() }));

        if !mods_path.exists() { return build; }

        let current_mtime = fs::metadata(&mods_path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap().as_secs())
        .unwrap_or(0);

        let last_sync = build.get("last_mods_sync_time").and_then(|v| v.as_u64());
        if last_sync == Some(current_mtime) && build.get("versions").is_some() {
            return build;
        }

        let jar_files: Vec<PathBuf> = fs::read_dir(&mods_path)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map_or(false, |ext| ext == "jar"))
        .collect();

        let updated_mods: Vec<Value> = jar_files
        .par_iter()
        .map(|p| get_mod_metadata_internal(p))
        .collect();

        let is_manifest = build.get("manifest").and_then(|v| v.as_bool()).unwrap_or(false);
        if is_manifest {
            if let Some(versions) = build.get("versions").and_then(|v| v.as_array()) {
                if let Some(last_ver) = versions.last() {
                    let jar_names: Vec<String> = jar_files.iter()
                    .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
                    .collect();

                    let missing = last_ver.get("mods").and_then(|m| m.as_array()).map(|m_list| {
                        m_list.iter().any(|m| {
                            let sync = m.get("sync").and_then(|s| s.as_bool()).unwrap_or(true);
                            let m_name = m.get("fileName").or(m.get("name")).and_then(|v| v.as_str()).unwrap_or("");
                            sync && !jar_names.contains(&m_name.to_string())
                        })
                    }).unwrap_or(false);

                    build["needsUpdate"] = json!(missing);
                }
            }
        }

        if build.get("versions").is_none() {
            build["versions"] = json!([]);
        }

        let current_ver_name = if is_manifest {
            build["versions"].as_array().and_then(|a| a.last()).and_then(|v| v.get("name").cloned()).unwrap_or(json!("1.0.0"))
        } else {
            build.get("currentVersion").cloned().unwrap_or(json!("1.0.0"))
        };

        let v_idx = if is_manifest {
            build["versions"].as_array().map(|a| a.len() as i32 - 1).unwrap_or(-1)
        } else { 0 };

        if v_idx >= 0 {
            let idx = v_idx as usize;
            if let Some(versions) = build["versions"].as_array_mut() {
                if idx < versions.len() {
                    versions[idx]["mods"] = json!(updated_mods);
                    versions[idx]["name"] = current_ver_name;
                } else {
                    versions.push(json!({ "id": "v1", "name": current_ver_name, "mods": updated_mods }));
                }
            }
        } else {
            build["versions"].as_array_mut().unwrap().push(json!({ "id": "v1", "name": current_ver_name, "mods": updated_mods }));
        }

        build["last_mods_sync_time"] = json!(current_mtime);
        let _ = fs::write(&config_path, serde_json::to_string_pretty(&build).unwrap());

        build
    })
    .collect();

    Ok(results)
}
