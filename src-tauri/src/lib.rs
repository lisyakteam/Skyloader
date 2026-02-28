/*use image::{imageops, ImageBuffer, Rgb};
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType, Resolution};
use nokhwa::{pixel_format::RgbFormat, Camera};
use std::net::UdpSocket;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;*/
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::fs::File;
use std::io::Read;
use std::env;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use std::cmp::min;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;

use futures::stream;
use futures_util::StreamExt;
use reqwest::Client;
use std::collections::HashMap;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};
use tokio; // 1.26.0, features = ["macros"]
           //use std::os::windows::process::CommandExt;
           //use std::os::unix::process::CommandExt;

use flate2::read::GzDecoder;
use tar::Archive;
use zip::ZipArchive;

use sysinfo::System;

use chksum_sha1 as sha1;

#[derive(Serialize, Deserialize, Debug)]
pub struct ModMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
struct FabricModJson {
    name: Option<String>,
    description: Option<String>,
    version: Option<String>,
    icon: Option<serde_json::Value>,
}

const CONCURRENT_REQUESTS: usize = 4;

#[tauri::command]
fn get_total_ram() -> u64 {
    let mut sys = System::new_all();
    sys.refresh_memory();
    sys.total_memory() / 1024 / 1024
}

#[tauri::command]
fn make_executable(path: String) -> Result<(), String> {
    #[cfg(unix)]
    {
        let mut perms = fs::metadata(&path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755); // rwxr-xr-x
        fs::set_permissions(&path, perms).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_java_version(path: String) -> Result<String, String> {
    let output = std::process::Command::new(&path)
    .arg("-version")
    .output()
    .map_err(|e| e.to_string())?;

    let stderr = String::from_utf8_lossy(&output.stderr);

    for line in stderr.lines() {
        if line.contains("version") {
            if let Some(start) = line.find('"') {
                if let Some(end) = line[start + 1..].find('"') {
                    let version = line[start + 1..start + 1 + end].to_string();
                    return Ok(version);
                }
            }
        }
    }

    Err("Не удалось определить версию Java".into())
}

#[tauri::command]
fn find_system_java() -> Option<String> {
    if let Some(path) = find_java_in_path() {
        return Some(path);
    }

    if let Ok(java_home) = env::var("JAVA_HOME") {
        let bin_name = if cfg!(windows) { "java.exe" } else { "java" };
        let path = PathBuf::from(java_home).join("bin").join(bin_name);
        if path.exists() {
            return Some(path.to_string_lossy().into_owned());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let common_dirs = [
            "C:\\Program Files\\Eclipse Adoptium",
            "C:\\Program Files\\Java",
            "C:\\Program Files\\BellSoft",
        ];

        for dir in common_dirs {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path().join("bin").join("java.exe");
                    if path.exists() {
                        return Some(path.to_string_lossy().into_owned());
                    }
                }
            }
        }
    }

    None
}

fn find_java_in_path() -> Option<String> {
    let cmd = if cfg!(windows) { "where" } else { "which" };

    let output = Command::new(cmd)
    .arg("java")
    .output()
    .ok()?;

    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

        let first_path = path_str.lines().next()?.to_string();

        if Path::new(&first_path).exists() {
            return Some(first_path);
        }
    }
    None
}

