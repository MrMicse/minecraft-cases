// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
}

// Глобальные переменные
let userData = {
    balance: 10000, // Стартовый баланс 10000
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
let animationPhase = 0; // 0: начало, 1: ускорение, 2: максимальная, 3: замедление

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

// Minecraft предметы по категориям
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
        // Пытаемся получить данные из Telegram Web App
        if (tg && tg.initData) {
            await syncWithServer();
        } else {
            // Если нет Telegram Web App, используем локальные данные
            loadLocalData();
        }
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        loadLocalData();
    }
    
    updateUI();
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 1000);
}

// Синхронизация с сервером через Telegram Web App
async function syncWithServer() {
    console.log('Синхронизация с сервером...');
    
    try {
        // Отправляем запрос на синхронизацию
        const response = await sendDataToBot('init', {});
        
        if (response && response.user) {
            // Используем данные с сервера
            userData.balance = response.user.balance || 10000;
            userData.inventory = response.inventory || [];
            inventoryData = response.inventory || [];
            casesData = response.cases || [];
            
            console.log('Данные синхронизированы с сервером:', {
                balance: userData.balance,
                inventoryCount: inventoryData.length,
                casesCount: casesData.length
            });
        } else {
            // Если нет ответа от сервера, загружаем локальные данные
            loadLocalData();
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        loadLocalData();
    }
}

// Отправка данных боту через Web App
async function sendDataToBot(action, data) {
    if (!tg) {
        console.log('Telegram Web App не доступен');
        return null;
    }
    
    try {
        console.log(`Отправка данных боту: ${action}`, data);
        
        // Используем Telegram Web App API для отправки данных
        const result = await tg.sendData(JSON.stringify({
            action: action,
            ...data,
            timestamp: Date.now()
        }));
        
        console.log('Ответ от бота:', result);
        return result ? JSON.parse(result) : null;
    } catch (error) {
        console.error('Ошибка отправки данных боту:', error);
        return null;
    }
}

// Загрузка локальных данных
function loadLocalData() {
    console.log('Загрузка локальных данных...');
    
    // Очищаем старые данные
    localStorage.removeItem('minecraft_case_opening_data');
    
    // Создаем кейсы
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
    
    // Начальный баланс 10000
    userData.balance = 10000;
    userData.inventory = [];
    inventoryData = [];
    
    console.log('Локальные данные загружены');
}

// Сохранение данных пользователя
function saveUserData() {
    // Больше не сохраняем в localStorage, так как синхронизируемся с сервером
    console.log('Сохранение данных отключено (синхронизация с сервером)');
}

// Обновление интерфейса
function updateUI() {
    elements.balance.textContent = userData.balance.toLocaleString();
    renderCases();
    renderInventory();
}

// Отрисовка кейсов с превью предметов
function renderCases() {
    console.log('Отрисовка кейсов...');
    elements.casesGrid.innerHTML = '';
    
    // Если нет данных о кейсах, создаем дефолтные
    if (!casesData || casesData.length === 0) {
        loadLocalData();
    }
    
    casesData.forEach((caseItem, index) => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        caseCard.style.setProperty('--index', index);
        
        // Собираем примеры предметов для превью
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
    
    // Собираем все возможные предметы для этого кейса
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0) {
            const items = minecraftItems[rarity] || [];
            allItems.push(...items);
        }
    }
    
    // Выбираем 3-5 случайных предметов для превью
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
    
    // Сбрасываем состояние рулетки
    isOpening = false;
    isRouletteActive = false;
    
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
    
    // Создаем предпросмотр предметов
    createCaseItemsPreview(caseItem);
    
    // Подготавливаем рулетку
    prepareRouletteForCase(caseItem);
    
    showModal(elements.caseModal);
}

