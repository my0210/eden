/**
 * Unzip Apple Health export
 *
 * Stream-unzips the ZIP and extracts ONLY export.xml to a temp file.
 * Handles the nested structure: apple_health_export/export.xml
 */
/**
 * Extract export.xml from an Apple Health ZIP file
 *
 * Apple Health exports have structure:
 * - apple_health_export/
 *   - export.xml
 *   - export_cda.xml (clinical data, we ignore)
 *   - workout-routes/ (GPX files, we ignore)
 *   - electrocardiograms/ (we ignore for now)
 *
 * @param zipPath - Path to the downloaded ZIP file
 * @param importId - Import ID for naming the output file
 * @returns Path to the extracted export.xml
 */
export declare function extractExportXml(zipPath: string, importId: string): Promise<string>;
//# sourceMappingURL=unzip.d.ts.map