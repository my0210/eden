/**
 * Unzip Apple Health export
 *
 * Stream-unzips the ZIP and extracts ONLY Export.xml to a temp file.
 * Handles case differences (Export.xml vs export.xml) and nested paths.
 */
/**
 * Extract Export.xml from an Apple Health ZIP file
 *
 * Apple Health exports have structure:
 * - apple_health_export/
 *   - Export.xml (main HealthKit data - THIS IS WHAT WE WANT)
 *   - export_cda.xml (clinical document format, we ignore)
 *   - workout-routes/ (GPX files, we ignore)
 *   - electrocardiograms/ (we ignore for now)
 *
 * Handles:
 * - Case differences: Export.xml, export.xml, EXPORT.XML
 * - Nested paths: apple_health_export/Export.xml
 * - macOS junk: __MACOSX/ folders
 *
 * @param zipPath - Path to the downloaded ZIP file
 * @param importId - Import ID for naming the output file
 * @returns Path to the extracted Export.xml
 */
export declare function extractExportXml(zipPath: string, importId: string): Promise<string>;
//# sourceMappingURL=unzip.d.ts.map