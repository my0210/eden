/**
 * Photo Analysis Prompts
 * 
 * OpenAI Vision prompts for body photo analysis.
 * Two-phase approach: validation first, then analysis.
 */

/**
 * System prompt for the photo analyzer
 */
export const PHOTO_ANALYSIS_SYSTEM_PROMPT = `You are a body composition analysis assistant for a health tracking app. Your role is to analyze body photos to estimate body fat percentage and midsection adiposity.

CRITICAL RULES:
1. NEVER use judgmental language like "overweight", "fat", "skinny", "bad"
2. Use neutral terms: "body composition", "body fat percentage", "midsection"
3. Frame everything as data points, not judgments
4. Be conservative - wider ranges when uncertain
5. Return "unable_to_estimate" when you cannot make a reliable estimate
6. This is NOT medical advice - it's for personal health tracking only

SAFETY REQUIREMENTS:
- REJECT any photo showing a minor (under 18)
- REJECT explicit nudity or inappropriate content
- REJECT if multiple people are visible
- Only analyze adult individuals`

/**
 * User prompt for photo analysis
 */
export const PHOTO_ANALYSIS_USER_PROMPT = `Analyze this photo for body composition metrics.

STEP 1 - VALIDATION (do this first):
Check the photo and REJECT if ANY of these apply:
- Not showing full body (need head to at least knees visible)
- Multiple people are visible
- Image is too blurry or dark to analyze
- Explicit nudity or inappropriate content
- The person appears to be a minor (under 18)

If rejecting, return ONLY:
{
  "validation": {
    "valid": false,
    "rejection_reason": "<one of: not_full_body, multiple_people, too_blurry, too_dark, inappropriate_content, appears_minor, other>",
    "user_message": "<friendly message explaining why>"
  },
  "analysis_version": "1.0",
  "analyzed_at": "<ISO timestamp>"
}

STEP 2 - ANALYSIS (only if validation passes):
Extract these TWO metrics only:

1. BODY FAT PERCENTAGE RANGE
   - Provide a range (e.g., 18-24)
   - Be conservative - use wider range if uncertain (±5-8%)
   - If clothing significantly obscures the torso, return "unable_to_estimate"

2. MIDSECTION ADIPOSITY (central fat distribution)
   - Options: "low", "moderate", or "high"
   - Assess visible fat accumulation around midsection/abdomen
   - If midsection is not visible, return "unable_to_estimate"

DO NOT estimate: muscle tone, posture, or any other metrics.

For each metric, either provide the estimate OR return:
{ "unable_to_estimate": true, "reason": "<brief explanation>" }

Return JSON in this exact format:
{
  "validation": {
    "valid": true
  },
  "body_fat_estimate": {
    "range_low": <number>,
    "range_high": <number>
  },
  "midsection_adiposity": {
    "level": "<low|moderate|high>"
  },
  "analysis_version": "1.0",
  "analyzed_at": "<ISO timestamp>"
}

Or if unable to estimate:
{
  "validation": {
    "valid": true
  },
  "body_fat_estimate": {
    "unable_to_estimate": true,
    "reason": "Clothing obscures torso"
  },
  "midsection_adiposity": {
    "level": "moderate"
  },
  "analysis_version": "1.0",
  "analyzed_at": "<ISO timestamp>"
}

Return ONLY valid JSON, no additional text.`

/**
 * Build the messages array for OpenAI Vision API
 */
export function buildPhotoAnalysisMessages(imageUrl: string): Array<{
  role: 'system' | 'user'
  content: string | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>
}> {
  return [
    {
      role: 'system',
      content: PHOTO_ANALYSIS_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: PHOTO_ANALYSIS_USER_PROMPT,
        },
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
          },
        },
      ],
    },
  ]
}

/**
 * Parse and validate the LLM response
 */
export function parsePhotoAnalysisResponse(response: string): {
  success: boolean
  data?: unknown
  error?: string
} {
  try {
    // Try to extract JSON from the response
    let jsonStr = response.trim()
    
    // Handle markdown code blocks
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match) {
        jsonStr = match[1]
      }
    }
    
    const parsed = JSON.parse(jsonStr)
    
    // Validate required fields
    if (!parsed.validation || typeof parsed.validation.valid !== 'boolean') {
      return { success: false, error: 'Missing validation field' }
    }
    
    if (!parsed.analysis_version) {
      return { success: false, error: 'Missing analysis_version' }
    }
    
    return { success: true, data: parsed }
  } catch (e) {
    return { success: false, error: `JSON parse error: ${e instanceof Error ? e.message : 'Unknown'}` }
  }
}

