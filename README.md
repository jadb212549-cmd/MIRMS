# Material Reference & Sample Tracking System

A desktop and web reference sample management application built with **React**, **TypeScript**, **Tailwind CSS**, and **Tauri v2** with local **SQLite** persistence and zero inventory tracking.

---

## 🚀 Features

- **Master Item Catalog**: Manage raw materials (`RM`) and packaging supplies (`PS`) with duplicate-proof Product Codes.
- **Reference Sample Registrations**: Track registered samples, specifications, suppliers, revisions, photos, and file attachments.
- **Dynamic Word Document (`.docx`) Generation**: Live side-by-side preview with custom `{{placeholder}}` mapping and instant file export.
- **Excel Bulk Import / Export**: Standardized multi-sheet workbooks for rapid catalog onboarding.
- **Zero Inventory Mandate**: Purely focuses on quality references, specifications, and sample retention without stock/quantity bloat.
- **Cross-Platform Portable Desktop Support**: Standalone `.exe` for Windows with offline SQLite storage, with full support for macOS and Linux.
- **Real-Time Cross-Tab / Multi-Instance Sync**: BroadcastChannel-powered instant synchronization.

---

## 💻 Getting Started (Web Development)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/material-reference-tracker.git
   cd material-reference-tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local dev server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Build web production bundle:**
   ```bash
   npm run build
   ```

---

## 🦀 Tauri Desktop Application

### Prerequisites
- [Rust & Cargo](https://www.rust-lang.org/tools/install) (stable)
- Platform build tools:
  - **Windows**: [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### Running the Desktop App in Development
```bash
npm run tauri:dev
```

### Building the Desktop Executable
```bash
# Standard Tauri bundle (MSI, NSIS, DMG, AppImage, or Deb)
npm run tauri:build

# Standalone Portable EXE (without installer)
npm run tauri:build:portable
```

---

## 🤖 GitHub Actions CI/CD (Windows Portable EXE)

The repository includes a dedicated GitHub Actions workflow in `.github/workflows/windows-portable.yml` specifically for Windows:
- **Standalone Portable EXE Generation**: Compiles `ReferenceTracker.exe` (x64) without requiring system installers or administrator privileges.
- **Side-by-Side Visible Storage**: Automatically structures and packages the `ReferenceTracker_Data` directory right beside `ReferenceTracker.exe` with dedicated subfolders for database, photos, attachments, generated forms, templates, and backups.
- **Artifact Upload & Releases**: Uploads `ReferenceTracker-Windows-Portable-x64.zip` on every push/PR and drafts a GitHub Release when pushing version tags (e.g. `v1.0.0`).

---

## 📁 Portable Folder Layout

When downloaded or extracted, all application data is visibly stored right beside the executable:

```
ReferenceTracker-Windows-Portable/
├── ReferenceTracker.exe                   # Standalone desktop application
├── START_PORTABLE.bat                     # Quick launcher
├── README_PORTABLE.txt                    # Portable usage instructions
└── ReferenceTracker_Data/                 # Visible storage folder beside EXE
    ├── database/
    │   └── material_reference.db          # Offline SQLite master catalog & registrations
    ├── references/
    │   ├── PHOTOS/                        # High-resolution sample macro photos
    │   ├── ATTACHMENTS/                   # Certificates, TDS, and mill test documents
    │   └── FORMS/                         # Generated official Word .docx forms
    ├── templates/                         # Customizable Word .docx templates
    └── backups/                           # Full portable snapshot archives (.zip)
```

---

## 📁 Project Architecture

```
├── .github/
│   └── workflows/
│       └── tauri-build.yml       # GitHub Actions CI/CD workflow
├── src/
│   ├── components/               # UI views and interactive preview panes
│   ├── services/
│   │   ├── db.ts                 # Database service with SQLite/LocalStorage bridge
│   │   ├── tauriService.ts       # Tauri desktop IPC interface
│   │   ├── wordService.ts        # Word .docx generator with custom tags
│   │   ├── excelService.ts       # Excel spreadsheet importer/exporter
│   │   └── realtimeSync.ts       # Multi-instance synchronization
│   └── types.ts                  # TypeScript definitions
├── src-tauri/
│   ├── capabilities/             # Tauri v2 security capabilities
│   ├── src/
│   │   ├── main.rs               # Rust entry point & IPC handlers
│   │   ├── db.rs                 # Local SQLite database manager
│   │   └── models.rs             # Serde-serializable data structs
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri app configuration
├── package.json
└── vite.config.ts
```

---

## 📄 License
MIT License
