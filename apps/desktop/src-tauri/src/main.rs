#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_process::init());

    let builder = match option_env!("TAURI_UPDATER_PUBLIC_KEY") {
        Some(pubkey) if !pubkey.trim().is_empty() => builder.plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(pubkey)
                .build(),
        ),
        _ => builder,
    };

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
