"use strict";
/**
 * Unzip Apple Health export
 *
 * Stream-unzips the ZIP and extracts ONLY Export.xml to a temp file.
 * Handles case differences (Export.xml vs export.xml) and nested paths.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractExportXml = extractExportXml;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const promises_1 = require("stream/promises");
const unzipper = __importStar(require("unzipper"));
const logger_1 = require("./logger");
const TEMP_DIR = '/tmp';
/**
 * Get the basename of a path (the filename after the last /)
 */
function getBasename(filePath) {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || '';
}
/**
 * Check if an entry should be ignored (macOS junk, directories, etc.)
 */
function shouldIgnoreEntry(filePath, type) {
    // Ignore directories
    if (type === 'Directory')
        return true;
    // Ignore macOS resource fork junk
    if (filePath.startsWith('__MACOSX/'))
        return true;
    if (filePath.includes('/__MACOSX/'))
        return true;
    // Ignore .DS_Store
    if (getBasename(filePath) === '.DS_Store')
        return true;
    return false;
}
/**
 * Check if this entry is the Export.xml file (case-insensitive)
 */
function isExportXml(filePath) {
    const basename = getBasename(filePath);
    return basename.toLowerCase() === 'export.xml';
}
/**
 * Check if this entry is export_cda.xml (case-insensitive)
 */
function isExportCdaXml(filePath) {
    const basename = getBasename(filePath);
    return basename.toLowerCase() === 'export_cda.xml';
}
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
async function extractExportXml(zipPath, importId) {
    const outputPath = path.join(TEMP_DIR, `${importId}-export.xml`);
    logger_1.log.info('Extracting Export.xml from ZIP', {
        zip_path: zipPath,
        output_path: outputPath,
    });
    let foundExportXml = false;
    let foundExportCdaXml = false;
    const entriesSeen = []; // Track entries for debugging
    // Create a read stream from the ZIP
    const zipStream = fs.createReadStream(zipPath);
    const unzipStream = zipStream.pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of unzipStream) {
        const filePath = entry.path;
        const type = entry.type;
        // Track entries for debugging (first 30)
        if (entriesSeen.length < 30 && type === 'File') {
            entriesSeen.push(filePath);
        }
        // Skip junk entries
        if (shouldIgnoreEntry(filePath, type)) {
            entry.autodrain();
            continue;
        }
        // Track if we see export_cda.xml
        if (isExportCdaXml(filePath)) {
            foundExportCdaXml = true;
            entry.autodrain();
            continue;
        }
        // Check for Export.xml (case-insensitive)
        if (type === 'File' && isExportXml(filePath)) {
            logger_1.log.info('Found Export.xml', {
                entry_path: filePath,
                basename: getBasename(filePath),
            });
            // Stream the file content to disk
            const writeStream = fs.createWriteStream(outputPath);
            await (0, promises_1.pipeline)(entry, writeStream);
            foundExportXml = true;
            const stats = fs.statSync(outputPath);
            logger_1.log.info('Extracted Export.xml', {
                output_path: outputPath,
                size_bytes: stats.size,
                size_mb: Math.round(stats.size / 1024 / 1024 * 10) / 10,
            });
        }
        else {
            // Skip this entry - important to drain it to continue the stream
            entry.autodrain();
        }
    }
    if (!foundExportXml) {
        // Build a helpful error message
        let errorMsg = 'Export.xml not found in ZIP archive';
        if (foundExportCdaXml) {
            errorMsg = 'Found export_cda.xml but not Export.xml. The ZIP may be incomplete or corrupted.';
        }
        logger_1.log.error('Export.xml not found', {
            found_export_cda: foundExportCdaXml,
            entries_seen: entriesSeen,
        });
        throw new Error(errorMsg);
    }
    return outputPath;
}
//# sourceMappingURL=unzip.js.map