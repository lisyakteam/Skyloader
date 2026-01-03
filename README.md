<h1 align="center">SkyLoader</h1>
<p align="center"><b>Эксперементальный мультиплатформенный лаунчер для Minecraft (и - в будущем - других игр)</b></p>

<div align="center">
<img src="https://img.shields.io/badge/MIT-green?style=for-the-badge"/>
<img src="https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E"/>
<img src="https://img.shields.io/badge/Rust-FE4C5C?style=for-the-badge"/>
</div>

## Особенности
- <b>Безопасность</b>
<br/>Библиотеки всегда проверяются перед запуском игры, будь то Fabric или Mojang. Также проверка реализована для модов из каталога (однако загружаемые моды все равно стоит проверять!)
- <b>Поддержка модов</b>
<br/>Кроме ваниллы, поддерживаются моды Fabric, и есть обновляемый каталог официальных модпаков.
- <b>Установка Java</b>
<br/>Готовый инсталлятор <b>Java 25</b> по нажатию кнопки (проверено на Windows 11 и Linux)

## В планах
- Поддержка лицензионных аккаунтов
- Поддержка Forge (возможно? Не точно! Forge устарел)
- Исправления ошибок и внешнего вида

## Разработка
Требуется [bun.js](https://bun.com/) (или node.js)
```sh
$ bun tauri dev
```

## Сборка
Необходима [предварительная настройка](https://v2.tauri.app/distribute/windows-installer/)  

<b>Сборка под Windows с Arch Linux:</b>
```sh
$ bun tauri icon icon.jpg
export CFLAGS="-Wno-implicit-function-declaration"
bun tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

## Лицензия
[MIT](https://github.com/lisyakteam/skyloader/blob/main/LICENSE)
