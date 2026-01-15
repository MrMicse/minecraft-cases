// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
}

// Глобальные переменные
let userData = {
    balance: 1000,
    inventory: []
};

let casesData = [];
let inventoryData = [];
let currentCase = null;
let currentItem = null;
let isSpinning = false;
let spinAnimation = null;

// Minecraft предметы по категориям
const minecraftItems = {
    common: [
        { name: "Железный Слиток", icon: "⛓️", price: 50, description: "Базовый ресурс для крафта" },
        { name: "Уголь", icon: "⚫", price: 30, description: "Топливо и краситель" },
        { name: "Яблоко", icon: "🍎", price: 40, description: "Восстанавливает голод" },
        { name: "Хлеб", icon: "🍞", price: 45, description: "Хорошая еда" },
        { name: "Золотой Слиток", icon: "🟨", price: 80, description: "Редкий ресурс" }
    ],
    uncommon: [
        { name: "Алмаз", icon: "💎", price: 150, description: "Ценный минерал" },
        { name: "Изумруд", icon: "🟩", price: 200, description: "Торговая валюта" },
        { name: "Железная Кираса", icon: "🛡️", price: 180, description: "Защита от урона" },
        { name: "Алмазный Меч", icon: "⚔️", price: 250, description: "Мощное оружие" },
        { name: "Лук", icon: "🏹", price: 120, description: "Дальнобойное оружие" }
    ],
    rare: [
        { name: "Незеритовый Слиток", icon: "🔱", price: 500, description: "Элитный материал" },
        { name: "Кирокрыло", icon: "🪶", price: 600, description: "Мгновенное перемещение" },
        { name: "Элитра", icon: "🧥", price: 800, description: "Полеты в мире" },
        { name: "Золотое Яблоко", icon: "🍏", price: 400, description: "Особое зелье" }
    ],
    epic: [
        { name: "Тотем Бессмертия", icon: "🐦", price: 1000, description: "Спасение от смерти" },
        { name: "Сердце Моря", icon: "💙", price: 1200, description: "Редкая реликвия" },
        { name: "Голова Дракона", icon: "🐲", price: 1500, description: "Трофей дракона" }
    ],
    legendary: [
        { name: "Командный Блок", icon: "🟪", price: 5000, description: "Божественный предмет" },
        { name: "Меч Незера", icon: "🗡️", price: 3000, description: "Легендарное оружие" },
        { name: "Корона Власти", icon: "👑", price: 10000, description: "Знак абсолютной власти" }
    ]
};

// DOM элементы
const elements = {
    balance: document.getElementById('user-balance'),
    casesGrid: document.getElementById('cases-grid'),
    inventoryGrid: document.getElementById('inventory-grid'),
    
    // Модальные окна
    caseModal: document.getElementById('case-modal'),
    inventoryModal: document.getElementById('inventory-modal'),
    resultModal: document.getElementById('result-modal'),
    loadingOverlay: document.getElementById('loading'),
    
    // Кнопки
    inventoryBtn: document.getElementById('inventory-btn'),
    closeModal: document.getElementById('close-modal'),
    closeInventory: document.getElementById('close-inventory'),
    closeResult: document.getElementById('close-result'),
    openCaseBtn: document.getElementById('open-case-btn'),
    
    // Текстовые элементы
    caseName: document.getElementById('case-name'),
    casePriceValue: document.getElementById('case-price-value'),
    caseDescription: document.getElementById('case-description'),
    openPrice: document.getElementById('open-price'),
    resultItemName: document.getElementById('result-item-name'),
    resultItemRarity: document.getElementById('result-item-rarity'),
    resultItemPrice: document.getElementById('result-item-price'),
    resultIcon: document.getElementById('result-icon'),
    newBalance: document.getElementById('new-balance'),
    
    // Спиннер
    caseSpinner: document.getElementById('case-spinner'),
    spinningWheel: document.querySelector('.spinning-wheel'),
    wheelItems: document.querySelectorAll('.wheel-item')
};

