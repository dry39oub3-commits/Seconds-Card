// ══════════════════════════════════════
// checkout.js — إتمام الطلب
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function submitCardOrder({ game, pkg, playerId, phone }) {
  const ref = 'CRD-' + Math.floor(Math.random() * 90000 + 10000);
  try {
    await addDoc(collection(db, 'cards'), {
      ref, game: game.name, gameId: game.id,
      package: pkg.amount, price: pkg.price,
      playerId, phone, status: 'pending',
      createdAt: serverTimestamp()
    });
  } catch (e) { console.error(e); }

  const msg = encodeURIComponent(
    `طلب شراء بطاقة رقمية\nرقم الطلب: #${ref}\nاللعبة: ${game.name}\nالباقة: ${pkg.amount}\nالسعر: ${pkg.price} أوقية\nمعرف اللاعب: ${playerId}\nرقم الهاتف: ${phone}`
  );
  window.open(`https://wa.me/22234362534?text=${msg}`, '_blank');
  return ref;
}

export async function submitTransferOrder({ name, phone, amount, commRate, fromBank, toBank, account, notes }) {
  const comm = amount * commRate / 100;
  const recv = amount - comm;
  const ref  = 'HW-' + Math.floor(Math.random() * 90000 + 10000);
  await addDoc(collection(db, 'transfers'), {
    ref, name, phone, amount, commRate, commission: comm, receive: recv,
    fromBank, toBank, account, notes, status: 'pending',
    createdAt: serverTimestamp()
  });
  return ref;
}