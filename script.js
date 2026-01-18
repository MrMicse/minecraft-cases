// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
    console.log('Telegram Web App инициализирован');
    
    // Показываем основную кнопку
    tg.MainButton.text = "Открыть меню";
    tg.MainButton.show();
}

// Глобальные переменные
let userData = {
    balance: 0,
    experience: 0,
    level: 1
};

let casesData = [];
let inventoryData = [];
let currentCase = null;
let currentItem = null;
let isOpening = false;

// Кэш текстур
let texturesCache = {
    cases: {},
    items: {}
};

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

// Функция для загрузки текстур
async function loadTextures() {
    console.log('Загрузка текстур...');
    
    // Список текстур для загрузки
    const texturesToLoad = [
        // Кейсы
        { type: 'cases', name: 'case_food', path: 'assets/textures/cases/case_food.png' },
        { type: 'cases', name: 'case_resources', path: 'assets/textures/cases/case_resources.png' },
        { type: 'cases', name: 'case_weapons', path: 'assets/textures/cases/case_weapons.png' },
        { type: 'cases', name: 'case_legendary', path: 'assets/textures/cases/case_legendary.png' },
        { type: 'cases', name: 'case_donate', path: 'assets/textures/cases/case_donate.png' },
        { type: 'cases', name: 'case_random', path: 'assets/textures/cases/case_random.png' },
        
        // Предметы (основные)
        { type: 'items', name: 'diamond', path: 'assets/textures/items/diamond.png' },
        { type: 'items', name: 'emerald', path: 'assets/textures/items/emerald.png' },
        { type: 'items', name: 'gold_ingot', path: 'assets/textures/items/gold_ingot.png' },
        { type: 'items', name: 'iron_ingot', path: 'assets/textures/items/iron_ingot.png' },
        { type: 'items', name: 'apple', path: 'assets/textures/items/apple.png' },
        { type: 'items', name: 'bread', path: 'assets/textures/items/bread.png' },
        { type: 'items', name: 'diamond_sword', path: 'assets/textures/items/diamond_sword.png' },
        { type: 'items', name: 'bow', path: 'assets/textures/items/bow.png' }
    ];
    
    const loadPromises = texturesToLoad.map(texture => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log(`✅ Загружена текстура: ${texture.name}`);
                texturesCache[texture.type][texture.name] = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`❌ Не удалось загрузить: ${texture.path}`);
                // Создаем fallback изображение
                const canvas = document.createElement('canvas');
                canvas.width = 64;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                
                // Создаем простой цветной квадрат как fallback
                const colors = {
                    'cases': '#4b69ff',
                    'items': '#ffd700'
                };
                ctx.fillStyle = colors[texture.type] || '#888888';
                ctx.fillRect(0, 0, 64, 64);
                
                const fallbackImg = new Image();
                fallbackImg.src = canvas.toDataURL();
                texturesCache[texture.type][texture.name] = fallbackImg;
                resolve();
            };
            img.src = texture.path;
        });
    });
    
    await Promise.all(loadPromises);
    console.log('Все текстуры загружены');
}

// Получение имени текстуры из URL
function getTextureNameFromUrl(url) {
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.png', '');
}

// Получение HTML для изображения кейса
function getCaseImageHTML(caseItem) {
    const textureName = getTextureNameFromUrl(caseItem.texture_url);
    
    if (textureName && texturesCache.cases[textureName]) {
        return `<div class="case-texture" style="background-image: url('${texturesCache.cases[textureName].src}')"></div>`;
    }
    
    // Fallback на эмодзи
    return `<div class="case-icon">${caseItem.icon}</div>`;
}