#[tauri::command]
async fn get_mod_metadata(path: String) -> Result<ModMetadata, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut contents = String::new();
    {
        let mut mod_json_file = archive
            .by_name("fabric.mod.json")
            .map_err(|_| "Not a fabric mod")?;
        mod_json_file
            .read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;
    }

    let parsed: FabricModJson = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    let mut icon_base64 = None;

    if let Some(icon_val) = parsed.icon {
        let icon_path = if icon_val.is_string() {
            icon_val.as_str().map(|s| s.to_string())
        } else if icon_val.is_object() {
            icon_val
                .get("128")
                .or(icon_val.get("64"))
                .or(icon_val.get("32"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            None
        };

        if let Some(p) = icon_path {
            if let Ok(mut icon_file) = archive.by_name(&p) {
                let mut buffer = Vec::new();
                if icon_file.read_to_end(&mut buffer).is_ok() {
                    let b64 = general_purpose::STANDARD.encode(buffer);
                    icon_base64 = Some(format!("data:image/png;base64,{}", b64));
                }
            }
        }
    }

    Ok(ModMetadata {
        name: parsed.name,
        description: parsed.description,
        version: parsed.version,
        icon: icon_base64,
    })
}

#[tauri::command]
fn get_file_sha256(path: String) -> String {
    let mut file = fs::File::open(path).unwrap();
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher).unwrap();
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
fn get_file_sha1(path: &str, hash: &str) -> String {
    let file = fs::read(&path).expect("File open error");
    let digest = sha1::chksum(file).expect("Hash error");
    assert_eq!(digest.to_hex_lowercase(), hash);
    format!("true")
}

#[tauri::command]
fn unpack(from: String, to: String) -> Result<String, String> {
    let from_path = Path::new(&from);
    let to_path = Path::new(&to);

    if !to_path.exists() {
        fs::create_dir_all(to_path).map_err(|e| e.to_string())?;
    }

    let file = File::open(from_path).map_err(|e| format!("Не удалось открыть файл: {}", e))?;

    if from.ends_with(".tar.gz") || from.ends_with(".tgz") {
        let tar = GzDecoder::new(file);
        let mut archive = Archive::new(tar);
        archive.unpack(to_path).map_err(|e| format!("Ошибка распаковки TAR.GZ: {}", e))?;
    }
    else if from.ends_with(".zip") || from.ends_with(".tar") || from.ends_with(".jar") {
        let mut archive = ZipArchive::new(file).map_err(|e| format!("Ошибка чтения ZIP: {}", e))?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = to_path.join(file.name());

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut outfile = File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    } else {
        return Err("Поддерживаются только .zip и .tar.gz".into());
    }

    Ok(format!("Распаковано в {}", to))
}

#[tauri::command]
async fn execute(path: String) -> Result<bool, String> {
    let handle = std::thread::spawn(move || {
        launch(&path)
    });

    let status = handle.join().map_err(|_| "Launch task panicked")?;
    Ok(status)
}

#[tokio::main]
async fn launch(path: &str) -> bool {
    let parent = Path::new(path).parent().expect("BAT PARENT ERR");
    launch_impl(path, parent).await
}

#[cfg(windows)]
async fn launch_impl(path: &str, parent: &Path) -> bool {
    use std::os::windows::process::CommandExt;

    let output = Command::new(path)
    .creation_flags(0x08000000) // CREATE_NO_WINDOW
    .stdout(Stdio::piped())
    .current_dir(parent)
    .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

#[cfg(unix)]
async fn launch_impl(path: &str, parent: &Path) -> bool {
    let output = Command::new("bash")
    .arg(path)
    .stdout(Stdio::piped())
    .current_dir(parent)
    .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

#[tauri::command]
async fn download_many(urls: HashMap<String, String>, app: AppHandle) -> Result<String, ()> {
    std::thread::spawn(|| {
        multidownload(urls, app);
    })
    .join()
    .expect("Task panicked");

    Ok(format!("true"))
}

#[tauri::command]
async fn get_not_installed(objects_dir: &str, paths: Vec<String>) -> Result<Vec<String>, ()> {
    let mut need = Vec::new();

    for path in paths.iter() {
        let together = format!("{objects_dir}{path}");
        println!("{together}");
        if !fs::metadata(together).is_ok() {
            need.push(path.to_string());
        }
    }

    println!("{}", paths.len());

    Ok(need)
}

#[tokio::main]
async fn multidownload(urls: HashMap<String, String>, app: AppHandle) {
    let client = Client::new();
    println!("multidownload start");

    //let total_count = urls.len();

    let bodies = stream::iter(urls)
        .map(|(url, path)| {
            let client = &client;
            async move {
                let resp = client.get(url).send().await.expect("Client GET error");
                (path, resp.bytes().await)
            }
        })
        .buffer_unordered(CONCURRENT_REQUESTS);

    bodies
        .for_each(|(path, b)| {
            let value = app.clone();
            async move {
                match b {
                    Ok(b) => {
                        eprintln!("saving {}", path);
                        let buf = PathBuf::from(path);
                        let _ = fs::create_dir_all(buf.parent().unwrap());
                        fs::write(buf, b).expect("WRITE ERROR");
                        value.emit("downloaded", true).expect("Window emit err");
                    }
                    Err(e) => eprintln!("Got an error: {}", e),
                }
            }
        })
        .await;

    println!("multidownload finish");
}

#[tauri::command]
async fn exists(path: &str) -> Result<bool, ()> {
    Ok(fs::metadata(path).is_ok())
}

#[tauri::command]
async fn mkdir(path: String) {
    fs::create_dir_all(path).expect("Err!!");
}

#[tauri::command]
async fn read_text_file(path: &str) -> Result<String, ()> {
    Ok(fs::read_to_string(path).expect("Err!!"))
}

#[tauri::command]
async fn write_text_file(path: String, data: String) {
    fs::write(path, data).expect("TRUE");
}

#[tauri::command]
async fn write_executable(path: String, data: String) -> Result<String, ()> {
    println!("{}", path);
    println!("{}", data);
    let response = fs::write(path.clone(), data).expect("TRUE");

    #[cfg(unix)]
    {
        fs::set_permissions(path, fs::Permissions::from_mode(0o711)).unwrap();
    }


    if response == () {
        Ok("ok".to_string())
    } else {
        Ok("err".to_string())
    }
}

#[tauri::command]
async fn remove(path: String) {
    let md = fs::metadata(path.clone()).unwrap();
    if md.is_dir() {
        let _ = fs::remove_dir_all(path);
    } else {
        let _ = fs::remove_file(path);
    };
}

#[tauri::command]
async fn read_dir(path: String, recursive: bool) -> Result<Vec<String>, ()> {
    let mut entries = Vec::new();

    if !recursive {
        let _ = fs::read_dir(path).map(|res| {
            res.map(|e| {
                entries.push(
                    e.expect("DIRNAME")
                        .path()
                        .into_os_string()
                        .into_string()
                        .unwrap(),
                )
            })
        });
        Ok(entries)
    } else {
        collect_files_from_dir(Path::new(&path))
    }
}

fn collect_files_from_dir(dir: &Path) -> Result<Vec<String>, ()> {
    let mut result: Vec<String> = vec![];
    if dir.is_dir() {
        for entry in fs::read_dir(dir).expect("NO") {
            let entry = entry.expect("NO");
            let path = entry.path();
            if path.is_dir() {
                result.extend(collect_files_from_dir(&path)?);
            } else {
                result.push(path.into_os_string().into_string().unwrap());
            }
        }
    }
    Ok(result)
}

#[derive(Clone, serde::Serialize)]
struct Payload {
    downloaded: u64,
    total_size: u64,
}

#[tauri::command]
async fn large_download(path: &str, url: &str, app: AppHandle) -> Result<String, ()> {
    let client = Client::new();

    let res = client.get(url).send().await.expect("Client send err");
    let total_size = res.content_length().expect("Content length err");

    let mut file = File::create(path).expect("File create path err");
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(item) = stream.next().await {
        let chunk = item.expect("Chunk item expect err");
        file.write_all(&chunk).expect("File write all expect err");
        let new = min(downloaded + (chunk.len() as u64), total_size);
        downloaded = new;
        app.emit(
            "progress",
            Payload {
                downloaded,
                total_size,
            },
        )
        .expect("Window emit err");
    }

    Ok(format!("true"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        /*.manage(CameraState {
            stop_flag: Arc::new(AtomicBool::new(false)),
        })*/
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_file_sha256,
            get_file_sha1,
            get_mod_metadata,
            execute,
            unpack,
            read_dir,
            remove,
            write_executable,
            write_text_file,
            read_text_file,
            mkdir,
            exists,
            get_not_installed,
            download_many,
            large_download,
            get_java_version,
            get_total_ram,
            find_system_java,
            make_executable,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
