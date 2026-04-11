import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://btcmfdfepykwimukbiad.supabase.co";
const SUPABASE_KEY = "sb_publishable_UKw4zfQRW6-RsX8ntT_Ssw_ZnZuhvKd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: localStorage
    }
});

console.log("Supabase StorCards Connected Successfully!");