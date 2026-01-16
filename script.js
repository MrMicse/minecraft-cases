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
let isOpening = false;

// Переменные для рулетки
let scrollPosition = 0;
let targetScroll = 0;
let isScrolling = false;
let rouletteItems = [];
let winningItemIndex = 0;
let animationStartTime = 0;
let animationDuration = 3800; // Увеличили для большей плавности
let isRouletteActive = false;

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

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
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
    
    // Загружаем сохраненные данные
    loadUserData();
    
    updateUI();
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 1000);
}

// Загрузка данных пользователя
function loadUserData() {
    try {
        const savedData = localStorage.getItem('minecraft_case_opening_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            userData.balance = data.balance || 1000;
            inventoryData = data.inventory || [];
            console.log('Данные загружены:', userData);
        } else {
            console.log('Сохраненных данных нет, используем значения по умолчанию');
        }
    } catch (error) {
        console.log('Ошибка загрузки данных:', error);
    }
}

// Сохранение данных пользователя
function saveUserData() {
    const data = {
        balance: userData.balance,
        inventory: inventoryData
    };
    localStorage.setItem('minecraft_case_opening_data', JSON.stringify(data));
    console.log('Данные сохранены:', data);
}

// Обновление интерфейса
function updateUI() {
    elements.balance.textContent = userData.balance.toLocaleString();
    renderCases();
    renderInventory();
    saveUserData();
}

// Отрисовка кейсов с превью предметов
function renderCases() {
    console.log('Отрисовка кейсов...');
    elements.casesGrid.innerHTML = '';
    
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
    
    // Устанавливаем начальную позицию (первый предмет по центру)
    const rouletteContainer = elements.rouletteContainer;
    if (!rouletteContainer || !elements.itemsTrack) return;
    
    // Даем время на отрисовку
    setTimeout(() => {
        const containerWidth = rouletteContainer.clientWidth;
        const itemWidth = 83; // 75px предмет + 8px gap
        
        // Центрируем первый предмет
        const centerPosition = containerWidth / 2;
        const firstItemCenter = itemWidth / 2;
        const initialScroll = centerPosition - firstItemCenter;
        
        elements.itemsTrack.style.transform = `translateX(${initialScroll}px)`;
        elements.itemsTrack.style.transition = 'none';
    }, 50);
}

