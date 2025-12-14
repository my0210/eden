/**
 * Unzip Apple Health export
 * 
 * Stream-unzips the ZIP and extracts ONLY Export.xml to a temp file.
 * Handles case differences (Export.xml vs export.xml) and nested paths.
 */

import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import * as unzipper from 'unzipper'
import { log } from './logger'

const TEMP_DIR = '/tmp'

/**
 * Get the basename of a path (the filename after the last /)
 */
function getBasename(filePath: string): string {
  const parts = filePath.split('/')
  return parts[parts.length - 1] || ''
}

/**
 * Check if an entry should be ignored (macOS junk, directories, etc.)
 */
function shouldIgnoreEntry(filePath: string, type: string): boolean {
  // Ignore directories
  if (type === 'Directory') return true
  
  // Ignore macOS resource fork junk
  if (filePath.startsWith('__MACOSX/')) return true
  if (filePath.includes('/__MACOSX/')) return true
  
  // Ignore .DS_Store
  if (getBasename(filePath) === '.DS_Store') return true
  
  return false
}

/**
 * Check if this entry is the Export.xml file (case-insensitive)
 */
function isExportXml(filePath: string): boolean {
  const basename = getBasename(filePath)
  return basename.toLowerCase() === 'export.xml'
}

/**
 * Check if this entry is export_cda.xml (case-insensitive)
 */
function isExportCdaXml(filePath: string): boolean {
  const basename = getBasename(filePath)
  return basename.toLowerCase() === 'export_cda.xml'
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
export async function extractExportXml(zipPath: string, importId: string): Promise<string> {
  const outputPath = path.join(TEMP_DIR, `${importId}-export.xml`)
  
  log.info('Extracting Export.xml from ZIP', {
    zip_path: zipPath,
    output_path: outputPath,
  })

  let foundExportXml = false
  let foundExportCdaXml = false
  const entriesSeen: string[] = []  // Track entries for debugging

  // Create a read stream from the ZIP
  const zipStream = fs.createReadStream(zipPath)
  const unzipStream = zipStream.pipe(unzipper.Parse({ forceStream: true }))

  for await (const entry of unzipStream) {
    const filePath = entry.path as string
    const type = entry.type as string
    
    // Track entries for debugging (first 30)
    if (entriesSeen.length < 30 && type === 'File') {
      entriesSeen.push(filePath)
    }

    // Skip junk entries
    if (shouldIgnoreEntry(filePath, type)) {
      entry.autodrain()
      continue
    }

    // Track if we see export_cda.xml
    if (isExportCdaXml(filePath)) {
      foundExportCdaXml = true
      entry.autodrain()
      continue
    }

    // Check for Export.xml (case-insensitive)
    if (type === 'File' && isExportXml(filePath)) {
      log.info('Found Export.xml', { 
        entry_path: filePath,
        basename: getBasename(filePath),
      })
      
      // Stream the file content to disk
      const writeStream = fs.createWriteStream(outputPath)
      await pipeline(entry, writeStream)
      
      foundExportXml = true
      
      const stats = fs.statSync(outputPath)
      log.info('Extracted Export.xml', {
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
    // Build a helpful error message
    let errorMsg = 'Export.xml not found in ZIP archive'
    
    if (foundExportCdaXml) {
      errorMsg = 'Found export_cda.xml but not Export.xml. The ZIP may be incomplete or corrupted.'
    }
    
    log.error('Export.xml not found', {
      found_export_cda: foundExportCdaXml,
      entries_seen: entriesSeen,
    })
    
    throw new Error(errorMsg)
  }

  return outputPath
}
