// ══════════════════════════════════════
// orders.js (public) — تتبع الطلبات للعملاء
// ══════════════════════════════════════

import { db } from './firebase-config.js';
import { collection, query, where, getDocs }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function trackOrder(ref) {
  const [tSnap, cSnap] = await Promise.all([
    getDocs(query(collection(db, 'transfers'), where('ref', '==', ref))),
    getDocs(query(collection(db, 'cards'),     where('ref', '==', ref))),
  ]);
  if (!tSnap.empty) return { type: 'transfer', ...tSnap.docs[0].data() };
  if (!cSnap.empty) return { type: 'card',     ...cSnap.docs[0].data() };
  return null;
}