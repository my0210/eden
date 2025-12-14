/**
 * Configuration for the Apple Health worker
 * All values come from environment variables
 */
export declare const config: {
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    pollIntervalMs: number;
    workerConcurrency: number;
    logLevel: string;
};
export type Config = typeof config;
//# sourceMappingURL=config.d.ts.map