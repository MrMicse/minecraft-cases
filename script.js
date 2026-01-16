// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
let userData = null;

// Глобальные переменные
let casesData = [];
let inventoryData = [];
let currentCase = null;
let currentItem = null;
let isOpening = false;
let rouletteItems = [];
let winningItemIndex = 0;
let animationStartTime = 0;
let isRouletteActive = false;

// DOM элементы
const elements = {
    balance: document.getElementById('user-balance'),
    casesGrid: document.getElementById('cases-grid'),
    itemsTrack: document.getElementById('items-track'),
    inventoryGrid: document.getElementById('inventory-grid'),
    caseModal: document.getElementById('case-modal'),
    inventoryModal: document.getElementById('inventory-modal'),
    resultModal: document.getElementById('result-modal'),
    loadingOverlay: document.getElementById('loading'),
    inventoryBtn: document.getElementById('inventory-btn'),
    closeModal: document.getElementById('close-modal'),
    closeInventory: document.getElementById('close-inventory'),
    closeResult: document.getElementById('close-result'),
    openCaseBtn: document.getElementById('open-case-btn'),
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

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    if (tg && tg.initDataUnsafe?.user) {
        // Используем Telegram Web App
        await initTelegramWebApp();
    } else {
        // Локальная разработка без бота
        console.warn('Запуск в режиме разработки (без Telegram Web App)');
        await initLocalData();
    }
    
    updateUI();
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 1000);
}

// Инициализация Telegram Web App
async function initTelegramWebApp() {
    if (!tg) return;
    
    tg.expand();
    tg.BackButton?.hide();
    tg.ready();
    
    try {
        // Отправляем данные для инициализации боту
        const initData = {
            action: 'init',
            timestamp: Date.now()
        };
        
        console.log('Отправка данных инициализации...');
        
        // Используем Telegram Web App для отправки данных
        tg.sendData(JSON.stringify(initData));
        
        // Ожидаем ответ от бота
        tg.onEvent('webAppDataReceived', (receivedData) => {
            try {
                const response = JSON.parse(receivedData);
                console.log('Получен ответ от бота:', response);
                
                if (response.success) {
                    userData = response.user;
                    inventoryData = response.inventory || [];
                    casesData = response.cases || [];
                    
                    console.log('Данные получены от бота:', {
                        user: userData,
                        inventory: inventoryData.length,
                        cases: casesData.length
                    });
                    
                    updateUI();
                    hideLoading();
                } else {
                    console.error('Ошибка инициализации:', response.error);
                    initLocalData();
                }
            } catch (error) {
                console.error('Ошибка парсинга ответа:', error);
                initLocalData();
            }
        });
        
        // Таймаут на случай отсутствия ответа
        setTimeout(() => {
            if (!userData) {
                console.warn('Таймаут ожидания ответа от бота, используем локальные данные');
                initLocalData();
            }
        }, 5000);
        
    } catch (error) {
        console.error('Ошибка подключения к боту:', error);
        initLocalData();
    }
}

// Локальная инициализация для разработки
async function initLocalData() {
    userData = {
        user_id: 123456789,
        username: "dev_user",
        first_name: "Разработчик",
        balance: 5000,
        experience: 0,
        level: 1
    };
    
    // Примерные кейсы (синхронизировано с ботом)
    casesData = [
        {
            id: 1,
            name: '🍎 Кейс с Едой',
            price: 100,
            icon: '🍎',
            description: 'Содержит разнообразную еду и напитки',
            rarityWeights: { common: 70, uncommon: 30 }
        },
        {
            id: 2,
            name: '⛏️ Ресурсный Кейс',
            price: 250,
            icon: '⛏️',
            description: 'Руды, минералы и базовые ресурсы',
            rarityWeights: { common: 50, uncommon: 40, rare: 10 }
        },
        {
            id: 3,
            name: '⚔️ Оружейный Кейс',
            price: 500,
            icon: '⚔️',
            description: 'Оружие, броня и инструменты',
            rarityWeights: { uncommon: 40, rare: 50, epic: 10 }
        },
        {
            id: 4,
            name: '🌟 Легендарный Кейс',
            price: 1000,
            icon: '🌟',
            description: 'Уникальные и легендарные предметы',
            rarityWeights: { rare: 30, epic: 50, legendary: 20 }
        }
    ];
    
    // Примерный инвентарь
    inventoryData = [];
    
    console.log('Локальные данные загружены');
    updateUI();
}

// Отправка данных боту
async function sendDataToBot(data) {
    if (tg && tg.initDataUnsafe?.user) {
        return new Promise((resolve) => {
            tg.sendData(JSON.stringify(data));
            
            tg.onEvent('webAppDataReceived', (receivedData) => {
                try {
                    const response = JSON.parse(receivedData);
                    resolve(response);
                } catch (error) {
                    console.error('Ошибка парсинга ответа:', error);
                    resolve({ error: 'Ошибка обработки ответа' });
                }
            });
            
            // Таймаут
            setTimeout(() => {
                resolve({ error: 'Таймаут ожидания ответа' });
            }, 10000);
        });
    } else {
        // Локальная обработка
        return await handleLocalRequest(data);
    }
}

