// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
}

// Глобальные переменные
let userData = {
    balance: 10000,
    inventory: []
};

let casesData = [];
let inventoryData = [];
let currentCase = null;
let currentItem = null;
let isOpening = false;

// Переменные для рулетки
let scrollPosition = 0;
let targetScroll = 0;
let isScrolling = false;
let rouletteItems = [];
let winningItemIndex = 0;
let animationStartTime = 0;
let isRouletteActive = false;
let animationPhase = 0;

// DOM элементы
const elements = {
    balance: document.getElementById('user-balance'),
    casesGrid: document.getElementById('cases-grid'),
    itemsTrack: document.getElementById('items-track'),
    inventoryGrid: document.getElementById('inventory-grid'),
    
    // Модальные окна
    caseModal: document.getElementById('case-modal'),
    inventoryModal: document.getElementById('inventory-modal'),
    resultModal: document.getElementById('result-modal'),
    loadingOverlay: document.getElementById('loading'),
    
    // Рулетка
    rouletteContainer: document.getElementById('roulette-container'),
    
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
    resultItemIcon: document.getElementById('result-icon'),
    newBalance: document.getElementById('new-balance'),
};

// Minecraft предметы
const minecraftItems = {
    common: [
        { name: "Железный Слиток", icon: "⛓️", price: 50, description: "Базовый ресурс для крафта" },
        { name: "Уголь", icon: "⚫", price: 30, description: "Топливо и краситель" },
        { name: "Яблоко", icon: "🍎", price: 40, description: "Восстанавливает голод" },
        { name: "Хлеб", icon: "🍞", price: 45, description: "Хорошая еда" },
        { name: "Золотой Слиток", icon: "🟨", price: 80, description: "Редкий ресурс" },
        { name: "Дубовые Доски", icon: "🪵", price: 20, description: "Строительный материал" },
        { name: "Камень", icon: "🪨", price: 25, description: "Прочный блок" },
        { name: "Палка", icon: "〰️", price: 10, description: "Для крафта инструментов" }
    ],
    uncommon: [
        { name: "Алмаз", icon: "💎", price: 150, description: "Ценный минерал" },
        { name: "Изумруд", icon: "🟩", price: 200, description: "Торговая валюта" },
        { name: "Железная Кираса", icon: "🛡️", price: 180, description: "Защита от урона" },
        { name: "Алмазный Меч", icon: "⚔️", price: 250, description: "Мощное оружие" },
        { name: "Лук", icon: "🏹", price: 120, description: "Дальнобойное оружие" },
        { name: "Алмазная Кирка", icon: "⛏️", price: 220, description: "Быстрая добыча" },
        { name: "Золотое Яблоко", icon: "🍏", price: 160, description: "Мощное лечение" },
        { name: "Око Эндера", icon: "👁️", price: 300, description: "Для поиска крепости" }
    ],
    rare: [
        { name: "Незеритовый Слиток", icon: "🔱", price: 500, description: "Элитный материал" },
        { name: "Кирокрыло", icon: "🪶", price: 600, description: "Мгновенное перемещение" },
        { name: "Элитра", icon: "🧥", price: 800, description: "Полеты в мире" },
        { name: "Золотое Яблоко", icon: "🍏", price: 400, description: "Особое зелье" },
        { name: "Зачарованная Книга", icon: "📚", price: 350, description: "Мощные чары" },
        { name: "Плащ Невидимости", icon: "👻", price: 700, description: "Стать невидимым" },
        { name: "Бесконечный Лук", icon: "🏹", price: 450, description: "Не требует стрел" }
    ],
    epic: [
        { name: "Тотем Бессмертия", icon: "🐦", price: 1000, description: "Спасение от смерти" },
        { name: "Сердце Моря", icon: "💙", price: 1200, description: "Редкая реликвия" },
        { name: "Голова Дракона", icon: "🐲", price: 1500, description: "Трофей дракона" },
        { name: "Кристалл Энда", icon: "💎", price: 900, description: "Восстанавливает дракона" },
        { name: "Драконье Яйцо", icon: "🥚", price: 2000, description: "Уникальный трофей" },
        { name: "Зачарованный Золотой Меч", icon: "🗡️", price: 1100, description: "Легендарное оружие" }
    ],
    legendary: [
        { name: "Командный Блок", icon: "🟪", price: 5000, description: "Божественный предмет" },
        { name: "Меч Незера", icon: "🗡️", price: 3000, description: "Легендарное оружие" },
        { name: "Корона Власти", icon: "👑", price: 10000, description: "Знак абсолютной власти" },
        { name: "Артефакт Создателя", icon: "⭐", price: 7500, description: "Сила творения" },
        { name: "Сфера Бессмертия", icon: "🔮", price: 6000, description: "Вечная жизнь" }
    ]
};

