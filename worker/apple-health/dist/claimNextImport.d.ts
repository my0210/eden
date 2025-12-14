/**
 * Atomic claim logic for Apple Health imports
 *
 * Uses optimistic locking to ensure only one worker processes each import:
 * 1. Find the oldest 'uploaded' import
 * 2. Attempt to atomically update it to 'processing'
 * 3. If update returns 0 rows, another worker claimed it - return null
 */
import { AppleHealthImport } from './supabase';
/**
 * Attempt to claim the next available import for processing
 * Returns the claimed import or null if none available
 */
export declare function claimNextImport(): Promise<AppleHealthImport | null>;
//# sourceMappingURL=claimNextImport.d.ts.map