import { supabase } from './supabase-config.js';

export async function updateAuthUI() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    const userMenuContainer = document.querySelector('.user-menu-container');
    const loginBtn = document.getElementById('login-btn-header');

    if (userMenuContainer) {
        userMenuContainer.style.display = user ? 'block' : 'none';
    }

    // إذا أردت إضافة زر تسجيل دخول في الهيدر للزوار
    if (loginBtn) {
        loginBtn.style.display = user ? 'none' : 'block';
    }
}