// Получение HTML для изображения предмета
function getItemImageHTML(item) {
    if (item.texture_url) {
        const textureName = getTextureNameFromUrl(item.texture_url);
        if (textureName && texturesCache.items[textureName]) {
            return `<img src="${texturesCache.items[textureName].src}" alt="${item.name}" class="item-image">`;
        }
    }
    
    // Fallback на эмодзи
    return `<div class="item-icon">${item.icon}</div>`;
}

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    try {
        // Загружаем текстуры
        await loadTextures();
        
        // Сначала пытаемся загрузить из localStorage для быстрого отображения
        loadFromLocalStorage();
        
        // Затем синхронизируемся с сервером
        await syncWithServer();
        
        // Обновляем UI
        updateUI();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Ошибка загрузки данных. Пожалуйста, обновите страницу.');
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
        console.log('Данные пользователя:', userData);
    }, 500);
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('minecraftCaseData');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            userData.balance = parsed.balance || 0;
            userData.experience = parsed.experience || 0;
            userData.level = parsed.level || 1;
            inventoryData = parsed.inventory || [];
            console.log('Данные загружены из localStorage');
        } catch (e) {
            console.error('Ошибка загрузки из localStorage:', e);
        }
    }
}

// Сохранение в localStorage
function saveToLocalStorage() {
    const data = {
        balance: userData.balance,
        experience: userData.experience,
        level: userData.level,
        inventory: inventoryData
    };
    localStorage.setItem('minecraftCaseData', JSON.stringify(data));
}

