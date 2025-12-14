"use strict";
/**
 * Supabase client for the worker
 * Uses service role key for admin access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
let supabase = null;
/**
 * Get the Supabase client (singleton)
 * Uses service role key for full database access
 */
function getSupabase() {
    if (!supabase) {
        supabase = (0, supabase_js_1.createClient)(config_1.config.supabaseUrl, config_1.config.supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    return supabase;
}
//# sourceMappingURL=supabase.js.map