// Инициализация приложения
async function initApp() {
    showLoading();
    
    // Создаем кейсы
    casesData = [
        {
            id: 1,
            name: '🍎 Кейс с Едой',
            price: 100,
            icon: '🍎',
            description: 'Содержит разнообразную еду и напитки',
            contents: [...minecraftItems.common.slice(2, 5), ...minecraftItems.uncommon.slice(0, 2)],
            rarityWeights: { common: 60, uncommon: 40 }
        },
        {
            id: 2,
            name: '⛏️ Ресурсный Кейс',
            price: 250,
            icon: '⛏️',
            description: 'Руды, минералы и базовые ресурсы',
            contents: [...minecraftItems.common.slice(0, 3), ...minecraftItems.uncommon.slice(0, 3)],
            rarityWeights: { common: 40, uncommon: 50, rare: 10 }
        },
        {
            id: 3,
            name: '⚔️ Оружейный Кейс',
            price: 500,
            icon: '⚔️',
            description: 'Оружие, броня и инструменты',
            contents: [...minecraftItems.uncommon.slice(2, 5), ...minecraftItems.rare.slice(0, 3)],
            rarityWeights: { uncommon: 30, rare: 50, epic: 20 }
        },
        {
            id: 4,
            name: '🌟 Легендарный Кейс',
            price: 1000,
            icon: '🌟',
            description: 'Уникальные и легендарные предметы',
            contents: [...minecraftItems.epic, ...minecraftItems.legendary],
            rarityWeights: { rare: 20, epic: 50, legendary: 30 }
        },
        {
            id: 5,
            name: '👑 Доступный Кейс',
            price: 5000,
            icon: '👑',
            description: 'Эксклюзивные донат предметы',
            contents: [...minecraftItems.legendary, {
                name: "Особый Доступ",
                icon: "🔓",
                price: 20000,
                description: "VIP доступ на сервер"
            }],
            rarityWeights: { epic: 30, legendary: 70 }
        },
        {
            id: 6,
            name: '🧰 Случайный Кейс',
            price: 750,
            icon: '🧰',
            description: 'Микс из всех категорий',
            contents: [
                ...minecraftItems.common,
                ...minecraftItems.uncommon,
                ...minecraftItems.rare.slice(0, 2),
                ...minecraftItems.epic.slice(0, 1)
            ],
            rarityWeights: { common: 30, uncommon: 40, rare: 20, epic: 10 }
        }
    ];
    
    updateUI();
    setTimeout(hideLoading, 1500);
    
    // Инициализируем события спиннера
    initSpinner();
}

// Обновление интерфейса
function updateUI() {
    // Обновляем баланс
    elements.balance.textContent = userData.balance;
    
    // Отрисовываем кейсы
    renderCases();
    
    // Отрисовываем инвентарь
    renderInventory();
}

// Отрисовка кейсов
function renderCases() {
    elements.casesGrid.innerHTML = '';
    
    casesData.forEach(caseItem => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        
        caseCard.innerHTML = `
            <div class="case-image">
                <div class="case-icon">${caseItem.icon}</div>
            </div>
            <div class="case-info">
                <h3 class="case-name">${caseItem.name}</h3>
                <p class="case-price">${caseItem.price} 💎</p>
                <p class="case-description">${caseItem.description}</p>
            </div>
        `;
        
        caseCard.addEventListener('click', () => openCaseModal(caseItem));
        elements.casesGrid.appendChild(caseCard);
    });
}

// Отрисовка инвентаря
function renderInventory() {
    elements.inventoryGrid.innerHTML = '';
    
    if (inventoryData.length === 0) {
        elements.inventoryGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🎒</div>
                <p style="color: var(--text-secondary);">Инвентарь пуст</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 10px;">
                    Откройте кейсы, чтобы получить предметы!
                </p>
            </div>
        `;
        return;
    }
    
    inventoryData.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.rarity = item.rarity;
        
        itemElement.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <h4>${item.name}</h4>
            <span class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</span>
            <p style="font-size: 0.8rem; color: var(--accent-diamond); margin-top: 5px;">
                💎 ${item.price}
            </p>
        `;
        
        itemElement.addEventListener('click', () => viewItem(item));
        elements.inventoryGrid.appendChild(itemElement);
    });
}

