require('dotenv').config();
const { chromium } = require('playwright');
const OpenAI = require('openai');
const { getSupplierUrl } = require('./supabase');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let browser = null;
let page = null;

// تشغيل المتصفح
async function startBrowser() {
  browser = await chromium.launch({
    headless: false, // false = تشوف المتصفح, true = مخفي
    slowMo: 500
  });
  const context = await browser.newContext();
  page = await context.newPage();
  console.log('🌐 المتصفح جاهز');
}

// إغلاق المتصفح
async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// تحليل الصفحة عبر GPT-4o
async function analyzePage(instruction) {
  const screenshot = await page.screenshot({ encoding: 'base64' });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${screenshot}` }
          },
          {
            type: 'text',
            text: `أنت مساعد يتحكم بمتصفح. المهمة: ${instruction}
            
أجب فقط بـ JSON بهذا الشكل:
{
  "action": "click" أو "type" أو "wait" أو "extract",
  "selector": "CSS selector أو text",
  "value": "النص للكتابة (إذا action=type)",
  "result": "النتيجة المستخرجة (إذا action=extract)"
}`
          }
        ]
      }
    ],
    max_tokens: 500
  });

  try {
    const text = response.choices[0].message.content;
    const json = text.replace(/```json|```/g, '').trim();
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

// تنفيذ أمر على الصفحة
async function executeAction(action) {
  try {
    if (action.action === 'click') {
      await page.click(action.selector, { timeout: 5000 }).catch(async () => {
        await page.getByText(action.selector).first().click();
      });
    } else if (action.action === 'type') {
      await page.fill(action.selector, action.value).catch(async () => {
        await page.getByText(action.selector).first().fill(action.value);
      });
    } else if (action.action === 'wait') {
      await page.waitForTimeout(2000);
    }
    return action.result || null;
  } catch (e) {
    console.error('خطأ في التنفيذ:', e.message);
    return null;
  }
}

// الدالة الرئيسية - شراء البطاقة
async function purchaseCard(order) {
  try {
    await startBrowser();

// فتح موقع المزود
    const supplierData = await getSupplierUrl(order.product_name, order.price);
    if (!supplierData || !supplierData.url) {
      throw new Error(`لا يوجد مورد لـ ${order.product_name} - أضف رابط المورد في لوحة التحكم`);
    }
    const supplierUrl = supplierData.url;
    console.log(`🏪 المورد: ${supplierData.name} - ${supplierUrl}`);
    
    console.log(`🌐 فتح موقع المزود: ${supplierUrl}`);
    await page.goto(supplierUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // الخطوة 1: تحليل الصفحة واختيار البطاقة
    console.log('🧠 تحليل الصفحة...');
    let action = await analyzePage(
      `ابحث عن بطاقة "${order.product_name}" بسعر "${order.price}" وانقر عليها`
    );
    if (action) await executeAction(action);
    await page.waitForTimeout(2000);

    // الخطوة 2: إكمال عملية الشراء
    action = await analyzePage('انقر على زر الشراء أو إضافة للسلة');
    if (action) await executeAction(action);
    await page.waitForTimeout(2000);

    // الخطوة 3: اختيار Binance للدفع
    action = await analyzePage('ابحث عن خيار الدفع عبر Binance أو Crypto وانقر عليه');
    if (action) await executeAction(action);
    await page.waitForTimeout(2000);

    // إرجاع صفحة الدفع للتأكيد اليدوي
    const currentUrl = page.url();
    console.log('💳 وصلنا لصفحة الدفع:', currentUrl);

    return { success: true, page, browser };

  } catch (error) {
    console.error('❌ خطأ في الشراء:', error.message);
    await closeBrowser();
    return { success: false, error: error.message };
  }
}

// استخراج كود البطاقة بعد الدفع
async function extractCardCode() {
  console.log('🔍 البحث عن كود البطاقة...');
  await page.waitForTimeout(3000);

  const action = await analyzePage(
    'استخرج كود البطاقة أو Gift Card Code من الصفحة. يكون عادةً أرقام وحروف مثل XXXX-XXXX-XXXX'
  );

  if (action && action.result) {
    return action.result;
  }

  // محاولة استخراج مباشرة
  const bodyText = await page.evaluate(() => document.body.innerText);
  const codeMatch = bodyText.match(/[A-Z0-9]{4,6}[-\s][A-Z0-9]{4,6}[-\s][A-Z0-9]{4,6}/);
  return codeMatch ? codeMatch[0] : null;
}

module.exports = { purchaseCard, extractCardCode, closeBrowser };