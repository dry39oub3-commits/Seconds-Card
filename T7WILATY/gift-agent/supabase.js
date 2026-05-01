require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// جلب الطلبات الجديدة
async function getPendingOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'قيد الانتظار')
    .is('card_code', null);

  if (error) {
    console.error('خطأ في جلب الطلبات:', error);
    return [];
  }
  return data;
}

// تحديث الطلب بعد الانتهاء
async function updateOrder(orderId, cardCode, status) {
  const { error } = await supabase
    .from('orders')
    .update({
      card_code: cardCode,
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) {
    console.error('خطأ في تحديث الطلب:', error);
    return false;
  }
  return true;
}

// الاستماع للطلبات الجديدة في الوقت الفعلي
function listenToNewOrders(callback) {
  supabase
    .channel('orders-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      },
      (payload) => {
        console.log('📦 طلب جديد وصل:', payload.new);
        callback(payload.new);
      }
    )
    .subscribe();

  console.log('👂 الوكيل يستمع للطلبات الجديدة...');
}

// جلب رابط المورد من جدول products
async function getSupplierUrl(productName, price) {
  const { data, error } = await supabase
    .from('products')
    .select('prices')
    .ilike('name', `%${productName}%`)
    .limit(1)
    .single();

  if (error || !data) return null;

  // البحث في كل فئات السعر عن مورد عنده URL
  for (const priceItem of data.prices || []) {
    for (const supplier of priceItem.suppliers || []) {
      if (supplier.url && supplier.url.trim() !== '') {
        return { url: supplier.url, name: supplier.name };
      }
    }
  }
  return null;
}

module.exports = { getPendingOrders, updateOrder, listenToNewOrders, getSupplierUrl };