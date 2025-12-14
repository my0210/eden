/**
 * Unzip Apple Health export
 * 
 * Opens ZIP and provides a stream to Export.xml without extracting to disk.
 * Handles case differences (Export.xml vs export.xml) and nested paths.
 */

import * as fs from 'fs'
import { Readable } from 'stream'
import * as unzipper from 'unzipper'
import { log } from './logger'

/**
 * Result of finding Export.xml in a ZIP
 */
export interface ExportXmlEntry {
  /** Full path in ZIP (e.g., "apple_health_export/Export.xml") */
  path: string
  /** Readable stream of the XML content */
  stream: Readable
  /** Uncompressed size if available */
  uncompressedSize?: number
}

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
export async function findExportXmlStream(zipPath: string): Promise<ExportXmlEntry> {
  log.info('Opening ZIP to find Export.xml', { zip_path: zipPath })

  const entriesSeen: string[] = []
  let foundExportCdaXml = false

  // Open the ZIP file
  const directory = await unzipper.Open.file(zipPath)
  
  // Scan all entries
  for (const entry of directory.files) {
    const filePath = entry.path
    const type = entry.type
    
    // Track entries for debugging (first 30 files only)
    if (entriesSeen.length < 30 && type === 'File') {
      entriesSeen.push(filePath)
    }

    // Skip junk entries
    if (shouldIgnoreEntry(filePath, type)) {
      continue
    }

    // Track if we see export_cda.xml
    if (isExportCdaXml(filePath)) {
      foundExportCdaXml = true
      continue
    }

    // Check for Export.xml (case-insensitive)
    if (type === 'File' && isExportXml(filePath)) {
      log.info('Found Export.xml in ZIP', { 
        entry_path: filePath,
        basename: getBasename(filePath),
        uncompressed_size: entry.uncompressedSize,
        uncompressed_mb: entry.uncompressedSize 
          ? Math.round(entry.uncompressedSize / 1024 / 1024 * 10) / 10 
          : undefined,
      })
      
      // Return a readable stream for this entry
      const stream = entry.stream()
      
      return {
        path: filePath,
        stream: stream as Readable,
        uncompressedSize: entry.uncompressedSize,
      }
    }
  }

  // Not found - build helpful error message
  let errorMsg = 'Export.xml not found in ZIP archive'
  
  if (foundExportCdaXml) {
    errorMsg = 'Found export_cda.xml but not Export.xml. The ZIP may be incomplete or corrupted.'
  }
  
  log.error('Export.xml not found', {
    found_export_cda: foundExportCdaXml,
    entries_seen: entriesSeen,
    total_files: directory.files.length,
  })
  
  throw new Error(`${errorMsg}. Entries seen: ${entriesSeen.slice(0, 10).join(', ')}${entriesSeen.length > 10 ? '...' : ''}`)
}

/**
 * Legacy function - kept for backwards compatibility but deprecated.
 * Use findExportXmlStream instead.
 * @deprecated Use findExportXmlStream for streaming parse
 */
export async function extractExportXml(zipPath: string, importId: string): Promise<string> {
  throw new Error('extractExportXml is deprecated. Use findExportXmlStream for streaming parse.')
}
