"use strict";
/**
 * Download ZIP from Supabase Storage
 *
 * Streams the file to disk to avoid memory issues with large files.
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
exports.downloadZip = downloadZip;
exports.cleanupZipFile = cleanupZipFile;
exports.cleanupTempFiles = cleanupTempFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const supabase_1 = require("./supabase");
const logger_1 = require("./logger");
const TEMP_DIR = '/tmp';
/**
 * Download a ZIP file from Supabase Storage to a temp file
 *
 * @param filePath - The file_path from apple_health_imports (e.g., "user-id/uuid.zip")
 * @param importId - The import ID for naming the temp file
 * @returns Path to the downloaded temp file
 */
async function downloadZip(filePath, importId) {
    const supabase = (0, supabase_1.getSupabase)();
    const tempPath = path.join(TEMP_DIR, `${importId}.zip`);
    logger_1.log.info('Downloading ZIP from storage', {
        file_path: filePath,
        temp_path: tempPath,
    });
    // Download the file as a blob/buffer first, then stream to disk
    const { data, error } = await supabase.storage
        .from('apple_health_uploads')
        .download(filePath);
    if (error) {
        throw new Error(`Failed to download from storage: ${error.message}`);
    }
    if (!data) {
        throw new Error('No data returned from storage download');
    }
    // Convert Blob to Buffer and write to file
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Stream write to avoid holding entire buffer
    const writeStream = fs.createWriteStream(tempPath);
    const readable = stream_1.Readable.from(buffer);
    await (0, promises_1.pipeline)(readable, writeStream);
    const stats = fs.statSync(tempPath);
    logger_1.log.info('ZIP downloaded', {
        temp_path: tempPath,
        size_bytes: stats.size,
        size_mb: Math.round(stats.size / 1024 / 1024 * 10) / 10,
    });
    return tempPath;
}
/**
 * Clean up the ZIP file after processing
 *
 * Note: We no longer extract XML to disk, so only the ZIP needs cleanup.
 *
 * @param zipPath - Path to the ZIP file to delete
 */
function cleanupZipFile(zipPath) {
    try {
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
            logger_1.log.debug('Deleted ZIP file', { path: zipPath });
        }
    }
    catch (err) {
        logger_1.log.warn('Failed to delete ZIP file', {
            path: zipPath,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
/**
 * @deprecated Use cleanupZipFile instead
 */
function cleanupTempFiles(importId) {
    const zipPath = path.join(TEMP_DIR, `${importId}.zip`);
    cleanupZipFile(zipPath);
}
//# sourceMappingURL=download.js.map