// Локальная обработка запросов для разработки
async function handleLocalRequest(data) {
    switch (data.action) {
        case 'init':
            return {
                success: true,
                user: userData,
                inventory: inventoryData,
                cases: casesData
            };
            
        case 'open_case':
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const caseItem = casesData.find(c => c.id === data.case_id);
            if (!caseItem) {
                return { error: 'Кейс не найден' };
            }
            
            if (userData.balance < caseItem.price) {
                return { error: 'Недостаточно средств' };
            }
            
            // Генерация выигрышного предмета
            const wonItem = generateWonItem(caseItem);
            userData.balance -= caseItem.price;
            
            // Добавляем в инвентарь
            const existingItem = inventoryData.find(i => i.name === wonItem.name);
            if (existingItem) {
                existingItem.quantity = (existingItem.quantity || 1) + 1;
            } else {
                inventoryData.push({
                    ...wonItem,
                    id: Date.now(),
                    quantity: 1,
                    obtained_at: new Date().toISOString()
                });
            }
            
            return {
                success: true,
                item: wonItem,
                new_balance: userData.balance,
                experience_gained: Math.floor(caseItem.price / 10)
            };
            
        case 'sell_item':
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const itemIndex = inventoryData.findIndex(i => i.id === data.item_id);
            if (itemIndex === -1) {
                return { error: 'Предмет не найден' };
            }
            
            const item = inventoryData[itemIndex];
            const sellPrice = Math.floor(item.price * 0.5);
            
            userData.balance += sellPrice;
            
            if (item.quantity > 1) {
                item.quantity -= 1;
            } else {
                inventoryData.splice(itemIndex, 1);
            }
            
            return {
                success: true,
                sell_price: sellPrice,
                new_balance: userData.balance
            };
            
        default:
            return { error: 'Неизвестное действие' };
    }
}

// Обновление интерфейса
function updateUI() {
    if (userData) {
        elements.balance.textContent = userData.balance.toLocaleString();
    }
    renderCases();
    renderInventory();
}

// Отрисовка кейсов
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
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
            allItems.push(...items);
        }
    }
    
    // Выбираем 3-4 случайных предметов для превью
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
        return;
    }
    
    inventoryData.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.rarity = item.rarity;
        
        const sellPrice = item.sell_price || Math.floor(item.price * 0.5);
        const quantity = item.quantity || 1;
        
        itemElement.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <h4>${item.name}</h4>
            <span class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</span>
            <p style="font-size: 0.8rem; color: var(--accent-diamond); margin-top: 5px;">
                💎 ${item.price} (Продажа: ${sellPrice})
            </p>
            <p style="font-size: 0.7rem; color: var(--text-secondary);">
                Кол-во: ${quantity}
            </p>
        `;
        
        // Добавляем кнопку продажи
        const sellBtn = document.createElement('button');
        sellBtn.className = 'btn-sell';
        sellBtn.innerHTML = `💰 Продать за ${sellPrice} 💎`;
        sellBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Продать ${item.name} за ${sellPrice} 💎?`)) {
                const result = await sellItem(item.id || item.item_id);
                if (result.success) {
                    alert('✅ Предмет продан!');
                    renderInventory();
                    updateUI();
                } else {
                    alert(`❌ Ошибка: ${result.error}`);
                }
            }
        };
        
        itemElement.appendChild(sellBtn);
        itemElement.addEventListener('click', () => viewItem(item));
        elements.inventoryGrid.appendChild(itemElement);
    });
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
    
    previewContainer.innerHTML = '';
    
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
    
    const previewCount = Math.min(6, allItems.length);
    const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
    const previewItems = shuffledItems.slice(0, previewCount);
    
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
    
    rouletteItems = generateInitialRouletteSequence(caseItem);
    console.log('Сгенерирована начальная последовательность:', rouletteItems.length, 'предметов');
    
    scrollPosition = 0;
    targetScroll = 0;
    isScrolling = false;
    
    renderRouletteItems();
    
    setTimeout(() => {
        if (!elements.rouletteContainer || !elements.itemsTrack) return;
        
        const containerWidth = elements.rouletteContainer.clientWidth;
        const itemWidth = 110;
        const initialPosition = (containerWidth / 2) - (itemWidth / 2);
        
        elements.itemsTrack.style.transform = `translateX(${initialPosition}px)`;
        elements.itemsTrack.style.transition = 'none';
        
        console.log('Рулетка центрирована, позиция:', initialPosition);
    }, 100);
}

