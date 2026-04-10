import { supabase } from './supabase-config.js';

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm('هل تريد تسجيل الخروج؟')) {
            const { error } = await supabase.auth.signOut();
            if (!error) {
                window.location.href = 'login.html';
            } else {
                console.error("Logout Error:", error);
            }
        }
    });
}