// Создание превью предметов в модальном окне
function createCaseItemsPreview(caseItem) {
    const previewContainer = document.querySelector('.case-items-preview-modal');
    if (!previewContainer) return;
    
    // Очищаем контейнер
    previewContainer.innerHTML = '';
    
    // Собираем все предметы для этого кейса
    const allItems = [];
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity].map(item => ({
                ...item,
                rarity: rarity
            }));
            allItems.push(...items);
        }
    }
    
    // Выбираем 6 случайных предметов для превью
    const previewCount = Math.min(6, allItems.length);
    const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
    const previewItems = shuffledItems.slice(0, previewCount);
    
    // Добавляем предметы в превью
    previewItems.forEach(item => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <div class="preview-item-icon">${item.icon}</div>
            <div class="preview-item-name">${item.name}</div>
        `;
        previewContainer.appendChild(previewItem);
    });
}

// Подготовка рулетки для кейса
function prepareRouletteForCase(caseItem) {
    console.log('Подготовка рулетки для кейса:', caseItem.name);
    
    // Генерируем начальную последовательность предметов
    rouletteItems = generateInitialRouletteSequence(caseItem);
    console.log('Сгенерирована начальная последовательность:', rouletteItems.length, 'предметов');
    
    // Сбрасываем позицию
    scrollPosition = 0;
    targetScroll = 0;
    isScrolling = false;
    
    // Отрисовываем предметы
    renderRouletteItems();
    
    // Даем время на отрисовку
    setTimeout(() => {
        if (!elements.rouletteContainer || !elements.itemsTrack) return;
        
        // Центрируем первый предмет
        const containerWidth = elements.rouletteContainer.clientWidth;
        const itemWidth = 110; // 100px предмет + 10px gap
        
        // Вычисляем позицию чтобы первый предмет был в центре
        const initialPosition = (containerWidth / 2) - (itemWidth / 2);
        
        elements.itemsTrack.style.transform = `translateX(${initialPosition}px)`;
        elements.itemsTrack.style.transition = 'none';
        
        console.log('Рулетка центрирована, позиция:', initialPosition);
    }, 100);
}

// Генерация начальной последовательности для рулетки
function generateInitialRouletteSequence(caseItem) {
    const sequence = [];
    const sequenceLength = 15; // Для предпросмотра
    
    // Собираем все возможные предметы для этого кейса
    const allItems = [];
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
            allItems.push(...items.map(item => ({
                ...item,
                rarity: rarity
            })));
        }
    }
    
    // Если предметов мало, добавляем случайные
    while (sequence.length < sequenceLength) {
        if (allItems.length === 0) break;
        const randomItem = {...allItems[Math.floor(Math.random() * allItems.length)]};
        sequence.push(randomItem);
    }
    
    // Если все еще мало, добавляем предметы из всех категорий
    if (sequence.length < sequenceLength) {
        const allMinecraftItems = [
            ...minecraftItems.common,
            ...minecraftItems.uncommon,
            ...minecraftItems.rare,
            ...minecraftItems.epic,
            ...minecraftItems.legendary
        ];
        
        while (sequence.length < sequenceLength) {
            const randomItem = {...allMinecraftItems[Math.floor(Math.random() * allMinecraftItems.length)]};
            randomItem.rarity = 'common';
            sequence.push(randomItem);
        }
    }
    
    return sequence;
}

// Отрисовка предметов в рулетке
function renderRouletteItems() {
    console.log('Отрисовка рулетки...');
    if (!elements.itemsTrack) return;
    
    elements.itemsTrack.innerHTML = '';
    
    rouletteItems.forEach((item, index) => {
        const rouletteItem = document.createElement('div');
        rouletteItem.className = `roulette-item`;
        rouletteItem.dataset.index = index;
        
        rouletteItem.innerHTML = `
            <div class="roulette-item-icon">${item.icon}</div>
            <div class="roulette-item-name">${item.name}</div>
            <div class="roulette-item-rarity ${item.rarity}">${getRarityText(item.rarity)}</div>
        `;
        
        elements.itemsTrack.appendChild(rouletteItem);
    });
    
    console.log('Рулетка отрисована:', rouletteItems.length, 'предметов');
}

// Открытие модального окна инвентаря
function openInventoryModal() {
    console.log('Открытие инвентаря');
    renderInventory();
    showModal(elements.inventoryModal);
}

// Просмотр предмета
function viewItem(item) {
    alert(`🎁 ${item.name}\n🎯 Редкость: ${getRarityText(item.rarity)}\n💎 Цена: ${item.price}\n📝 ${item.description}`);
}

// Открытие кейса
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
    
    console.log('Списываем средства...');
    
    // Генерируем выигрышный предмет
    const wonItem = generateWonItem(currentCase);
    currentItem = wonItem;
    console.log('Выигрышный предмет:', wonItem);
    
    // Отключаем кнопку открытия
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    // Если есть Telegram Web App, синхронизируем с сервером
    if (tg && tg.initData) {
        try {
            // Отправляем запрос на открытие кейса
            const response = await sendDataToBot('open_case', {
                case_id: currentCase.id
            });
            
            if (response && response.success) {
                // Обновляем данные с сервера
                userData.balance = response.new_balance;
                currentItem = response.item;
                
                // Добавляем предмет в локальный инвентарь
                inventoryData.unshift({
                    ...currentItem,
                    obtained_at: new Date().toISOString()
                });
                
                console.log('Кейс открыт через сервер:', response);
            } else {
                // Если ошибка с сервером, используем локальную логику
                handleLocalCaseOpening(wonItem);
            }
        } catch (error) {
            console.error('Ошибка открытия кейса через сервер:', error);
            handleLocalCaseOpening(wonItem);
        }
    } else {
        // Если нет Telegram Web App, используем локальную логику
        handleLocalCaseOpening(wonItem);
    }
    
    // Запускаем рулетку
    await startRouletteForCase(currentItem);
}

// Обработка открытия кейса локально
function handleLocalCaseOpening(wonItem) {
    // Списание средств
    userData.balance -= currentCase.price;
    elements.balance.textContent = userData.balance.toLocaleString();
    
    // Добавляем предмет в инвентарь
    inventoryData.unshift({
        ...wonItem,
        obtained_at: new Date().toISOString()
    });
    
    console.log('Кейс открыт локально');
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

// Запуск рулетки для кейса
function startRouletteForCase(wonItem) {
    return new Promise((resolve) => {
        isOpening = true;
        isRouletteActive = true;
        
        // Генерируем полную последовательность с выигрышным предметом в центре
        rouletteItems = generateFullRouletteSequence(wonItem);
        
        // Вычисляем индекс выигрышного предмета (должен быть в середине последовательности)
        winningItemIndex = Math.floor(rouletteItems.length / 2);
        
        // Убедимся что в центре именно выигрышный предмет
        rouletteItems[winningItemIndex] = {...wonItem};
        
        console.log('Выигрышный предмет в центре на позиции:', winningItemIndex);
        
        // Отрисовываем предметы заново
        renderRouletteItems();
        
        // Даем браузеру время на отрисовку
        setTimeout(() => {
            // Запускаем анимацию
            startRouletteAnimation(resolve);
        }, 100);
    });
}

// Генерация полной последовательности для анимации
function generateFullRouletteSequence(wonItem) {
    const sequence = [];
    const sequenceLength = 50; // Длинная последовательность для плавной анимации
    
    // Добавляем случайные предметы в начале
    for (let i = 0; i < sequenceLength / 2 - 5; i++) {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];
        const items = minecraftItems[randomRarity] || minecraftItems.common;
        const randomItem = {...items[Math.floor(Math.random() * items.length)]};
        randomItem.rarity = randomRarity;
        sequence.push(randomItem);
    }
    
    // Добавляем выигрышный предмет в середину
    sequence.push({...wonItem});
    
    // Добавляем переходные предметы после выигрышного
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

// Запуск анимации рулетки
function startRouletteAnimation(resolve) {
    console.log('Запуск анимации рулетки');
    isScrolling = true;
    
    const rouletteContainer = elements.rouletteContainer;
    if (!rouletteContainer) {
        console.error('Контейнер рулетки не найден');
        return;
    }
    
    const containerWidth = rouletteContainer.clientWidth;
    const itemWidth = 110; // 100px предмет + 10px gap
    const trackWidth = itemWidth * rouletteItems.length;
    
    // Начальная позиция (первый предмет в центре)
    const startPosition = (containerWidth / 2) - (itemWidth / 2);
    
    // Вычисляем финальную позицию так, чтобы выигрышный предмет оказался в центре
    const targetItemCenter = winningItemIndex * itemWidth + itemWidth / 2;
    const finalPosition = (containerWidth / 2) - targetItemCenter;
    
    console.log('Анимационные параметры:', {
        containerWidth,
        itemWidth,
        trackWidth,
        startPosition,
        finalPosition,
        winningItemIndex,
        targetItemCenter
    });
    
    // Устанавливаем начальную позицию
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transition = 'none';
        elements.itemsTrack.style.transform = `translateX(${startPosition}px)`;
    }
    
    // Даем браузеру время на отрисовку
    setTimeout(() => {
        animationStartTime = Date.now();
        
        // Случайная длительность анимации: от 3000 до 5000ms для разнообразия
        const animationDuration = 3000 + Math.random() * 2000;
        
        // Запускаем анимацию
        animateRoulette(startPosition, finalPosition, animationDuration, resolve);
    }, 100);
}

// Анимация рулетки
function animateRoulette(startPos, endPos, duration, resolve) {
    if (!isRouletteActive) return;
    
    const elapsed = Date.now() - animationStartTime;
    let progress = Math.min(elapsed / duration, 1);
    
    // Разные фазы анимации для реалистичности
    let easedProgress;
    
    if (progress < 0.2) {
        // Фаза 1: Медленный старт (0-20%)
        const phaseProgress = progress / 0.2;
        easedProgress = easeOutSine(phaseProgress) * 0.2;
    } else if (progress < 0.6) {
        // Фаза 2: Средняя скорость (20-60%)
        const phaseProgress = (progress - 0.2) / 0.4;
        easedProgress = 0.2 + phaseProgress * 0.4;
    } else if (progress < 0.8) {
        // Фаза 3: Быстрая скорость (60-80%)
        const phaseProgress = (progress - 0.6) / 0.2;
        easedProgress = 0.6 + easeOutCubic(phaseProgress) * 0.2;
    } else {
        // Фаза 4: Замедление с отскоком (80-100%)
        const phaseProgress = (progress - 0.8) / 0.2;
        easedProgress = 0.8 + easeInOutBack(phaseProgress) * 0.2;
    }
    
    // Плавное движение с замедлением в конце
    const currentPos = startPos + (endPos - startPos) * easedProgress;
    
    if (elements.itemsTrack) {
        // В последней фазе используем более плавную анимацию
        if (progress > 0.85) {
            elements.itemsTrack.style.transition = 'transform 0.1s linear';
        }
        elements.itemsTrack.style.transform = `translateX(${currentPos}px)`;
    }
    
    // Обновляем подсветку предметов
    updateCenterZoneItem();
    
    if (progress < 1) {
        requestAnimationFrame(() => animateRoulette(startPos, endPos, duration, resolve));
    } else {
        // Завершение анимации
        finishRouletteAnimation(resolve);
    }
}

// Обновление подсветки предмета в центре
function updateCenterZoneItem() {
    if (!elements.rouletteContainer || !elements.itemsTrack) return;
    
    const containerRect = elements.rouletteContainer.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const zoneWidth = 60; // Ширина зоны для определения центрального предмета
    
    const items = document.querySelectorAll('.roulette-item');
    let closestItem = null;
    let closestDistance = Infinity;
    
    items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const distanceToCenter = Math.abs(itemCenter - centerX);
        
        // Снимаем подсветку
        item.classList.remove('highlighted');
        
        if (distanceToCenter < zoneWidth && distanceToCenter < closestDistance) {
            closestDistance = distanceToCenter;
            closestItem = item;
        }
    });
    
    // Подсвечиваем ближайший предмет к центру
    if (closestItem && closestDistance < zoneWidth) {
        closestItem.classList.add('highlighted');
    }
}

// Завершение анимации рулетки
function finishRouletteAnimation(resolve) {
    console.log('Завершение анимации рулетки');
    isScrolling = false;
    
    // Финальная корректировка позиции
    setTimeout(() => {
        // Добавляем анимацию выигрыша на центральном предмете
        const highlightedItem = document.querySelector('.roulette-item.highlighted');
        if (highlightedItem) {
            highlightedItem.classList.add('winning-spin');
            
            const itemName = highlightedItem.querySelector('.roulette-item-name').textContent;
            const itemIcon = highlightedItem.querySelector('.roulette-item-icon').textContent;
            const itemIndex = parseInt(highlightedItem.dataset.index);
            
            // Находим полные данные предмета
            const wonItemData = rouletteItems[itemIndex];
            
            if (wonItemData) {
                currentItem = wonItemData;
                console.log('Выигрышный предмет:', currentItem);
                
                // Показываем результат через 1.5 секунды
                setTimeout(() => {
                    // Скрываем модальное окно кейса
                    hideModal(elements.caseModal);
                    
                    // Восстанавливаем кнопку для следующего открытия
                    if (userData.balance >= currentCase.price) {
                        elements.openCaseBtn.disabled = false;
                        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
                    } else {
                        elements.openCaseBtn.disabled = true;
                        elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
                    }
                    
                    // Показываем результат
                    showResult(currentItem);
                    isOpening = false;
                    isRouletteActive = false;
                    resolve();
                }, 1500);
            } else {
                console.error('Не удалось найти данные выигрышного предмета');
                handleRouletteError(resolve);
            }
        } else {
            console.error('Не найден подсвеченный предмет');
            handleRouletteError(resolve);
        }
    }, 500);
}

// Обработка ошибки рулетки
function handleRouletteError(resolve) {
    setTimeout(() => {
        hideModal(elements.caseModal);
        
        // Восстанавливаем кнопку
        if (userData.balance >= currentCase?.price) {
            elements.openCaseBtn.disabled = false;
            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase?.price || 0} 💎`;
        }
        
        if (currentItem) {
            showResult(currentItem);
        }
        isOpening = false;
        isRouletteActive = false;
        resolve();
    }, 1000);
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
    
    // Обновляем UI
    updateUI();
    
    // Добавляем эффект частиц
    createParticles();
    
    showModal(elements.resultModal);
}

