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


(function(){
    // تطبيق الثيم المحفوظ فوراً
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';

    document.getElementById('theme-toggle').onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        const icon = document.querySelector('#theme-toggle i');
        if (icon) icon.className = next === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    };
})();