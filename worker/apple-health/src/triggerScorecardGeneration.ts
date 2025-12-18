/**
 * Trigger scorecard generation on Vercel app
 * 
 * Calls the internal endpoint to auto-generate a scorecard after processing completes.
 * Uses exponential backoff retries for network/5xx errors.
 */

import { config } from './config'
import { log } from './logger'

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [500, 1500, 3000] // Exponential backoff

/**
 * Call the Vercel scorecard generation endpoint
 * 
 * @param userId - User ID to generate scorecard for
 * @returns true if successful, false otherwise
 */
export async function triggerScorecardGeneration(userId: string): Promise<boolean> {
  // Check if configured
  if (!config.edenAppUrl || !config.workerSecret) {
    log.debug('Scorecard generation not configured (missing EDEN_APP_URL or WORKER_SECRET)', {
      eden_app_url_configured: !!config.edenAppUrl,
      worker_secret_configured: !!config.workerSecret,
    })
    return false
  }

  const url = `${config.edenAppUrl}/api/internal/scorecard/generate`
  const headers = {
    'Authorization': `Bearer ${config.workerSecret}`,
    'Content-Type': 'application/json',
  }
  const body = JSON.stringify({ user_id: userId })

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      })

      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean
          scorecard_id?: string
          generated_at?: string
        }
        log.info('Scorecard generation triggered successfully', {
          user_id: userId,
          attempt: attempt + 1,
          scorecard_id: data.scorecard_id,
          generated_at: data.generated_at,
        })
        return true
      }

      // Non-2xx response
      const status = response.status
      const responseText = await response.text().catch(() => '')
      const truncatedText = responseText.slice(0, 200) // Truncate for logging

      // Retry on 5xx errors or network issues
      const shouldRetry = status >= 500 && attempt < MAX_RETRIES

      if (shouldRetry) {
        const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
        log.warn('Scorecard generation failed, retrying', {
          user_id: userId,
          attempt: attempt + 1,
          max_retries: MAX_RETRIES + 1,
          status,
          response_preview: truncatedText,
          retry_delay_ms: delay,
        })
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Non-retryable error (4xx) or max retries reached
      log.warn('Scorecard generation failed (non-retryable or max retries)', {
        user_id: userId,
        attempt: attempt + 1,
        status,
        response_preview: truncatedText,
      })
      return false

    } catch (error) {
      // Network error or other exception
      const errorMessage = error instanceof Error ? error.message : String(error)
      const shouldRetry = attempt < MAX_RETRIES

      if (shouldRetry) {
        const delay = RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
        log.warn('Scorecard generation network error, retrying', {
          user_id: userId,
          attempt: attempt + 1,
          max_retries: MAX_RETRIES + 1,
          error: errorMessage,
          retry_delay_ms: delay,
        })
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // Max retries reached
      log.warn('Scorecard generation failed after all retries', {
        user_id: userId,
        attempt: attempt + 1,
        error: errorMessage,
      })
      return false
    }
  }

  return false
}

