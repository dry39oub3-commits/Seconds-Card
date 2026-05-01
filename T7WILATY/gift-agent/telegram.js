require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

// إرسال إشعار عادي
async function sendMessage(text) {
  await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, text);
}

// إرسال إشعار مع زر تأكيد وانتظار الرد
async function waitForConfirmation(orderInfo) {
  return new Promise((resolve) => {
    const msg = `
🔔 *طلب جديد - يحتاج تأكيد دفع*

📦 البطاقة: ${orderInfo.product_name}
💰 السعر: ${orderInfo.price}
🌐 المزود: ${orderInfo.supplier_id}

✅ بعد الدفع على Binance أرسل: *تم*
❌ لإلغاء الطلب أرسل: *إلغاء*
    `;

    bot.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, { parse_mode: 'Markdown' });

    // تشغيل polling مؤقت لانتظار الرد
    const pollingBot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

    pollingBot.on('message', async (response) => {
      if (response.chat.id.toString() === process.env.TELEGRAM_CHAT_ID) {
        await pollingBot.stopPolling();
        if (response.text === 'تم') {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

module.exports = { sendMessage, waitForConfirmation };