// Генерация начальной последовательности для рулетки
function generateInitialRouletteSequence(caseItem) {
    const sequence = [];
    const sequenceLength = 12; // Компактная рулетка для просмотра
    
    // Собираем все возможные предметы для этого кейса
    const allItems = [];
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
            // Берем по 1-2 предмета каждой редкости для демонстрации
            const sampleSize = Math.min(2, items.length);
            const shuffled = [...items].sort(() => Math.random() - 0.5);
            allItems.push(...shuffled.slice(0, sampleSize).map(item => ({
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
        rouletteItem.className = `roulette-item ${item.rarity}`;
        
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
    // Списание средств
    userData.balance -= currentCase.price;
    elements.balance.textContent = userData.balance.toLocaleString();
    
    // Отключаем кнопку открытия
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    // Генерируем выигрышный предмет
    const wonItem = generateWonItem(currentCase);
    currentItem = wonItem;
    console.log('Выигрышный предмет:', wonItem);
    
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
        
        // Генерируем полную последовательность с выигрышным предметом
        rouletteItems = generateFullRouletteSequence(wonItem);
        console.log('Сгенерирована полная последовательность:', rouletteItems.length, 'предметов');
        
        // Находим индекс выигрышного предмета
        winningItemIndex = findWinningItemIndex(wonItem);
        
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
    const sequenceLength = 35; // Длинная последовательность для плавности
    
    // Добавляем много случайных предметов в начале
    for (let i = 0; i < sequenceLength - 10; i++) {
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        const randomRarity = rarities[Math.floor(Math.random() * rarities.length)];
        const items = minecraftItems[randomRarity] || minecraftItems.common;
        const randomItem = {...items[Math.floor(Math.random() * items.length)]};
        randomItem.rarity = randomRarity;
        sequence.push(randomItem);
    }
    
    // Добавляем переходные предметы (разной редкости)
    for (let i = 0; i < 5; i++) {
        const transitionRarities = ['uncommon', 'rare', 'epic'];
        const randomRarity = transitionRarities[Math.floor(Math.random() * transitionRarities.length)];
        const items = minecraftItems[randomRarity] || minecraftItems.uncommon;
        const randomItem = {...items[Math.floor(Math.random() * items.length)]};
        randomItem.rarity = randomRarity;
        sequence.push(randomItem);
    }
    
    // Добавляем выигрышный предмет несколько раз подряд в конце
    for (let i = 0; i < 5; i++) {
        sequence.push({...wonItem});
    }
    
    return sequence;
}

// Поиск индекса выигрышного предмета в последовательности
function findWinningItemIndex(wonItem) {
    // Выигрышный предмет должен оказаться в зоне (не точно по центру)
    const lastIndex = rouletteItems.length - 1;
    // Выбираем случайный из последних 5 предметов для вариативности
    const offset = Math.floor(Math.random() * 3) + 2; // 2, 3 или 4
    return lastIndex - offset;
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
    const itemWidth = 83; // 75px предмет + 8px gap
    
    // Рассчитываем позицию для попадания в зону выигрышного предмета
    const centerPosition = containerWidth / 2;
    const targetItemCenter = winningItemIndex * itemWidth + itemWidth / 2;
    
    // Добавляем случайное смещение (±60px) чтобы не останавливалось точно по центру
    const randomOffset = (Math.random() * 120) - 60; // От -60 до +60 пикселей
    targetScroll = centerPosition - targetItemCenter + randomOffset;
    
    // Проверяем границы, чтобы не вылезло за пределы
    const trackWidth = itemWidth * rouletteItems.length;
    const maxScroll = trackWidth - containerWidth;
    const minScroll = 0;
    targetScroll = Math.max(-maxScroll, Math.min(targetScroll, minScroll));
    
    // Текущая позиция (центр первого предмета)
    const currentItemCenter = itemWidth / 2;
    const currentScroll = centerPosition - currentItemCenter;
    
    console.log('Параметры анимации:', {
        containerWidth,
        itemWidth,
        trackWidth,
        maxScroll,
        centerPosition,
        currentScroll,
        targetScroll,
        winningItemIndex,
        randomOffset
    });
    
    // Устанавливаем начальную позицию для анимации
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transition = 'transform 0.6s ease-out';
        elements.itemsTrack.style.transform = `translateX(${currentScroll}px)`;
    }
    
    // Даем браузеру время на отрисовку
    setTimeout(() => {
        // Запоминаем время начала анимации
        animationStartTime = Date.now();
        
        // Запускаем анимацию
        animateRoulette(resolve);
    }, 600);
}

// Анимация рулетки
function animateRoulette(resolve) {
    if (!isRouletteActive) return;
    
    const elapsed = Date.now() - animationStartTime;
    let progress = Math.min(elapsed / animationDuration, 1);
    
    // Разбиваем анимацию на 4 фазы для максимальной плавности:
    let easeProgress;
    
    if (progress < 0.15) {
        // Фаза 1: Очень плавный старт (0-15%)
        const phaseProgress = progress / 0.15;
        easeProgress = easeOutSine(phaseProgress) * 0.15;
    } else if (progress < 0.45) {
        // Фаза 2: Плавное ускорение (15-45%)
        const phaseProgress = (progress - 0.15) / 0.3;
        easeProgress = 0.15 + easeOutCubic(phaseProgress) * 0.3;
    } else if (progress < 0.75) {
        // Фаза 3: Максимальная скорость (45-75%)
        const phaseProgress = (progress - 0.45) / 0.3;
        easeProgress = 0.45 + phaseProgress * 0.3;
    } else {
        // Фаза 4: Плавное замедление с "отскоком" (75-100%)
        const phaseProgress = (progress - 0.75) / 0.25;
        easeProgress = 0.75 + easeInOutBack(phaseProgress) * 0.25;
    }
    
    // Прокручиваем трек
    const containerWidth = elements.rouletteContainer.clientWidth;
    const itemWidth = 83;
    const currentItemCenter = itemWidth / 2;
    const currentScroll = containerWidth / 2 - currentItemCenter;
    
    const rawPosition = currentScroll + (targetScroll - currentScroll) * easeProgress;
    scrollPosition = rawPosition;
    
    // Проверяем, чтобы не вылезало за границы
    const trackWidth = itemWidth * rouletteItems.length;
    const maxScrollValue = trackWidth - containerWidth;
    const boundedPosition = Math.max(-maxScrollValue, Math.min(rawPosition, 0));
    
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transform = `translateX(${boundedPosition}px)`;
    }
    
    // Определяем предмет в зоне
    updateCenterZoneItem();
    
    if (progress < 1) {
        // Продолжаем анимацию
        requestAnimationFrame(() => animateRoulette(resolve));
    } else {
        // Завершение анимации
        finishRouletteAnimation(resolve);
    }
}

// Обновление предмета в зоне
function updateCenterZoneItem() {
    const container = elements.rouletteContainer;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const zoneWidth = 120; // Широкая зона в 120px
    const zoneStart = containerRect.left + containerRect.width / 2 - zoneWidth / 2;
    const zoneEnd = containerRect.left + containerRect.width / 2 + zoneWidth / 2;
    
    const items = document.querySelectorAll('.roulette-item');
    let bestItem = null;
    let bestDistance = Infinity;
    
    items.forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        
        // Проверяем, находится ли предмет в зоне
        const inZone = itemCenter >= zoneStart && itemCenter <= zoneEnd;
        
        // Снимаем подсветку со всех
        item.classList.remove('highlighted');
        
        if (inZone) {
            // Находим предмет, который ближе всего к центру зоны
            const zoneCenter = containerRect.left + containerRect.width / 2;
            const distanceToCenter = Math.abs(itemCenter - zoneCenter);
            
            if (distanceToCenter < bestDistance) {
                bestDistance = distanceToCenter;
                bestItem = item;
            }
        }
    });
    
    // Подсвечиваем лучший предмет в зоне
    if (bestItem && bestDistance < 80) {
        bestItem.classList.add('highlighted');
    }
}

