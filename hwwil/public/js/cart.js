// ══════════════════════════════════════
// cart.js — سلة التسوق (للبطاقات الرقمية)
// ══════════════════════════════════════

let cartItems = [];

export function addToCart(game, pkg) {
  const existing = cartItems.find(i => i.gameId === game.id && i.pkgAmount === pkg.amount);
  if (existing) { existing.qty++; }
  else { cartItems.push({ gameId: game.id, gameName: game.name, pkgAmount: pkg.amount, price: pkg.price, qty: 1 }); }
  updateCartBadge();
  showToast(`✅ تمت إضافة ${pkg.amount} إلى السلة`);
}

export function removeFromCart(gameId, pkgAmount) {
  cartItems = cartItems.filter(i => !(i.gameId === gameId && i.pkgAmount === pkgAmount));
  updateCartBadge();
}

export function getCart() { return cartItems; }
export function clearCart() { cartItems = []; updateCartBadge(); }

export function getCartTotal() {
  return cartItems.reduce((s, i) => s + i.price * i.qty, 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const total = cartItems.reduce((s, i) => s + i.qty, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}