// Инициализация спиннера
function initSpinner() {
    // Наполняем спиннер случайными предметами
    const allItems = [
        ...minecraftItems.common,
        ...minecraftItems.uncommon,
        ...minecraftItems.rare,
        ...minecraftItems.epic,
        ...minecraftItems.legendary
    ];
    
    elements.wheelItems.forEach((item, index) => {
        const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
        item.innerHTML = randomItem.icon;
        item.dataset.item = JSON.stringify(randomItem);
    });
}

// Открытие модального окна кейса
function openCaseModal(caseItem) {
    currentCase = caseItem;
    
    elements.caseName.textContent = caseItem.name;
    elements.casePriceValue.textContent = caseItem.price;
    elements.openPrice.textContent = caseItem.price;
    elements.caseDescription.textContent = caseItem.description;
    
    // Проверяем баланс
    if (userData.balance < caseItem.price) {
        elements.openCaseBtn.disabled = true;
        elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
    } else {
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${caseItem.price} 💎`;
    }
    
    showModal(elements.caseModal);
    
    // Сбрасываем спиннер
    resetSpinner();
}

// Сброс спиннера
function resetSpinner() {
    elements.spinningWheel.style.transition = 'none';
    elements.spinningWheel.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    
    elements.wheelItems.forEach(item => {
        item.classList.remove('active');
    });
    
    if (elements.wheelItems[0]) {
        elements.wheelItems[0].classList.add('active');
    }
}

// Открытие модального окна инвентаря
function openInventoryModal() {
    renderInventory();
    showModal(elements.inventoryModal);
}

// Просмотр предмета
function viewItem(item) {
    alert(`🎁 ${item.name}\n🎯 Редкость: ${getRarityText(item.rarity)}\n💎 Цена: ${item.price}\n📝 ${item.description}`);
}

// Открытие кейса
async function openCase() {
    if (!currentCase || !userData || isSpinning) return;
    
    if (userData.balance < currentCase.price) {
        alert('❌ Недостаточно алмазов!');
        return;
    }
    
    isSpinning = true;
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '🎰 Крутится...';
    
    // Генерируем выигрышный предмет
    const wonItem = generateWonItem(currentCase);
    currentItem = wonItem;
    
    // Запускаем анимацию спиннера
    await spinWheelAnimation(wonItem);
    
    // Списание средств
    userData.balance -= currentCase.price;
    elements.balance.textContent = userData.balance;
    
    // Добавляем предмет в инвентарь
    inventoryData.unshift({
        ...wonItem,
        obtained_at: new Date().toISOString()
    });
    
    // Показываем результат
    setTimeout(() => {
        showResult(wonItem);
        isSpinning = false;
    }, 500);
    
    // Закрываем модальное окно кейса
    setTimeout(() => hideModal(elements.caseModal), 1000);
}

// Генерация выигрышного предмета
function generateWonItem(caseItem) {
    const totalWeight = Object.values(caseItem.rarityWeights).reduce((a, b) => a + b, 0);
    let randomWeight = Math.random() * totalWeight;
    
    let selectedRarity = 'common';
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        randomWeight -= weight;
        if (randomWeight <= 0) {
            selectedRarity = rarity;
            break;
        }
    }
    
    // Фильтруем предметы по редкости
    const itemsByRarity = {
        common: minecraftItems.common,
        uncommon: minecraftItems.uncommon,
        rare: minecraftItems.rare,
        epic: minecraftItems.epic,
        legendary: minecraftItems.legendary
    };
    
    const availableItems = itemsByRarity[selectedRarity] || minecraftItems.common;
    const randomItem = {...availableItems[Math.floor(Math.random() * availableItems.length)]};
    randomItem.rarity = selectedRarity;
    
    return randomItem;
}

// Анимация прокрутки спиннера
function spinWheelAnimation(wonItem) {
    return new Promise((resolve) => {
        const spinDuration = 3000; // 3 секунды
        const spinCycles = 5; // 5 полных оборотов
        const totalRotation = 360 * spinCycles;
        const winningPosition = Math.floor(Math.random() * 8) * 45; // 8 позиций по 45 градусов
        
        elements.spinningWheel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
        elements.spinningWheel.style.transform = `translate(-50%, -50%) rotate(${totalRotation + winningPosition}deg)`;
        
        // Анимация выбора активного элемента
        let currentActive = 0;
        const interval = setInterval(() => {
            elements.wheelItems.forEach(item => item.classList.remove('active'));
            currentActive = (currentActive + 1) % 8;
            elements.wheelItems[currentActive].classList.add('active');
        }, 100);
        
        setTimeout(() => {
            clearInterval(interval);
            
            // Устанавливаем выигрышный предмет в активную позицию
            elements.wheelItems.forEach((item, index) => {
                item.classList.remove('active');
                if (index === 0) { // После анимации позиция 0 будет выигрышной
                    item.innerHTML = wonItem.icon;
                    item.dataset.item = JSON.stringify(wonItem);
                    item.classList.add('active');
                }
            });
            
            resolve();
        }, spinDuration);
    });
}

// Показ результата
function showResult(item) {
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price;
    elements.resultIcon.textContent = item.icon;
    elements.newBalance.textContent = userData.balance;
    
    // Анимация иконки
    elements.resultIcon.style.animation = 'none';
    setTimeout(() => {
        elements.resultIcon.style.animation = 'itemBounce 0.5s infinite alternate';
    }, 10);
    
    showModal(elements.resultModal);
    
    // Добавляем частицы
    createParticles();
}

// Создание частиц для эффекта
function createParticles() {
    const particleContainer = document.querySelector('.particle-effect');
    particleContainer.innerHTML = '';
    
    const particleColors = {
        common: '#4b69ff',
        uncommon: '#00d26a',
        rare: '#ffd700',
        epic: '#8847ff',
        legendary: '#ff0000'
    };
    
    const color = particleColors[currentItem.rarity] || '#4b69ff';
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.background = color;
        particle.style.borderRadius = '50%';
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.opacity = '0';
        
        const angle = (i / 20) * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        
        particle.style.animation = `
            particleExplode 1s ease-out ${i * 0.05}s forwards
        `;
        
        particle.style.setProperty('--end-x', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--end-y', `${Math.sin(angle) * distance}px`);
        
        particleContainer.appendChild(particle);
    }
    
    // Добавляем стили для анимации частиц
    if (!document.getElementById('particle-styles')) {
        const style = document.createElement('style');
        style.id = 'particle-styles';
        style.textContent = `
            @keyframes particleExplode {
                0% {
                    transform: translate(0, 0) scale(0);
                    opacity: 1;
                }
                100% {
                    transform: translate(var(--end-x), var(--end-y)) scale(1);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Получение текста редкости
function getRarityText(rarity) {
    const rarityMap = {
        'common': 'Обычный',
        'uncommon': 'Необычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return rarityMap[rarity] || rarity;
}

// Управление модальными окнами
function showModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function showLoading() {
    elements.loadingOverlay.style.display = 'flex';
    setTimeout(() => {
        elements.loadingOverlay.style.opacity = '1';
    }, 10);
}

function hideLoading() {
    elements.loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        elements.loadingOverlay.style.display = 'none';
    }, 300);
}

// Обработчики событий
elements.inventoryBtn.addEventListener('click', openInventoryModal);
elements.closeModal.addEventListener('click', () => hideModal(elements.caseModal));
elements.closeInventory.addEventListener('click', () => hideModal(elements.inventoryModal));
elements.closeResult.addEventListener('click', () => hideModal(elements.resultModal));
elements.openCaseBtn.addEventListener('click', openCase);

// Закрытие модальных окон по клику на overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && !isSpinning) {
            hideModal(overlay);
        }
    });
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp);

// Обработка сообщений от Telegram бота
if (tg) {
    tg.onEvent('webAppDataReceived', (data) => {
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.user) {
                userData = parsedData.user;
                inventoryData = parsedData.inventory || [];
                updateUI();
            }
        } catch (error) {
            console.error('Error parsing web app data:', error);
        }
    });
}

// Добавление шрифта Minecraft
const style = document.createElement('style');
style.textContent = `
    @font-face {
        font-family: 'Minecraft';
        src: url('https://cdn.jsdelivr.net/npm/minecraft-font@1.0.0/font/minecraft.woff2') format('woff2');
    }
    
    body {
        font-family: 'Minecraft', 'Segoe UI', sans-serif;
    }
`;
document.head.appendChild(style);