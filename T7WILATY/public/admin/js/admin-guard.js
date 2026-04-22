// admin/js/admin-guard.js
import { supabase } from '../../js/supabase-config.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = 'login.html'; }
else {
    const { data: u } = await supabase.from('users').select('is_admin').eq('id', session.user.id).single();
    if (!u?.is_admin) window.location.href = 'login.html';
}