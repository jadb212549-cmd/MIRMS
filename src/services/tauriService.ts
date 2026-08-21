/**
 * Tauri desktop bridge service.
 * Supports Windows Portable EXE file operations, dialogs, paths, and SQLite commands.
 * Falls back gracefully to browser-safe operations when running in Web/Preview mode.
 */

// Check if running inside Tauri window context
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export interface FileSelectionResult {
  filePath?: string;
  fileName: string;
  fileData?: ArrayBuffer | string;
  fileSize: number;
}

export const tauriBridge = {
  isDesktop: isTauri,

  async openDataFolder(customPath?: string): Promise<string> {
    const targetPath = customPath || 'Application Data/ReferenceTracker_Data/';
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('open_data_folder', { path: targetPath });
      } catch (err) {
        console.warn('Tauri open_data_folder fallback:', err);
      }
    }
    return targetPath;
  },

  async getDataDirectory(): Promise<string> {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke('get_data_directory');
      } catch (err) {
        console.warn('Tauri get_data_directory fallback:', err);
      }
    }
    return 'Application Data/ReferenceTracker_Data/';
  },

  async pickExcelFile(): Promise<FileSelectionResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx, .xls, .csv';
      input.onchange = async (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const buffer = await file.arrayBuffer();
          resolve({
            fileName: file.name,
            fileSize: file.size,
            fileData: buffer
          });
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  async pickImageFile(): Promise<FileSelectionResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png, image/jpeg, image/webp, image/bmp, image/svg+xml';
      input.onchange = async (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              fileName: file.name,
              fileSize: file.size,
              fileData: reader.result as string
            });
          };
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  async pickMultipleImageFiles(): Promise<FileSelectionResult[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/png, image/jpeg, image/webp, image/bmp, image/svg+xml';
      input.onchange = async (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          resolve([]);
          return;
        }

        const results: FileSelectionResult[] = [];
        const fileList = Array.from(files);

        for (const file of fileList) {
          await new Promise<void>((fileResolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              results.push({
                fileName: file.name,
                fileSize: file.size,
                fileData: reader.result as string
              });
              fileResolve();
            };
            reader.onerror = () => fileResolve();
            reader.readAsDataURL(file);
          });
        }
        resolve(results);
      };
      input.click();
    });
  },

  async readFilesFromDrop(dataTransfer: DataTransfer): Promise<FileSelectionResult[]> {
    const results: FileSelectionResult[] = [];
    const files = Array.from(dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      await new Promise<void>((fileResolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          results.push({
            fileName: file.name,
            fileSize: file.size,
            fileData: reader.result as string
          });
          fileResolve();
        };
        reader.onerror = () => fileResolve();
        reader.readAsDataURL(file);
      });
    }
    return results;
  },

  async pickDocumentFile(): Promise<FileSelectionResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf, .docx, .doc, .txt, .xlsx, .zip';
      input.onchange = async (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              fileName: file.name,
              fileSize: file.size,
              fileData: reader.result as string
            });
          };
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  async pickBackupZipFile(): Promise<FileSelectionResult | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';
      input.onchange = async (e: Event) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const file = files[0];
          const buffer = await file.arrayBuffer();
          resolve({
            fileName: file.name,
            fileSize: file.size,
            fileData: buffer
          });
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },

  saveFileBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
};