// Плавные easing функции
function easeOutSine(t) {
    return Math.sin(t * Math.PI / 2);
}

function easeInOutBack(t) {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    try {
        // Всегда синхронизируем с сервером
        await syncWithServer();
        
        if (casesData.length === 0) {
            await loadDefaultCases();
        }
        
        updateUI();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        await loadDefaultCases();
        updateUI();
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 1000);
}

// Синхронизация с сервером через Telegram Web App
async function syncWithServer() {
    console.log('Синхронизация с сервером...');
    
    if (!tg || !tg.initData) {
        console.log('Telegram Web App не доступен, используем локальные данные');
        loadLocalData();
        return;
    }
    
    try {
        // Отправляем запрос на синхронизацию через Telegram Web App
        const initData = {
            action: 'init',
            timestamp: Date.now()
        };
        
        console.log('Отправка инициализационного запроса...');
        
        // Используем Telegram Web App API для отправки данных
        tg.sendData(JSON.stringify(initData));
        
        // Ждем ответа от бота (этот код будет выполнен когда бот ответит)
        // Данные будут получены через обработчик tg.onEvent('webAppDataReceived')
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        loadLocalData();
    }
}

// Загрузка локальных данных как запасной вариант
function loadLocalData() {
    console.log('Загрузка локальных данных...');
    
    // Используем локальное хранилище как кэш
    const cachedData = localStorage.getItem('minecraft_case_cache');
    if (cachedData) {
        try {
            const data = JSON.parse(cachedData);
            userData.balance = data.balance || 10000;
            userData.inventory = data.inventory || [];
            inventoryData = data.inventory || [];
            casesData = data.cases || [];
            console.log('Данные загружены из кэша');
            return;
        } catch (e) {
            console.error('Ошибка загрузки кэша:', e);
        }
    }
    
    // Если кэша нет, загружаем дефолтные кейсы
    loadDefaultCases();
}

// Загрузка дефолтных кейсов
async function loadDefaultCases() {
    console.log('Загрузка дефолтных кейсов...');
    
    casesData = [
        {
            id: 1,
            name: '🍎 Кейс с Едой',
            price: 100,
            icon: '🍎',
            description: 'Содержит разнообразную еду и напитки',
            rarityWeights: { common: 60, uncommon: 40 }
        },
        {
            id: 2,
            name: '⛏️ Ресурсный Кейс',
            price: 250,
            icon: '⛏️',
            description: 'Руды, минералы и базовые ресурсы',
            rarityWeights: { common: 40, uncommon: 50, rare: 10 }
        },
        {
            id: 3,
            name: '⚔️ Оружейный Кейс',
            price: 500,
            icon: '⚔️',
            description: 'Оружие, броня и инструменты',
            rarityWeights: { uncommon: 30, rare: 50, epic: 20 }
        },
        {
            id: 4,
            name: '🌟 Легендарный Кейс',
            price: 1000,
            icon: '🌟',
            description: 'Уникальные и легендарные предметы',
            rarityWeights: { rare: 20, epic: 50, legendary: 30 }
        },
        {
            id: 5,
            name: '👑 Доступный Кейс',
            price: 5000,
            icon: '👑',
            description: 'Эксклюзивные донат предметы',
            rarityWeights: { epic: 30, legendary: 70 }
        },
        {
            id: 6,
            name: '🧰 Случайный Кейс',
            price: 750,
            icon: '🧰',
            description: 'Микс из всех категорий',
            rarityWeights: { common: 30, uncommon: 40, rare: 20, epic: 10 }
        }
    ];
    
    console.log('Дефолтные кейсы загружены');
}

