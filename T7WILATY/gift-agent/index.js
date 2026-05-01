require('dotenv').config();
const { listenToNewOrders, updateOrder, getPendingOrders } = require('./supabase');
const { sendMessage, waitForConfirmation } = require('./telegram');
const { purchaseCard, extractCardCode, closeBrowser } = require('./browser');

console.log('🤖 وكيل بطاقات الهدايا يعمل...');

// معالجة طلب واحد
async function processOrder(order) {
  console.log(`\n📦 معالجة طلب: ${order.product_name}`);

  try {
    // إشعار البداية
    await sendMessage(`⏳ جاري معالجة طلب: ${order.product_name}`);

    // فتح المتصفح والذهاب للموقع
    const result = await purchaseCard(order);

    if (!result.success) {
      await sendMessage(`❌ فشل في فتح موقع المزود: ${result.error}`);
      await updateOrder(order.id, null, 'ملغي');
      return;
    }

    // طلب تأكيد الدفع من المستخدم
    const confirmed = await waitForConfirmation(order);

    if (!confirmed) {
      await sendMessage('❌ تم إلغاء الطلب');
      await updateOrder(order.id, null, 'ملغي');
      await closeBrowser();
      return;
    }

    // انتظار معالجة الدفع
    await sendMessage('⏳ جاري استخراج كود البطاقة...');
    await new Promise(r => setTimeout(r, 5000));

    // استخراج الكود
    const cardCode = await extractCardCode();

    if (!cardCode) {
      await sendMessage('⚠️ لم يتم العثور على الكود، تحقق يدوياً');
      await updateOrder(order.id, null, 'ملغي');
      await closeBrowser();
      return;
    }

    // حفظ الكود وتحديث الطلب
    await updateOrder(order.id, cardCode, 'مكتمل');
    await sendMessage(`✅ تم بنجاح!\n\n🎁 الكود: ${cardCode}\n📦 الطلب: ${order.product_name}`);
    console.log(`✅ تم إكمال الطلب - الكود: ${cardCode}`);

    await closeBrowser();

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    await sendMessage(`❌ خطأ غير متوقع: ${error.message}`);
    await updateOrder(order.id, null, 'ملغي');
    await closeBrowser();
  }
}

// معالجة الطلبات المعلقة عند البدء
async function processPendingOrders() {
  console.log('🔍 التحقق من الطلبات المعلقة...');
  const pending = await getPendingOrders();

  if (pending.length === 0) {
    console.log('✅ لا توجد طلبات معلقة');
    return;
  }

  console.log(`📋 وجد ${pending.length} طلب معلق`);
  for (const order of pending) {
    await processOrder(order);
  }
}

// البدء
async function main() {
  await sendMessage('🤖 الوكيل يعمل الآن ويستمع للطلبات الجديدة');

  // معالجة الطلبات المعلقة أولاً
  await processPendingOrders();

  // الاستماع للطلبات الجديدة
  listenToNewOrders(async (newOrder) => {
    await processOrder(newOrder);
  });
}

main().catch(console.error);