/**
 * Trigger scorecard generation on Vercel app
 *
 * Calls the internal endpoint to auto-generate a scorecard after processing completes.
 * Uses exponential backoff retries for network/5xx errors.
 */
/**
 * Call the Vercel scorecard generation endpoint
 *
 * @param userId - User ID to generate scorecard for
 * @returns true if successful, false otherwise
 */
export declare function triggerScorecardGeneration(userId: string): Promise<boolean>;
//# sourceMappingURL=triggerScorecardGeneration.d.ts.map