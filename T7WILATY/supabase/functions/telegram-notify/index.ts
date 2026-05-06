import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const SUPABASE_URL   = Deno.env.get('DB_URL')!
const SUPABASE_KEY   = Deno.env.get('DB_SERVICE_KEY')!
const ADMIN_CHAT_ID  = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!
const GROUP_CHAT_ID  = "-1003838600179"

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

serve(async (req) => {
    const body = await req.json().catch(() => ({}))

    // ── إشعار طلب جديد ──
    if (body.record) {
        const record = body.record
        const orderDisplayId = record.order_number || `S${record.id?.toString().slice(-6).toUpperCase()}`
        const category       = record.label || "—"
        const unitPrice      = record.price || 0
        const quantity       = record.quantity || 1
        const totalPrice     = unitPrice * quantity
        const rawMethod      = record.paymentMethod || record.payment_method
        const paymentMethod  = (!rawMethod || rawMethod === 'wallet') ? "المحفظة 💳" : rawMethod

        const message = `🔔 <b>إشعار طلب جديد</b> 🔔

🔸 <b>رقم الطلب:</b> #${orderDisplayId}
👤 <b>العميل:</b> ${record.customer_name || 'admin'}
📦 <b>المنتج:</b> ${record.product_name || 'غير محدد'}
🏷️ <b>الفئة:</b> ${category}
🔢 <b>الكمية:</b> ${quantity}
💰 <b>السعر الإجمالي:</b> ${totalPrice} MRU
💳 <b>طريقة الدفع:</b> ${paymentMethod}
📅 <b>التاريخ:</b> ${new Date(record.created_at).toLocaleString('fr-FR')}

--------------------------`

        await sendMessage(GROUP_CHAT_ID, message)
        await sendMessage(ADMIN_CHAT_ID, message)
        return new Response("Notification Sent", { status: 200 })
    }

    // ── أوامر البوت ──
    const msg = body?.message
    if (msg) {
        const chatId = String(msg.chat.id)
        const text   = (msg.text || '').trim()

        if (chatId !== ADMIN_CHAT_ID && chatId !== GROUP_CHAT_ID) {
            return new Response('ok')
        }

        if (text === '/start' || text === '/help') {
            await sendMessage(chatId, `🤖 <b>StoreCard Bot</b>

الأوامر المتاحة:
/orders — الطلبات قيد الانتظار
/stats — إحصائيات اليوم
/wallet — طلبات شحن المحفظة
/help — قائمة الأوامر`)

        } else if (text === '/orders') {
            const { data } = await supabase
                .from('orders')
                .select('order_number, product_name, label, price, quantity, customer_name, payment_method, paymentMethod, created_at')
                .not('status', 'in', '("مكتمل","ملغي","مسترد")')
                .order('created_at', { ascending: false })
                .limit(10)

            if (!data?.length) {
                await sendMessage(chatId, '📭 لا توجد طلبات جديدة حالياً')
            } else {
                const seen   = new Set()
                const unique = data.filter(o => { if (seen.has(o.order_number)) return false; seen.add(o.order_number); return true })
                const list   = unique.map(o => {
                    const pm   = o.paymentMethod || o.payment_method || '—'
                    const date = new Date(o.created_at).toLocaleString('ar-SA', { timeZone: 'Africa/Nouakchott' })
                    return `🔸 <b>${o.order_number}</b>\n📦 ${o.product_name} ${o.label ? `(${o.label})` : ''}\n👤 ${o.customer_name || '—'}\n💰 ${(o.price||0)*(o.quantity||1)} MRU\n💳 ${pm}\n🕐 ${date}`
                }).join('\n\n──────────\n\n')
                await sendMessage(chatId, `📋 <b>الطلبات الجديدة (${unique.length})</b>\n\n${list}`)
            }

        } else if (text === '/wallet') {
            const { data } = await supabase
                .from('wallet_transactions')
                .select('order_number, amount, payment_method, created_at')
                .eq('status', 'قيد المراجعة')
                .order('created_at', { ascending: false })
                .limit(10)

            if (!data?.length) {
                await sendMessage(chatId, '📭 لا توجد طلبات شحن معلقة')
            } else {
                const list = data.map(t => {
                    const date = new Date(t.created_at).toLocaleString('ar-SA', { timeZone: 'Africa/Nouakchott' })
                    return `💰 <b>${t.amount} MRU</b>\n💳 ${t.payment_method}\n🕐 ${date}`
                }).join('\n\n──────────\n\n')
                await sendMessage(chatId, `💼 <b>طلبات الشحن المعلقة (${data.length})</b>\n\n${list}`)
            }

        } else if (text === '/stats') {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const { data: orders } = await supabase
                .from('orders')
                .select('status, price, quantity')
                .gte('created_at', today.toISOString())

            const total     = orders?.length || 0
            const completed = orders?.filter(o => o.status === 'مكتمل').length || 0
            const pending   = orders?.filter(o => o.status !== 'مكتمل' && o.status !== 'ملغي').length || 0
            const revenue   = orders?.filter(o => o.status === 'مكتمل').reduce((s, o) => s + (o.price||0)*(o.quantity||1), 0) || 0

            await sendMessage(chatId, `📊 <b>إحصائيات اليوم</b>

📦 إجمالي الطلبات: <b>${total}</b>
✅ مكتملة: <b>${completed}</b>
⏳ معلقة: <b>${pending}</b>
💰 الإيرادات: <b>${revenue} MRU</b>`)

        } else {
            await sendMessage(chatId, '❓ أمر غير معروف — أرسل /help لقائمة الأوامر')
        }
    }

    return new Response('ok')
})

async function sendMessage(chatId: string, text: string) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
}