// Генерация начальной последовательности для рулетки
function generateInitialRouletteSequence(caseItem) {
    const sequence = [];
    const sequenceLength = 15;
    
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
    
    while (sequence.length < sequenceLength) {
        if (allItems.length === 0) break;
        const randomItem = {...allItems[Math.floor(Math.random() * allItems.length)]};
        sequence.push(randomItem);
    }
    
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
    
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    try {
        const data = {
            action: 'open_case',
            case_id: currentCase.id
        };
        
        const result = await sendDataToBot(data);
        
        if (result.error) {
            alert(`❌ Ошибка: ${result.error}`);
            elements.openCaseBtn.disabled = false;
            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
            return;
        }
        
        // Обновляем данные
        userData.balance = result.new_balance;
        currentItem = result.item;
        
        // Запускаем рулетку
        await startRouletteForCase(currentItem);
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        alert('❌ Ошибка при открытии кейса');
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
    }
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
    const itemWidth = 110;
    const trackWidth = itemWidth * rouletteItems.length;
    
    const startPosition = (containerWidth / 2) - (itemWidth / 2);
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
    
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transition = 'none';
        elements.itemsTrack.style.transform = `translateX(${startPosition}px)`;
    }
    
    setTimeout(() => {
        animationStartTime = Date.now();
        const animationDuration = 3000 + Math.random() * 2000;
        animateRoulette(startPosition, finalPosition, animationDuration, resolve);
    }, 100);
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

// Обновление подсветки предмета в центре
function updateCenterZoneItem() {
    if (!elements.rouletteContainer || !elements.itemsTrack) return;
    
    const containerRect = elements.rouletteContainer.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    const zoneWidth = 60;
    
    const items = document.querySelectorAll('.roulette-item');
    let closestItem = null;
    let closestDistance = Infinity;
    
    items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenter = itemRect.left + itemRect.width / 2;
        const distanceToCenter = Math.abs(itemCenter - centerX);
        
        item.classList.remove('highlighted');
        
        if (distanceToCenter < zoneWidth && distanceToCenter < closestDistance) {
            closestDistance = distanceToCenter;
            closestItem = item;
        }
    });
    
    if (closestItem && closestDistance < zoneWidth) {
        closestItem.classList.add('highlighted');
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
            
            const itemName = highlightedItem.querySelector('.roulette-item-name').textContent;
            const itemIcon = highlightedItem.querySelector('.roulette-item-icon').textContent;
            const itemIndex = parseInt(highlightedItem.dataset.index);
            
            const wonItemData = rouletteItems[itemIndex];
            
            if (wonItemData) {
                currentItem = wonItemData;
                
                console.log('Выигрышный предмет:', currentItem);
                
                // Добавляем предмет в локальный инвентарь
                const existingItem = inventoryData.find(i => i.name === currentItem.name);
                if (existingItem) {
                    existingItem.quantity = (existingItem.quantity || 1) + 1;
                } else {
                    inventoryData.unshift({
                        ...currentItem,
                        id: Date.now(),
                        quantity: 1,
                        obtained_at: new Date().toISOString()
                    });
                }
                
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
                    updateUI();
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
        
        if (userData.balance >= currentCase?.price) {
            elements.openCaseBtn.disabled = false;
            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase?.price || 0} 💎`;
        }
        
        if (currentItem) {
            showResult(currentItem);
        }
        isOpening = false;
        isRouletteActive = false;
        updateUI();
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

// Продажа предмета
async function sellItem(itemId) {
    try {
        const data = {
            action: 'sell_item',
            item_id: itemId
        };
        
        const result = await sendDataToBot(data);
        
        if (result.error) {
            return { success: false, error: result.error };
        }
        
        // Обновляем данные
        userData.balance = result.new_balance;
        
        // Обновляем интерфейс
        updateUI();
        
        return { success: true };
        
    } catch (error) {
        console.error('Ошибка продажи предмета:', error);
        return { success: false, error: 'Ошибка при продаже предмета' };
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
    
    // Закрытие модальных окон по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isOpening) {
                if (overlay === elements.caseModal && isRouletteActive) {
                    if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                        isRouletteActive = false;
                        hideModal(elements.caseModal);
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
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    // Инициализация приложения
    initApp();
    
    // Настройка обработчиков событий
    initEventListeners();
    
    // Горячие клавиши для разработки
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
            // Добавить тестовый предмет
            const testItem = {
                id: Date.now(),
                name: "Тестовый Предмет",
                icon: "⭐",
                rarity: "epic",
                price: 1000,
                quantity: 1,
                obtained_at: new Date().toISOString()
            };
            inventoryData.push(testItem);
            renderInventory();
            alert('Тестовый предмет добавлен!');
        }
        if (e.ctrlKey && e.key === 'b') {
            // Добавить алмазы
            if (userData) {
                userData.balance += 1000;
                updateUI();
                alert('+1000 алмазов!');
            }
        }
    });
    
    console.log('Приложение запущено');
});