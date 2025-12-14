"use strict";
/**
 * Unzip Apple Health export
 *
 * Stream-unzips the ZIP and extracts ONLY export.xml to a temp file.
 * Handles the nested structure: apple_health_export/export.xml
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
async function extractExportXml(zipPath, importId) {
    const outputPath = path.join(TEMP_DIR, `${importId}-export.xml`);
    logger_1.log.info('Extracting export.xml from ZIP', {
        zip_path: zipPath,
        output_path: outputPath,
    });
    let foundExportXml = false;
    // Create a read stream from the ZIP
    const zipStream = fs.createReadStream(zipPath);
    const unzipStream = zipStream.pipe(unzipper.Parse({ forceStream: true }));
    for await (const entry of unzipStream) {
        const filePath = entry.path;
        const type = entry.type;
        // Look for export.xml (may be at root or in apple_health_export/)
        const isExportXml = filePath === 'export.xml' ||
            filePath === 'apple_health_export/export.xml' ||
            filePath.endsWith('/export.xml');
        if (type === 'File' && isExportXml) {
            logger_1.log.info('Found export.xml', { entry_path: filePath });
            // Stream the file content to disk
            const writeStream = fs.createWriteStream(outputPath);
            await (0, promises_1.pipeline)(entry, writeStream);
            foundExportXml = true;
            const stats = fs.statSync(outputPath);
            logger_1.log.info('Extracted export.xml', {
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
        throw new Error('export.xml not found in ZIP archive');
    }
    return outputPath;
}
//# sourceMappingURL=unzip.js.map