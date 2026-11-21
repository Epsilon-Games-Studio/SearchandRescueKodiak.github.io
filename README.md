# Search & Rescue: Kodiak

Juego de rescate marítimo en helicóptero (U.S. Coast Guard · Air Station Kodiak, Alaska) desarrollado con HTML5 Canvas, Web Audio API y JavaScript modular sin dependencias externas.

## Estructura del proyecto

```text
├── index.html                   # Documento principal e interfaz del juego
├── manifest.webmanifest         # Manifiesto PWA e iconos
├── assets/
│   ├── i18n/
│   │   └── en.json              # Diccionario de traducción al inglés (carga bajo demanda)
│   ├── icons/
│   │   ├── favicon.png          # Icono principal (180×180)
│   │   └── apple-touch-icon.png # Icono iOS / PWA (640×640)
│   └── images/splash/
│       ├── epsilon-sym.webp     # Símbolo de Épsilon Games Studio
│       ├── epsilon-word.webp    # Logotipo tipográfico
│       └── epsilon-sub.webp     # Subtítulo "Games Studio"
├── css/
│   ├── main.css                 # Estilos del juego, menús y controles táctiles
│   └── splash.css               # Estilos y animaciones de la intro y aviso iOS
└── js/
    ├── main.js                  # Núcleo de simulación, física, renderizado, HUD y flujo de menús
    ├── audio.js                 # Música y efectos sintetizados con Web Audio API
    ├── gamepad.js               # Soporte de mandos USB/BT (Xbox, PlayStation, Nintendo y PC)
    ├── sprites.js               # Generador procedural de sprites pixel-art en canvas
    ├── i18n.js                  # Gestor de idioma y carga diferida de traducciones
    ├── splash.js                # Secuencia de introducción y pantalla completa móvil
    ├── utils.js                 # Utilidades matemáticas y de color
    └── data/
        ├── vehicles.js          # Especificaciones de helicópteros y embarcaciones
        ├── missions.js          # Parámetros del planificador de misiones y presets
        └── campaign.js          # Guion, diálogos y misiones del modo campaña
```

## Soporte de mandos (USB / Bluetooth)

El juego incluye soporte nativo mediante la **W3C Gamepad API** (sin dependencias externas) para mandos de **Xbox / PC (XInput/DirectInput)**, **PlayStation (DualShock 4 / DualSense)** y **Nintendo Switch (Pro Controller / Joy-Con)**:

- **Detección automática y glifos dinámicos**: los iconos del HUD, tutorial, diálogos y avisos en pantalla cambian automáticamente entre teclado, táctil y el mando detectado (con fallback a Xbox para mandos genéricos de PC).
- **Vuelo y grúa analógicos**: control proporcional del helicóptero con el Stick Izquierdo (zona muerta radial y curva suave) y control de velocidad de la grúa con los gatillos (`LT/RT` o `L2/R2`) o el Stick Derecho.
- **Presets y remapeo**: desde el menú **Mando** (en el menú principal o en Pausa) se puede elegir entre el esquema **Estándar (Stick Izq.)** o **Cruceta de vuelo (D-Pad)**, ajustar la zona muerta, activar/desactivar la vibración háptica, probar los ejes/botones en vivo y remapear cada acción.
- **Seguridad y desconexión**: cortar el cable (`View / Share / -`) requiere mantener pulsado 0,5 s salvo si el cable está enganchado; si el mando se desconecta en vuelo, el juego se pausa automáticamente.

| Acción | Xbox / PC | PlayStation | Nintendo |
|---|---|---|---|
| Pilotar | Stick Izq. | Stick Izq. | Stick Izq. |
| Subir / bajar grúa | `LT` / `RT` o Stick Der. | `L2` / `R2` o Stick Der. | `ZL` / `ZR` o Stick Der. |
| Desplegar nadador | `A` | `✕` | `B` |
| Puerta lateral | `B` | `○` | `A` |
| Modo salto / grúa | `X` | `□` | `Y` |
| Recoger nadador | `Y` | `△` | `X` |
| Motor 1 (tierra) / Tren (vuelo) | `LB` | `L1` | `L` |
| Motor 2 (tierra) / Bengala (vuelo) | `RB` | `R1` | `R` |
| Batería / Foco / Luces / Silenciar | `D-Pad ◀ / ▲ / ▼ / ▶` | `D-Pad ◀ / ▲ / ▼ / ▶` | `D-Pad ◀ / ▲ / ▼ / ▶` |
| Cortar cable / Pausa | `View` (0,5 s) / `Menu` | `Share` (0,5 s) / `Options` | `-` (0,5 s) / `+` |

## Desarrollo local

El proyecto usa ES Modules nativos (`<script type="module">`) y carga las traducciones vía `fetch()`, por lo que requiere servirse mediante HTTP local (no abrir directamente con `file://`):

```bash
python3 -m http.server 8000
```

Después abre <http://localhost:8000> en el navegador.

## Despliegue

Pensado para servir archivos estáticos directamente en **GitHub Pages** desde la rama `main` sin paso de compilación.