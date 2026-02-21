/* функционал для мода на войсчат и вебку в игре */

/*struct CameraState {
 * stop_flag: Arc<AtomicBool>,
 }  *

 #[derive(serde::Serialize, Clone)]
 struct FramePayload {
 data: Vec<u8>, // RGB байты
width: u32,
height: u32,
}*/

/* Webcam mod (currently in dev) */
/*#[tauri::command]
 f n *start_camera(app: tauri::AppHandle, state: tauri::State<'_, CameraState>) -> Result<(), String> {
 let stop_flag = state.stop_flag.clone();
 stop_flag.store(false, Ordering::Relaxed);

 let handle = std::thread::spawn(move || -> std::io::Result<()> {
 let index = CameraIndex::Index(0);
 let requested =
 RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
 let mut cam = Camera::new(index, requested).expect("Camera open error");
 cam.open_stream().expect("Camera stream error");

 let resolution = cam.resolution();
 let src_width = resolution.width() as usize;
 let src_height = resolution.height() as usize;

 let fps = 20;
 let frame_delay = std::time::Duration::from_millis(1000 / fps);

 let socket = UdpSocket::bind("0.0.0.0:0")?; // локальный порт любой
 let server_addr = "127.0.0.1:5555"; // куда отправляем (Java-сервер)

 while !stop_flag.load(Ordering::Relaxed) {
     let frame = match cam.frame() {
     Ok(f) => f,
     Err(_) => continue,
     };

     let decoded = frame.decode_image::<RgbFormat>().expect("Decode error");
     let src: &[u8] = decoded.as_raw();

     let mut output_buf = resize_and_crop_center(src, src_width, src_height);

     socket.send_to(&output_buf, server_addr)?;

     //let payload = FramePayload {
     //    data: output_buf.clone(),
     //    width: 128,
     //    height: 128,
     //};
     //let _ = app.emit("camera_frame", payload);

     std::thread::sleep(frame_delay);
     }
     Ok(())
     });
     handle.join().unwrap();
     Ok(())
     }

     fn resize_and_crop_center(src: &[u8], src_width: usize, src_height: usize) -> Vec<u8> {
     let target_size = 128;
     let mut output_buf = vec![0u8; target_size * target_size * 3];

     // 1. Вычисляем масштаб, сохраняющий пропорции
     let scale = target_size as f32 / src_width.min(src_height) as f32;

     let scaled_width = (src_width as f32 * scale).round() as usize;
     let scaled_height = (src_height as f32 * scale).round() as usize;

     // 2. Считаем смещение центра
     let offset_x = (scaled_width.saturating_sub(target_size)) / 2;
     let offset_y = (scaled_height.saturating_sub(target_size)) / 2;

     for y in 0..target_size {
         for x in 0..target_size {
             // координаты в исходном изображении
             let src_x = (((x + offset_x) as f32) / scale).floor() as usize;
             let src_y = (((y + offset_y) as f32) / scale).floor() as usize;

             // индекс пикселя в исходном буфере
             let src_idx = (src_y.min(src_height - 1) * src_width + src_x.min(src_width - 1)) * 3;
             let dst_idx = (y * target_size + x) * 3;

             output_buf[dst_idx..dst_idx + 3].copy_from_slice(&src[src_idx..src_idx + 3]);
             }
             }

             output_buf
             }

             #[tauri::command]
             fn stop_camera(state: tauri::State<'_, CameraState>) {
             state.stop_flag.store(true, Ordering::Relaxed);
             }*/