// Завершение анимации рулетки
function finishRouletteAnimation(resolve) {
    console.log('Завершение анимации рулетки');
    isScrolling = false;
    
    // Плавная финальная корректировка позиции
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transition = 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)';
        elements.itemsTrack.style.transform = `translateX(${targetScroll}px)`;
    }
    
    // Ждем завершения финальной анимации
    setTimeout(() => {
        // Находим подсвеченный предмет (в зоне)
        const highlightedItem = document.querySelector('.roulette-item.highlighted');
        if (highlightedItem) {
            console.log('Найден подсвеченный предмет в зоне:', highlightedItem);
            
            // Добавляем анимацию выигрыша
            highlightedItem.classList.add('winning-spin');
            
            // Находим данные выигрышного предмета
            const itemName = highlightedItem.querySelector('.roulette-item-name').textContent;
            const itemIcon = highlightedItem.querySelector('.roulette-item-icon').textContent;
            
            // Находим полные данные предмета
            const allItems = [
                ...minecraftItems.common,
                ...minecraftItems.uncommon,
                ...minecraftItems.rare,
                ...minecraftItems.epic,
                ...minecraftItems.legendary
            ];
            
            const wonItemData = allItems.find(item => 
                item.name === itemName && item.icon === itemIcon
            );
            
            if (wonItemData) {
                // Добавляем редкость из класса элемента
                const rarityClass = Array.from(highlightedItem.classList).find(cls => 
                    ['common', 'uncommon', 'rare', 'epic', 'legendary'].includes(cls)
                );
                
                currentItem = {
                    ...wonItemData,
                    rarity: rarityClass || 'common'
                };
                
                console.log('Выигрышный предмет:', currentItem);
                
                // Добавляем предмет в инвентарь
                inventoryData.unshift({
                    ...currentItem,
                    obtained_at: new Date().toISOString()
                });
                
                saveUserData();
                
                // Показываем результат через 2 секунды
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
                }, 2000);
            } else {
                console.error('Не удалось найти данные предмета:', itemName, itemIcon);
                handleRouletteError(resolve);
            }
        } else {
            console.error('Не найден подсвеченный предмет в зоне');
            handleRouletteError(resolve);
        }
    }, 1000);
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
        saveUserData();
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
                updateUI();
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