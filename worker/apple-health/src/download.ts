/**
 * Download ZIP from Supabase Storage
 * 
 * Streams the file to disk to avoid memory issues with large files.
 */

import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { getSupabase } from './supabase'
import { log } from './logger'

const TEMP_DIR = '/tmp'

/**
 * Download a ZIP file from Supabase Storage to a temp file
 * 
 * @param filePath - The file_path from apple_health_imports (e.g., "user-id/uuid.zip")
 * @param importId - The import ID for naming the temp file
 * @returns Path to the downloaded temp file
 */
export async function downloadZip(filePath: string, importId: string): Promise<string> {
  const supabase = getSupabase()
  const tempPath = path.join(TEMP_DIR, `${importId}.zip`)
  
  log.info('Downloading ZIP from storage', {
    file_path: filePath,
    temp_path: tempPath,
  })

  // Download the file as a blob/buffer first, then stream to disk
  const { data, error } = await supabase.storage
    .from('apple_health_uploads')
    .download(filePath)

  if (error) {
    throw new Error(`Failed to download from storage: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data returned from storage download')
  }

  // Convert Blob to Buffer and write to file
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // Stream write to avoid holding entire buffer
  const writeStream = fs.createWriteStream(tempPath)
  const readable = Readable.from(buffer)
  
  await pipeline(readable, writeStream)

  const stats = fs.statSync(tempPath)
  log.info('ZIP downloaded', {
    temp_path: tempPath,
    size_bytes: stats.size,
    size_mb: Math.round(stats.size / 1024 / 1024 * 10) / 10,
  })

  return tempPath
}

/**
 * Clean up the ZIP file after processing
 * 
 * Note: We no longer extract XML to disk, so only the ZIP needs cleanup.
 * 
 * @param zipPath - Path to the ZIP file to delete
 */
export function cleanupZipFile(zipPath: string): void {
  try {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath)
      log.debug('Deleted ZIP file', { path: zipPath })
    }
  } catch (err) {
    log.warn('Failed to delete ZIP file', {
      path: zipPath,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * @deprecated Use cleanupZipFile instead
 */
export function cleanupTempFiles(importId: string): void {
  const zipPath = path.join(TEMP_DIR, `${importId}.zip`)
  cleanupZipFile(zipPath)
}
