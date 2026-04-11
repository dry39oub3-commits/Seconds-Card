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