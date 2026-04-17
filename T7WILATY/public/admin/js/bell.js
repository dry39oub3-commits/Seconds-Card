import { supabase } from '../../js/supabase-config.js';

async function updateBell() {
    const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .not('status', 'in', '("مكتمل","ملغي","مسترد")');

    const count = orders?.length || 0;
    const badge = document.getElementById('orders-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    if (count > 0) {
        document.title = `(${count}) طلب جديد | ${document.title.split('|').pop().trim()}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateBell();
    setInterval(updateBell, 30000);
});


document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = themeToggle.querySelector('i');

    // 1. جلب الثيم المحفوظ أو استخدام "النهاري" كافتراضي
    const currentTheme = localStorage.getItem('theme') || 'light';
    
    // 2. تطبيق الثيم عند التحميل
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateIcon(currentTheme);

    // 3. مستمع الأحداث عند الضغط على الزر
    themeToggle.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = (theme === 'dark') ? 'light' : 'dark';

        // تغيير السمة في الـ HTML
        document.documentElement.setAttribute('data-theme', newTheme);
        // حفظ الاختيار في التخزين المحلي
        localStorage.setItem('theme', newTheme);
        // تحديث الأيقونة
        updateIcon(newTheme);
    });

    // دالة لتحديث شكل الأيقونة
    function updateIcon(theme) {
        if (theme === 'dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
            themeIcon.style.color = '#fbbf24'; // لون أصفر للشمس
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
            themeIcon.style.color = '#ffffff';
        }
    }
});



