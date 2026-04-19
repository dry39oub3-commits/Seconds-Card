import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://btcmfdfepykwimukbiad.supabase.co";
const SUPABASE_KEY = "sb_publishable_UKw4zfQRW6-RsX8ntT_Ssw_ZnZuhvKd";

// ← Client العادي للمستخدمين
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'sb-secondscard-auth',
        detectSessionInUrl: true
    }
});

// ← Client الأدمن (للعمليات الخاصة مثل تغيير كلمة المرور)
const SERVICE_ROLE_KEY = "sb_secret_SQlWJXwHuIkmIrct58rSuQ_yV2VD6k-"; 

export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log("Supabase SecondsCard Connected Successfully!");