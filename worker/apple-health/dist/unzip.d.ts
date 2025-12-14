/**
 * Unzip Apple Health export
 *
 * Opens ZIP and provides a stream to Export.xml without extracting to disk.
 * Handles case differences (Export.xml vs export.xml) and nested paths.
 */
import { Readable } from 'stream';
/**
 * Result of finding Export.xml in a ZIP
 */
export interface ExportXmlEntry {
    /** Full path in ZIP (e.g., "apple_health_export/Export.xml") */
    path: string;
    /** Readable stream of the XML content */
    stream: Readable;
    /** Uncompressed size if available */
    uncompressedSize?: number;
}
/**
 * Find and open Export.xml from a ZIP file, returning a readable stream.
 *
 * Does NOT extract to disk - streams directly from the ZIP.
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
 * @returns ExportXmlEntry with stream, or throws if not found
 */
export declare function findExportXmlStream(zipPath: string): Promise<ExportXmlEntry>;
/**
 * Legacy function - kept for backwards compatibility but deprecated.
 * Use findExportXmlStream instead.
 * @deprecated Use findExportXmlStream for streaming parse
 */
export declare function extractExportXml(zipPath: string, importId: string): Promise<string>;
//# sourceMappingURL=unzip.d.ts.map