// Синхронизация с сервером через Telegram Web App
async function syncWithServer() {
    console.log('Синхронизация с сервером...');
    
    try {
        // Отправляем запрос на синхронизацию через Telegram Web App
        const response = await sendDataToBot('init', {});
        
        if (response && response.success) {
            // Используем данные с сервера
            userData.balance = response.user.balance || 0;
            userData.experience = response.user.experience || 0;
            userData.level = response.user.level || 1;
            
            inventoryData = response.inventory || [];
            casesData = response.cases || [];
            
            // Сохраняем в localStorage
            saveToLocalStorage();
            
            console.log('Данные синхронизированы с сервером:', {
                balance: userData.balance,
                inventoryCount: inventoryData.length,
                casesCount: casesData.length
            });
            
            return response;
        } else {
            console.error('Ошибка синхронизации:', response?.error);
            loadDemoData();
            return null;
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        loadDemoData();
        return null;
    }
}

// Загрузка демо-данных
function loadDemoData() {
    console.log('Загрузка демо-данных...');
    
    casesData = [
        {
            id: 1,
            name: '🍎 Кейс с Едой',
            price: 100,
            icon: '🍎',
            description: 'Содержит разнообразную еду',
            rarityWeights: { common: 60, uncommon: 40 },
            texture_url: 'assets/textures/cases/case_food.png'
        },
        {
            id: 2,
            name: '⛏️ Ресурсный Кейс',
            price: 250,
            icon: '⛏️',
            description: 'Руды, минералы и базовые ресурсы',
            rarityWeights: { common: 40, uncommon: 50, rare: 10 },
            texture_url: 'assets/textures/cases/case_resources.png'
        },
        {
            id: 3,
            name: '⚔️ Оружейный Кейс',
            price: 500,
            icon: '⚔️',
            description: 'Оружие, броня и инструменты',
            rarityWeights: { uncommon: 30, rare: 50, epic: 20 },
            texture_url: 'assets/textures/cases/case_weapons.png'
        },
        {
            id: 4,
            name: '🌟 Легендарный Кейс',
            price: 1000,
            icon: '🌟',
            description: 'Уникальные предметы',
            rarityWeights: { rare: 20, epic: 50, legendary: 30 },
            texture_url: 'assets/textures/cases/case_legendary.png'
        },
        {
            id: 5,
            name: '👑 Доступный Кейс',
            price: 5000,
            icon: '👑',
            description: 'Эксклюзивные донат предметы',
            rarityWeights: { epic: 30, legendary: 70 },
            texture_url: 'assets/textures/cases/case_donate.png'
        },
        {
            id: 6,
            name: '🧰 Случайный Кейс',
            price: 750,
            icon: '🧰',
            description: 'Микс из всех категорий',
            rarityWeights: { common: 30, uncommon: 40, rare: 20, epic: 10 },
            texture_url: 'assets/textures/cases/case_random.png'
        }
    ];
    
    // Если данных нет, устанавливаем начальные значения
    if (userData.balance === 0) {
        userData.balance = 10000;
    }
    
    console.log('Демо-данные загружены');
}

// Отправка данных боту через Web App - УПРОЩЕННАЯ ВЕРСИЯ
async function sendDataToBot(action, data) {
    return new Promise((resolve) => {
        if (!tg) {
            console.log('Telegram Web App не доступен, используем демо-режим');
            resolve(handleDemoMode(action, data));
            return;
        }
        
        console.log(`Отправка данных боту: ${action}`, data);
        
        // Подготавливаем данные для отправки
        const requestData = JSON.stringify({
            action: action,
            ...data,
            timestamp: Date.now()
        });
        
        console.log('Отправляемые данные:', requestData);
        
        // Глобальная переменная для хранения обработчика
        window._botResponseHandler = null;
        
        // Создаем обработчик для получения ответа от бота
        window._botResponseHandler = async (event) => {
            // Этот обработчик будет вызываться когда бот ответит
            if (event.data && event.data.type === 'message') {
                try {
                    const message = event.data;
                    console.log('Получено сообщение от бота:', message);
                    
                    if (message.text) {
                        try {
                            const parsedData = JSON.parse(message.text);
                            console.log('Парсинг ответа от бота:', parsedData);
                            
                            // Удаляем обработчик после получения ответа
                            if (window._botResponseHandler) {
                                window.removeEventListener('message', window._botResponseHandler);
                                window._botResponseHandler = null;
                            }
                            resolve(parsedData);
                        } catch (e) {
                            console.error('Ошибка парсинга JSON:', e);
                            if (window._botResponseHandler) {
                                window.removeEventListener('message', window._botResponseHandler);
                                window._botResponseHandler = null;
                            }
                            resolve(handleDemoMode(action, data));
                        }
                    }
                } catch (e) {
                    console.error('Ошибка обработки сообщения:', e);
                    if (window._botResponseHandler) {
                        window.removeEventListener('message', window._botResponseHandler);
                        window._botResponseHandler = null;
                    }
                    resolve(handleDemoMode(action, data));
                }
            }
        };
        
        // Добавляем обработчик сообщений
        window.addEventListener('message', window._botResponseHandler);
        
        // Отправляем данные через Telegram Web App
        tg.sendData(requestData);
        
        // Таймаут на случай если ответ не придет
        setTimeout(() => {
            console.warn('Таймаут запроса, используем демо-режим');
            if (window._botResponseHandler) {
                window.removeEventListener('message', window._botResponseHandler);
                window._botResponseHandler = null;
            }
            resolve(handleDemoMode(action, data));
        }, 3000); // Уменьшаем таймаут до 3 секунд
    });
}

// Обработка действий в демо-режиме
function handleDemoMode(action, data) {
    console.log(`Демо-режим: ${action}`, data);
    
    switch (action) {
        case 'init':
            return {
                success: true,
                user: {
                    balance: userData.balance,
                    experience: userData.experience,
                    level: userData.level
                },
                inventory: inventoryData,
                cases: casesData,
                config: {
                    min_bet: 10,
                    max_bet: 10000,
                    daily_bonus: 100,
                    version: '1.0.0'
                }
            };
            
        case 'open_case':
            const caseItem = casesData.find(c => c.id === data.case_id);
            if (!caseItem) {
                return { success: false, error: 'Кейс не найден' };
            }
            
            if (userData.balance < caseItem.price) {
                return { success: false, error: 'Недостаточно средств' };
            }
            
            const wonItem = generateWonItem(caseItem);
            
            // Сразу обновляем баланс локально
            userData.balance -= caseItem.price;
            
            // Добавляем предмет в инвентарь
            inventoryData.unshift({
                ...wonItem,
                id: Date.now(),
                obtained_at: new Date().toISOString()
            });
            
            // Сохраняем в localStorage
            saveToLocalStorage();
            
            return {
                success: true,
                item: wonItem,
                new_balance: userData.balance,
                experience_gained: caseItem.price / 10,
                case_price: caseItem.price,
                experience: userData.experience,
                level: userData.level,
                inventory: inventoryData,
                user: {
                    balance: userData.balance,
                    experience: userData.experience,
                    level: userData.level
                }
            };
            
        case 'sell_item':
            const itemId = data.item_id;
            const itemIndex = inventoryData.findIndex(item => item.id === itemId);
            
            if (itemIndex === -1) {
                return { success: false, error: 'Предмет не найден' };
            }
            
            const soldItem = inventoryData[itemIndex];
            
            // Сразу обновляем баланс локально
            userData.balance += soldItem.price;
            
            // Удаляем предмет из инвентаря
            inventoryData.splice(itemIndex, 1);
            
            // Сохраняем в localStorage
            saveToLocalStorage();
            
            return {
                success: true,
                sell_price: soldItem.price,
                new_balance: userData.balance,
                inventory: inventoryData,
                user: {
                    balance: userData.balance,
                    experience: userData.experience,
                    level: userData.level
                }
            };
            
        case 'sync_data':
            return {
                success: true,
                user: {
                    balance: userData.balance,
                    experience: userData.experience,
                    level: userData.level
                },
                inventory: inventoryData,
                cases: casesData
            };
            
        default:
            return { success: false, error: 'Демо-режим: действие не поддерживается' };
    }
}

// Обновление интерфейса
function updateUI() {
    if (elements.balance) {
        elements.balance.textContent = userData.balance.toLocaleString();
    }
    renderCases();
    renderInventory();
}

// Отрисовка кейсов с PNG
function renderCases() {
    console.log('Отрисовка кейсов...');
    if (!elements.casesGrid) return;
    
    elements.casesGrid.innerHTML = '';
    
    // Если нет данных о кейсах, используем демо
    if (!casesData || casesData.length === 0) {
        loadDemoData();
    }
    
    casesData.forEach((caseItem, index) => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        caseCard.style.setProperty('--index', index);
        
        // Получаем HTML для изображения кейса
        const caseImageHTML = getCaseImageHTML(caseItem);
        
        // Собираем примеры предметов для превью
        const previewItems = getPreviewItems(caseItem);
        
        caseCard.innerHTML = `
            <div class="case-image">
                ${caseImageHTML}
                <div class="case-glow"></div>
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
    if (!elements.inventoryGrid) return;
    
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
            ${getItemImageHTML(item)}
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

// Открытие модального окна кейса - УЛУЧШЕННАЯ ВЕРСИЯ
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
    
    // Подготавливаем рулетку СРАЗУ
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

// Подготовка рулетки для кейса - УЛУЧШЕННАЯ ВЕРСИЯ
function prepareRouletteForCase(caseItem) {
    console.log('Подготовка рулетки для кейса:', caseItem.name);
    
    // Генерируем начальную последовательность предметов
    rouletteItems = generateInitialRouletteSequence(caseItem);
    
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
        const { containerWidth, itemWidth } = getRouletteMeasurements();
        
        // Вычисляем позицию чтобы первый предмет был в центре
        const initialPosition = (containerWidth / 2) - (itemWidth / 2);
        
        elements.itemsTrack.style.transform = `translateX(${initialPosition}px)`;
        elements.itemsTrack.style.transition = 'none';
    }, 50);
}

// Генерация начальной последовательности для рулетки
function generateInitialRouletteSequence(caseItem) {
    const sequence = [];
    const sequenceLength = 15;
    
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
    
    return sequence;
}

// Отрисовка предметов в рулетке с поддержкой PNG
function renderRouletteItems() {
    console.log('Отрисовка рулетки...');
    if (!elements.itemsTrack) return;
    
    elements.itemsTrack.innerHTML = '';
    
    rouletteItems.forEach((item, index) => {
        const rouletteItem = document.createElement('div');
        rouletteItem.className = `roulette-item ${item.rarity}`;
        rouletteItem.dataset.index = index;
        
        // Получаем HTML для изображения предмета
        const itemImageHTML = getItemImageHTML(item);
        
        rouletteItem.innerHTML = `
            <div class="roulette-item-icon">${itemImageHTML}</div>
            <div class="roulette-item-name">${item.name}</div>
            <div class="roulette-item-rarity ${item.rarity}">${getRarityText(item.rarity)}</div>
        `;
        
        elements.itemsTrack.appendChild(rouletteItem);
    });
}

// Открытие кейса - УЛУЧШЕННАЯ ВЕРСИЯ БЕЗ ЗАДЕРЖЕК
async function openCase() {
    console.log('Открытие кейса...');
    if (!currentCase || !userData || isOpening) {
        console.log('Не могу открыть кейс');
        return;
    }
    
    if (userData.balance < currentCase.price) {
        alert('❌ Недостаточно алмазов!');
        return;
    }
    
    console.log('Отправляем запрос на открытие кейса...');
    
    // Отключаем кнопку открытия
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    isOpening = true;
    
    // ЗАПУСКАЕМ АНИМАЦИЮ РУЛЕТКИ СРАЗУ
    const animationPromise = startRouletteAnimation();
    
    // ПАРАЛЛЕЛЬНО отправляем запрос на сервер
    const serverPromise = sendDataToBot('open_case', {
        case_id: currentCase.id
    });
    
    try {
        // Ждем завершения анимации рулетки (это происходит быстро)
        await animationPromise;
        
        // Затем ждем ответ от сервера
        const response = await serverPromise;
        
        console.log('Ответ от сервера:', response);
        
        if (response && response.success) {
            // Обновляем данные с сервера
            userData.balance = response.new_balance;
            userData.experience = response.experience || userData.experience;
            userData.level = response.level || userData.level;
            currentItem = response.item;
            
            // Обновляем инвентарь
            if (response.inventory) {
                inventoryData = response.inventory;
            }
            
            // Сохраняем в localStorage
            saveToLocalStorage();
            
            console.log('Кейс успешно открыт');
            
            // Показываем результат
            showResult(currentItem);
            
            // Обновляем UI
            updateUI();
            
        } else {
            console.error('Ошибка открытия кейса:', response?.error);
            alert(response?.error || 'Ошибка при открытии кейса');
            
            // Откатываем изменения
            userData.balance += currentCase.price;
            updateUI();
        }
        
    } catch (error) {
        console.error('Ошибка при открытии кейса:', error);
        alert('Ошибка соединения с сервером');
        
        // Откатываем изменения
        userData.balance += currentCase.price;
        updateUI();
    } finally {
        // Восстанавливаем кнопку
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
        isOpening = false;
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

// Запуск анимации рулетки - УЛУЧШЕННАЯ БЫСТРАЯ ВЕРСИЯ
function startRouletteAnimation() {
    return new Promise((resolve) => {
        isRouletteActive = true;
        
        // Генерируем выигрышный предмет для анимации
        const wonItem = generateWonItem(currentCase);
        currentItem = wonItem;
        
        // Генерируем полную последовательность с выигрышным предметом в центре
        rouletteItems = generateFullRouletteSequence(wonItem);
        
        // Вычисляем индекс выигрышного предмета
        winningItemIndex = Math.floor(rouletteItems.length / 2);
        rouletteItems[winningItemIndex] = {...wonItem};
        
        // Отрисовываем предметы заново
        renderRouletteItems();
        
        // Даем браузеру время на отрисовку
        setTimeout(() => {
            startRouletteAnimationSequence(resolve);
        }, 50);
    });
}

// Генерация полной последовательности для анимации
function generateFullRouletteSequence(wonItem) {
    const sequence = [];
    const sequenceLength = 40; // Уменьшаем для более быстрой анимации
    
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

// Запуск анимации рулетки - БЫСТРАЯ ВЕРСИЯ
function startRouletteAnimationSequence(resolve) {
    console.log('Запуск анимации рулетки');
    isScrolling = true;
    
    if (!elements.rouletteContainer || !elements.itemsTrack) {
        resolve();
        return;
    }
    
    const { containerWidth, itemWidth, step } = getRouletteMeasurements();
    const startPosition = (containerWidth / 2) - (itemWidth / 2);
    const targetItemCenter = winningItemIndex * step + itemWidth / 2;
    const finalPosition = (containerWidth / 2) - targetItemCenter;
    
    // Устанавливаем начальную позицию
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transition = 'none';
        elements.itemsTrack.style.transform = `translateX(${startPosition}px)`;
    }
    
    // Даем браузеру время на отрисовку
    setTimeout(() => {
        animationStartTime = Date.now();
        const animationDuration = 2600;
        
        animateRoulette(startPosition, finalPosition, animationDuration, resolve);
    }, 50);
}

// Анимация рулетки - ОПТИМИЗИРОВАННАЯ
function animateRoulette(startPos, endPos, duration, resolve) {
    if (!isRouletteActive) {
        resolve();
        return;
    }
    
    const elapsed = Date.now() - animationStartTime;
    let progress = Math.min(elapsed / duration, 1);
    
    // Плавное замедление к финалу
    let easedProgress = easeOutCubic(progress);
    
    const currentPos = startPos + (endPos - startPos) * easedProgress;
    
    if (elements.itemsTrack) {
        elements.itemsTrack.style.transform = `translateX(${currentPos}px)`;
    }
    
    // Обновляем подсветку предметов
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
    const centerZone = elements.rouletteContainer.querySelector('.center-zone');
    const zoneWidth = centerZone ? centerZone.getBoundingClientRect().width / 2 : 60;
    
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

function getRouletteMeasurements() {
    const containerWidth = elements.rouletteContainer?.clientWidth || 0;
    const firstItem = elements.itemsTrack?.querySelector('.roulette-item');
    const itemWidth = firstItem ? firstItem.getBoundingClientRect().width : 88;
    const trackStyles = elements.itemsTrack ? getComputedStyle(elements.itemsTrack) : null;
    const gapValue = trackStyles?.gap || trackStyles?.columnGap || '0';
    const gap = parseFloat(gapValue) || 0;
    const step = itemWidth + gap;

    return {
        containerWidth,
        itemWidth,
        gap,
        step
    };
}

// Завершение анимации рулетки - БЫСТРАЯ ВЕРСИЯ
function finishRouletteAnimation(resolve) {
    console.log('Завершение анимации рулетки');
    isScrolling = false;
    
    setTimeout(() => {
        const highlightedItem = document.querySelector('.roulette-item.highlighted');
        if (highlightedItem) {
            highlightedItem.classList.add('winning-spin');
        }
        
        setTimeout(() => {
            hideModal(elements.caseModal);
            isRouletteActive = false;
            resolve();
        }, 800); // Уменьшаем задержку
    }, 300);
}

// Показ результата с PNG изображением
function showResult(item) {
    console.log('Показ результата:', item);
    const resultCard = elements.resultModal?.querySelector('.result-modal');
    if (resultCard) {
        resultCard.classList.remove('result-modal--active');
        void resultCard.offsetWidth;
        resultCard.classList.add('result-modal--active');
    }
    
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price.toLocaleString();
    
    // Обновляем иконку с поддержкой PNG
    const itemImageHTML = getItemImageHTML(item);
    elements.resultItemIcon.innerHTML = itemImageHTML;
    
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
            animation: particleExplode 1s ease-out ${i * 0.03}s forwards;
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

// Просмотр предмета
function viewItem(item) {
    alert(`🎁 ${item.name}\n🎯 Редкость: ${getRarityText(item.rarity)}\n💎 Цена: ${item.price}\n📝 ${item.description}`);
}

// Открытие модального окна инвентаря
function openInventoryModal() {
    console.log('Открытие инвентаря');
    renderInventory();
    showModal(elements.inventoryModal);
}

// Управление модальными окнами
function showModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
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
    
    console.log('Все обработчики настроены');
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    // Инициализация приложения
    initApp();
    
    // Настройка обработчиков событий
    initEventListeners();
    
    console.log('Приложение запущено');
});