// Сохранение данных в кэш
function saveToCache() {
    const cacheData = {
        balance: userData.balance,
        inventory: inventoryData,
        cases: casesData,
        timestamp: Date.now()
    };
    
    localStorage.setItem('minecraft_case_cache', JSON.stringify(cacheData));
    console.log('Данные сохранены в кэш');
}

// Обновление интерфейса
function updateUI() {
    elements.balance.textContent = userData.balance.toLocaleString();
    renderCases();
    renderInventory();
    saveToCache(); // Сохраняем в кэш при каждом обновлении UI
}

// Отправка обновлений на сервер
async function sendUpdateToServer(type, data) {
    if (!tg || !tg.initData) {
        console.log('Telegram Web App не доступен, данные не отправлены на сервер');
        return false;
    }
    
    try {
        const updateData = {
            action: 'update',
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        console.log('Отправка обновления на сервер:', type, data);
        
        // Отправляем через Telegram Web App
        tg.sendData(JSON.stringify(updateData));
        
        return true;
    } catch (error) {
        console.error('Ошибка отправки обновления на сервер:', error);
        return false;
    }
}

// Отрисовка кейсов с превью предметов
function renderCases() {
    console.log('Отрисовка кейсов...');
    elements.casesGrid.innerHTML = '';
    
    if (!casesData || casesData.length === 0) {
        loadDefaultCases();
    }
    
    casesData.forEach((caseItem, index) => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        caseCard.style.setProperty('--index', index);
        
        const previewItems = getPreviewItems(caseItem);
        
        caseCard.innerHTML = `
            <div class="case-image">
                <div class="case-icon">${caseItem.icon}</div>
                <div class="case-items-preview">
                    ${previewItems.map(item => `<span>${item.icon}</span>`).join('')}
                </div>
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
    
    console.log('Кейсы отрисованы:', casesData.length);
}

// Получение предметов для превью кейса
function getPreviewItems(caseItem) {
    const previewItems = [];
    const allItems = [];
    
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0) {
            const items = minecraftItems[rarity] || [];
            allItems.push(...items);
        }
    }
    
    const count = Math.min(4, allItems.length);
    const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < count; i++) {
        if (shuffledItems[i]) {
            previewItems.push(shuffledItems[i]);
        }
    }
    
    return previewItems;
}

// Отрисовка инвентаря
function renderInventory() {
    console.log('Отрисовка инвентаря...');
    elements.inventoryGrid.innerHTML = '';
    
    if (inventoryData.length === 0) {
        elements.inventoryGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px; animation: float 3s infinite ease-in-out;">🎒</div>
                <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 10px;">Инвентарь пуст</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 10px;">
                    Откройте кейсы, чтобы получить предметы!
                </p>
            </div>
        `;
        console.log('Инвентарь пуст');
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
    
    console.log('Инвентарь отрисован:', inventoryData.length, 'предметов');
}

// Открытие модального окна кейса
function openCaseModal(caseItem) {
    console.log('Открытие модального окна кейса:', caseItem.name);
    currentCase = caseItem;
    
    isOpening = false;
    isRouletteActive = false;
    
    elements.caseName.textContent = caseItem.name;
    elements.casePriceValue.textContent = caseItem.price;
    elements.openPrice.textContent = caseItem.price;
    elements.caseDescription.textContent = caseItem.description;
    
    if (userData.balance < caseItem.price) {
        elements.openCaseBtn.disabled = true;
        elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
    } else {
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${caseItem.price} 💎`;
    }
    
    createCaseItemsPreview(caseItem);
    prepareRouletteForCase(caseItem);
    
    showModal(elements.caseModal);
}

// Открытие кейса - ОСНОВНОЙ ИСПРАВЛЕННЫЙ МЕТОД
async function openCase() {
    console.log('Открытие кейса...');
    if (!currentCase || !userData || isOpening) {
        console.log('Не могу открыть кейс:', { currentCase, userData, isOpening });
        return;
    }
    
    if (userData.balance < currentCase.price) {
        alert('❌ Недостаточно алмазов!');
        return;
    }
    
    console.log('Списываем средства и открываем кейс...');
    
    // Отключаем кнопку открытия
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    // Генерируем выигрышный предмет
    const wonItem = generateWonItem(currentCase);
    currentItem = wonItem;
    console.log('Выигрышный предмет:', wonItem);
    
    // Обновляем баланс локально сразу
    userData.balance -= currentCase.price;
    elements.balance.textContent = userData.balance.toLocaleString();
    
    // Добавляем предмет в инвентарь
    const newInventoryItem = {
        ...wonItem,
        id: Date.now(), // Временный ID
        obtained_at: new Date().toISOString()
    };
    
    inventoryData.unshift(newInventoryItem);
    
    // Сохраняем в кэш
    saveToCache();
    
    // Отправляем обновление на сервер
    await sendUpdateToServer('open_case', {
        case_id: currentCase.id,
        item: newInventoryItem,
        new_balance: userData.balance
    });
    
    // Запускаем рулетку
    await startRouletteForCase(wonItem);
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

// Запуск рулетки для кейса
function startRouletteForCase(wonItem) {
    return new Promise((resolve) => {
        isOpening = true;
        isRouletteActive = true;
        
        rouletteItems = generateFullRouletteSequence(wonItem);
        winningItemIndex = Math.floor(rouletteItems.length / 2);
        rouletteItems[winningItemIndex] = {...wonItem};
        
        console.log('Выигрышный предмет в центре на позиции:', winningItemIndex);
        
        renderRouletteItems();
        
        setTimeout(() => {
            startRouletteAnimation(resolve);
        }, 100);
    });
}

// Генерация полной последовательности для анимации
function generateFullRouletteSequence(wonItem) {
    const sequence = [];
    const sequenceLength = 50;
    
    for (let i = 0; i < sequenceLength / 2 - 5; i++) {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];
        const items = minecraftItems[randomRarity] || minecraftItems.common;
        const randomItem = {...items[Math.floor(Math.random() * items.length)]};
        randomItem.rarity = randomRarity;
        sequence.push(randomItem);
    }
    
    sequence.push({...wonItem});
    
    for (let i = 0; i < sequenceLength / 2 - 5; i++) {
        const rarities = ['common', 'uncommon', 'rare'];
        const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];
        const items = minecraftItems[randomRarity] || minecraftItems.common;
        const randomItem = {...items[Math.floor(Math.random() * items.length)]};
        randomItem.rarity = randomRarity;
        sequence.push(randomItem);
    }
    
    return sequence;
}

// Анимация рулетки
function animateRoulette(startPos, endPos, duration, resolve) {
    if (!isRouletteActive) return;
    
    const elapsed = Date.now() - animationStartTime;
    let progress = Math.min(elapsed / duration, 1);
    
    let easedProgress;
    
    if (progress < 0.2) {
        const phaseProgress = progress / 0.2;
        easedProgress = easeOutSine(phaseProgress) * 0.2;
    } else if (progress < 0.6) {
        const phaseProgress = (progress - 0.2) / 0.4;
        easedProgress = 0.2 + phaseProgress * 0.4;
    } else if (progress < 0.8) {
        const phaseProgress = (progress - 0.6) / 0.2;
        easedProgress = 0.6 + easeOutCubic(phaseProgress) * 0.2;
    } else {
        const phaseProgress = (progress - 0.8) / 0.2;
        easedProgress = 0.8 + easeInOutBack(phaseProgress) * 0.2;
    }
    
    const currentPos = startPos + (endPos - startPos) * easedProgress;
    
    if (elements.itemsTrack) {
        if (progress > 0.85) {
            elements.itemsTrack.style.transition = 'transform 0.1s linear';
        }
        elements.itemsTrack.style.transform = `translateX(${currentPos}px)`;
    }
    
    updateCenterZoneItem();
    
    if (progress < 1) {
        requestAnimationFrame(() => animateRoulette(startPos, endPos, duration, resolve));
    } else {
        finishRouletteAnimation(resolve);
    }
}

// Завершение анимации рулетки
function finishRouletteAnimation(resolve) {
    console.log('Завершение анимации рулетки');
    isScrolling = false;
    
    setTimeout(() => {
        const highlightedItem = document.querySelector('.roulette-item.highlighted');
        if (highlightedItem) {
            highlightedItem.classList.add('winning-spin');
            
            setTimeout(() => {
                hideModal(elements.caseModal);
                
                if (userData.balance >= currentCase.price) {
                    elements.openCaseBtn.disabled = false;
                    elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
                } else {
                    elements.openCaseBtn.disabled = true;
                    elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
                }
                
                showResult(currentItem);
                isOpening = false;
                isRouletteActive = false;
                resolve();
            }, 1500);
        } else {
            handleRouletteError(resolve);
        }
    }, 500);
}

// Показ результата
function showResult(item) {
    console.log('Показ результата:', item);
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price.toLocaleString();
    elements.resultItemIcon.textContent = item.icon;
    elements.newBalance.textContent = userData.balance.toLocaleString();
    
    updateUI();
    createParticles();
    showModal(elements.resultModal);
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
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log('Показано модальное окно:', modal.id);
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    console.log('Скрыто модальное окно:', modal.id);
}

function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'flex';
        setTimeout(() => {
            elements.loadingOverlay.style.opacity = '1';
        }, 10);
    }
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            elements.loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', openInventoryModal);
    }
    
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => {
            if (isRouletteActive) {
                if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                    isRouletteActive = false;
                    hideModal(elements.caseModal);
                    if (userData.balance >= currentCase?.price) {
                        elements.openCaseBtn.disabled = false;
                        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase?.price || 0} 💎`;
                    }
                }
            } else {
                hideModal(elements.caseModal);
            }
        });
    }
    
    if (elements.closeInventory) {
        elements.closeInventory.addEventListener('click', () => hideModal(elements.inventoryModal));
    }
    
    if (elements.closeResult) {
        elements.closeResult.addEventListener('click', () => hideModal(elements.resultModal));
    }
    
    if (elements.openCaseBtn) {
        elements.openCaseBtn.addEventListener('click', openCase);
    }
    
    // Сохраняем данные перед закрытием
    window.addEventListener('beforeunload', () => {
        console.log('Сохранение данных перед закрытием...');
        saveToCache();
        
        // Отправляем финальное обновление на сервер
        if (tg && tg.initData) {
            sendUpdateToServer('sync', {
                balance: userData.balance,
                inventory: inventoryData
            });
        }
    });
}

// Обработка данных от Telegram бота
if (tg) {
    tg.onEvent('webAppDataReceived', (data) => {
        try {
            console.log('Получены данные от бота:', data);
            const parsedData = JSON.parse(data);
            
            if (parsedData.user) {
                // Обновляем данные с сервера
                userData.balance = parsedData.user.balance || 10000;
                userData.inventory = parsedData.inventory || [];
                inventoryData = parsedData.inventory || [];
                casesData = parsedData.cases || [];
                
                updateUI();
                console.log('Данные синхронизированы с сервером');
            }
        } catch (error) {
            console.error('Error parsing web app data:', error);
        }
    });
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    initApp();
    initEventListeners();
    
    console.log('Приложение запущено');
});