/**
 * Download ZIP from Supabase Storage
 *
 * Streams the file to disk to avoid memory issues with large files.
 */
/**
 * Download a ZIP file from Supabase Storage to a temp file
 *
 * @param filePath - The file_path from apple_health_imports (e.g., "user-id/uuid.zip")
 * @param importId - The import ID for naming the temp file
 * @returns Path to the downloaded temp file
 */
export declare function downloadZip(filePath: string, importId: string): Promise<string>;
/**
 * Clean up the ZIP file after processing
 *
 * Note: We no longer extract XML to disk, so only the ZIP needs cleanup.
 *
 * @param zipPath - Path to the ZIP file to delete
 */
export declare function cleanupZipFile(zipPath: string): void;
/**
 * @deprecated Use cleanupZipFile instead
 */
export declare function cleanupTempFiles(importId: string): void;
//# sourceMappingURL=download.d.ts.map