// Создание частиц для эффекта
function createParticles() {
    const particleContainer = document.querySelector('.particle-effect');
    if (!particleContainer) return;
    
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
        particle.className = 'particle';
        
        const size = 5 + Math.random() * 10;
        const angle = (i / 20) * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        
        particle.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            background: ${color};
            border-radius: 50%;
            left: 50%;
            top: 50%;
            opacity: 0;
            animation: particleExplode 1.5s ease-out ${i * 0.05}s forwards;
            --end-x: ${Math.cos(angle) * distance}px;
            --end-y: ${Math.sin(angle) * distance}px;
            filter: drop-shadow(0 0 5px ${color});
        `;
        
        particleContainer.appendChild(particle);
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
    if (!modal) {
        console.error('Модальное окно не найдено');
        return;
    }
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    console.log('Показано модальное окно:', modal.id);
}

function hideModal(modal) {
    if (!modal) {
        console.error('Модальное окно не найдено');
        return;
    }
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

// Добавление тестовых предметов (для разработки)
function addTestItems() {
    console.log('Добавление тестовых предметов...');
    if (inventoryData.length === 0) {
        // Добавляем по одному предмету каждой редкости для демонстрации
        inventoryData = [
            { ...minecraftItems.common[0], rarity: 'common', obtained_at: new Date().toISOString() },
            { ...minecraftItems.uncommon[0], rarity: 'uncommon', obtained_at: new Date().toISOString() },
            { ...minecraftItems.rare[0], rarity: 'rare', obtained_at: new Date().toISOString() },
            { ...minecraftItems.epic[0], rarity: 'epic', obtained_at: new Date().toISOString() },
            { ...minecraftItems.legendary[0], rarity: 'legendary', obtained_at: new Date().toISOString() }
        ];
        renderInventory();
        alert('Тестовые предметы добавлены!');
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', openInventoryModal);
        console.log('Кнопка инвентаря настроена');
    }
    
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => {
            // Если рулетка активна, не закрываем
            if (isRouletteActive) {
                if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                    isRouletteActive = false;
                    hideModal(elements.caseModal);
                    // Восстанавливаем кнопку
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
        console.log('Кнопка открытия кейса настроена');
    }
    
    // Закрытие модальных окон по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isOpening) {
                if (overlay === elements.caseModal && isRouletteActive) {
                    if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                        isRouletteActive = false;
                        hideModal(elements.caseModal);
                        // Восстанавливаем кнопку
                        if (userData.balance >= currentCase?.price) {
                            elements.openCaseBtn.disabled = false;
                            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase?.price || 0} 💎`;
                        }
                    }
                    return;
                }
                hideModal(overlay);
            }
        });
    });
    
    console.log('Все обработчики настроены');
}

// Обработка сообщений от Telegram бота
if (tg) {
    tg.onEvent('webAppDataReceived', (data) => {
        try {
            const parsedData = JSON.parse(data);
            if (parsedData.user) {
                userData = parsedData.user;
                inventoryData = parsedData.inventory || [];
                casesData = parsedData.cases || [];
                updateUI();
                console.log('Данные получены от бота:', userData);
            }
        } catch (error) {
            console.error('Error parsing web app data:', error);
        }
    });
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    // Инициализация приложения
    initApp();
    
    // Настройка обработчиков событий
    initEventListeners();
    
    // Добавление тестовых предметов (кнопка для разработки)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
            addTestItems();
        }
        if (e.ctrlKey && e.key === 'b') {
            userData.balance += 1000;
            updateUI();
            alert('+1000 алмазов!');
        }
    });
    
    console.log('Приложение запущено');
});