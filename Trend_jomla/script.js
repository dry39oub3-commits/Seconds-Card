// وظيفة التبديل بين الوضع الليلي والنهاري
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const btn = document.getElementById('themeToggle');
    btn.innerText = document.body.classList.contains('dark-mode') ? '☀️' : '🌙';
}

// إضافة رابط جديد
function addLink() {
    const title = document.getElementById('prodTitle').value;
    const link = document.getElementById('prodLink').value;
    const img = document.getElementById('prodImg').value;
    const category = document.getElementById('prodCategory').value;

    if(!title || !link) return alert("يرجى ملء البيانات!");

    const grid = document.getElementById('linksGrid');
    const card = document.createElement('div');
    card.className = `card ${category}`;
    
    // التحقق إذا كان الرابط فيديو أو صورة
    const mediaTag = img.includes('mp4') ? 
        `<video src="${img}" autoplay muted loop></video>` : 
        `<img src="${img}" alt="${title}">`;

    card.innerHTML = `
    <div onclick="window.open('${link}', '_blank')" style="cursor:pointer">
        ${mediaTag}
        <div class="card-content">
            <h3>${title}</h3>
            <p>التصنيف: ${category}</p>
            <span class="btn-buy">مشاهدة المنتج ✨</span>
        </div>
    </div>
`;

    grid.appendChild(card);
    clearInputs();
}

function clearInputs() {
    document.querySelectorAll('.input-group input').forEach(i => i.value = '');
}

// وظيفة البحث
function searchLinks() {
    let input = document.getElementById('searchInput').value.toLowerCase();
    let cards = document.getElementsByClassName('card');

    for (let i = 0; i < cards.length; i++) {
        let title = cards[i].getElementsByTagName('h3')[0].innerText.toLowerCase();
        cards[i].style.display = title.includes(input) ? "" : "none";
    }
}