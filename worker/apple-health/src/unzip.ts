/**
 * Unzip Apple Health export
 * 
 * Stream-unzips the ZIP and extracts ONLY export.xml to a temp file.
 * Handles the nested structure: apple_health_export/export.xml
 */

import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import * as unzipper from 'unzipper'
import { log } from './logger'

const TEMP_DIR = '/tmp'

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
export async function extractExportXml(zipPath: string, importId: string): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${importId}-export.xml`)
  
  log.info('Extracting export.xml from ZIP', {
    zip_path: zipPath,
    output_path: outputPath,
  })

  let foundExportXml = false

  // Create a read stream from the ZIP
  const zipStream = fs.createReadStream(zipPath)
  const unzipStream = zipStream.pipe(unzipper.Parse({ forceStream: true }))

  for await (const entry of unzipStream) {
    const filePath = entry.path as string
    const type = entry.type as string

    // Look for export.xml (may be at root or in apple_health_export/)
    const isExportXml = 
      filePath === 'export.xml' ||
      filePath === 'apple_health_export/export.xml' ||
      filePath.endsWith('/export.xml')

    if (type === 'File' && isExportXml) {
      log.info('Found export.xml', { entry_path: filePath })
      
      // Stream the file content to disk
      const writeStream = fs.createWriteStream(outputPath)
      await pipeline(entry, writeStream)
      
      foundExportXml = true
      
      const stats = fs.statSync(outputPath)
      log.info('Extracted export.xml', {
        output_path: outputPath,
        size_bytes: stats.size,
        size_mb: Math.round(stats.size / 1024 / 1024 * 10) / 10,
      })
    } else {
      // Skip this entry - important to drain it to continue the stream
      entry.autodrain()
    }
  }

  if (!foundExportXml) {
    throw new Error('export.xml not found in ZIP archive')
  }

  return outputPath
}

