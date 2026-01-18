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

// Глобальные переменные - ТЕПЕРЬ ТОЛЬКО ДЛЯ UI, данные всегда с сервера
let userData = null;
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

        // Всегда синхронизируемся с сервером (единый источник истины)
        const serverData = await syncWithServer();
        
        if (serverData && serverData.success) {
            // Загружаем данные с сервера
            userData = serverData.user;
            casesData = serverData.cases || [];
            inventoryData = serverData.inventory || [];
            
            console.log('Данные с сервера:', {
                user: userData,
                casesCount: casesData.length,
                inventoryCount: inventoryData.length
            });
        } else {
            console.error('Ошибка загрузки с сервера');
            loadDemoData();
        }
        
        // Обновляем UI
        updateUI();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Ошибка загрузки данных. Пожалуйста, обновите страницу.');
        loadDemoData();
        updateUI();
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 500);
}

// Синхронизация с сервером через Telegram Web App
async function syncWithServer() {
    console.log('Синхронизация с сервером...');
    
    try {
        // Отправляем запрос на синхронизацию через Telegram Web App
        const response = await sendDataToBot('init', {});
        
        if (response && response.success) {
            console.log('Данные синхронизированы с сервером:', response);
            return response;
        } else {
            console.error('Ошибка синхронизации:', response?.error);
            return { success: false, error: response?.error || 'Ошибка синхронизации' };
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Загрузка демо-данных (только если сервер не доступен)
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
    if (!userData) {
        userData = {
            balance: 10000,
            experience: 0,
            level: 1
        };
    }
    
    inventoryData = [];
    
    console.log('Демо-данные загружены');
}

// Отправка данных боту через Web App
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
        }, 5000);
    });
}

// Обработка действий в демо-режиме
function handleDemoMode(action, data) {
    console.log(`Демо-режим: ${action}`, data);
    
    switch (action) {
        case 'init':
            return {
                success: true,
                user: userData || {
                    balance: 10000,
                    experience: 0,
                    level: 1
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
            
            if (!userData || userData.balance < caseItem.price) {
                return { success: false, error: 'Недостаточно средств' };
            }
            
            const wonItem = generateWonItem(caseItem);
            
            // Обновляем баланс локально (только для демо)
            userData.balance -= caseItem.price;
            
            // Добавляем предмет в инвентарь
            inventoryData.unshift({
                ...wonItem,
                id: Date.now(),
                obtained_at: new Date().toISOString()
            });
            
            return {
                success: true,
                item: wonItem,
                new_balance: userData.balance,
                experience_gained: caseItem.price / 10,
                case_price: caseItem.price,
                experience: userData.experience,
                level: userData.level,
                inventory: inventoryData,
                user: userData
            };
            
        case 'sell_item':
            const itemId = data.item_id;
            const itemIndex = inventoryData.findIndex(item => item.id === itemId);
            
            if (itemIndex === -1) {
                return { success: false, error: 'Предмет не найден' };
            }
            
            const soldItem = inventoryData[itemIndex];
            
            // Обновляем баланс локально (только для демо)
            userData.balance += soldItem.price;
            
            // Удаляем предмет из инвентаря
            inventoryData.splice(itemIndex, 1);
            
            return {
                success: true,
                sell_price: soldItem.price,
                new_balance: userData.balance,
                inventory: inventoryData,
                user: userData
            };
            
        case 'sync_data':
            return {
                success: true,
                user: userData,
                inventory: inventoryData,
                cases: casesData
            };
            
        default:
            return { success: false, error: 'Демо-режим: действие не поддерживается' };
    }
}

// Обновление интерфейса
function updateUI() {
    if (elements.balance && userData) {
        elements.balance.textContent = userData.balance.toLocaleString();
    }
    renderCases();
    renderInventory();
}

// Отрисовка кейсов
function renderCases() {
    console.log('Отрисовка кейсов...');
    if (!elements.casesGrid) return;
    
    elements.casesGrid.innerHTML = '';
    
    // Если нет данных о кейсах, используем демо
    if (!casesData || casesData.length === 0) {
        console.warn('Нет данных о кейсах');
        return;
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
                    ${previewItems.map((item, i) => `<span style="--item-index: ${i}">${item.icon}</span>`).join('')}
                </div>
            </div>
            <div class="case-info">
                <h3 class="case-name">${caseItem.name}</h3>
                <p class="case-price">${caseItem.price} 💎</p>
                <p class="case-description">${caseItem.description}</p>
            </div>
        `;
        
        // Добавляем обработчики для touch устройств
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        
        caseCard.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            e.preventDefault();
        }, { passive: false });
        
        caseCard.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            // Проверяем, был ли это тап (а не свайп)
            const timeDiff = touchEndTime - touchStartTime;
            const xDiff = Math.abs(touchEndX - touchStartX);
            const yDiff = Math.abs(touchEndY - touchStartY);
            
            if (timeDiff < 500 && xDiff < 10 && yDiff < 10) {
                openCaseModal(caseItem);
            }
            e.preventDefault();
        }, { passive: false });
        
        // Оставляем обработчик клика для десктопов
        caseCard.addEventListener('click', (e) => {
            // Проверяем, не было ли это событие вызвано touch событием
            if (Date.now() - touchStartTime > 100) {
                openCaseModal(caseItem);
            }
        });
        
        elements.casesGrid.appendChild(caseCard);
    });
    
    console.log('Кейсы отрисованы:', casesData.length);
}

// Получение предметов для превью кейса
function getPreviewItems(caseItem) {
    const previewItems = [];
    const allItems = [];
    
    // Временные данные для превью (в реальном приложении будут с сервера)
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", price: 50 },
            { name: "Уголь", icon: "⚫", price: 30 },
            { name: "Яблоко", icon: "🍎", price: 40 },
            { name: "Хлеб", icon: "🍞", price: 45 }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", price: 150 },
            { name: "Изумруд", icon: "🟩", price: 200 },
            { name: "Железная Кираса", icon: "🛡️", price: 180 }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", price: 500 },
            { name: "Кирокрыло", icon: "🪶", price: 600 },
            { name: "Элитра", icon: "🧥", price: 800 }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", price: 1000 },
            { name: "Сердце Моря", icon: "💙", price: 1200 },
            { name: "Голова Дракона", icon: "🐲", price: 1500 }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", price: 5000 },
            { name: "Меч Незера", icon: "🗡️", price: 3000 },
            { name: "Корона Власти", icon: "👑", price: 10000 }
        ]
    };
    
    // Собираем все возможные предметы для этого кейса
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
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
    
    if (!inventoryData || inventoryData.length === 0) {
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
    if (!userData || userData.balance < caseItem.price) {
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
    
    // Временные данные для превью
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", rarity: "common" },
            { name: "Уголь", icon: "⚫", rarity: "common" },
            { name: "Яблоко", icon: "🍎", rarity: "common" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", rarity: "uncommon" },
            { name: "Изумруд", icon: "🟩", rarity: "uncommon" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", rarity: "rare" }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", rarity: "epic" }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", rarity: "legendary" }
        ]
    };
    
    // Собираем все предметы для этого кейса
    const allItems = [];
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
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
    
    // Временные данные для рулетки
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", rarity: "common" },
            { name: "Уголь", icon: "⚫", rarity: "common" },
            { name: "Яблоко", icon: "🍎", rarity: "common" },
            { name: "Хлеб", icon: "🍞", rarity: "common" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", rarity: "uncommon" },
            { name: "Изумруд", icon: "🟩", rarity: "uncommon" },
            { name: "Железная Кираса", icon: "🛡️", rarity: "uncommon" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", rarity: "rare" },
            { name: "Кирокрыло", icon: "🪶", rarity: "rare" },
            { name: "Элитра", icon: "🧥", rarity: "rare" }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", rarity: "epic" },
            { name: "Сердце Моря", icon: "💙", rarity: "epic" },
            { name: "Голова Дракона", icon: "🐲", rarity: "epic" }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", rarity: "legendary" },
            { name: "Меч Незера", icon: "🗡️", rarity: "legendary" },
            { name: "Корона Власти", icon: "👑", rarity: "legendary" }
        ]
    };
    
    // Собираем все возможные предметы для этого кейса
    const allItems = [];
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            const items = minecraftItems[rarity];
            allItems.push(...items);
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

// Отрисовка предметов в рулетке
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

// Открытие кейса
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
    
    try {
        // Отправляем запрос на сервер
        const response = await sendDataToBot('open_case', {
            case_id: currentCase.id
        });
        
        console.log('Ответ от сервера:', response);
        
        if (response && response.success) {
            // Обновляем данные с сервера
            userData = response.user;
            inventoryData = response.inventory || [];
            currentItem = response.item;
            
            console.log('Кейс успешно открыт, обновленные данные:', {
                user: userData,
                inventoryCount: inventoryData.length
            });
            
            // Запускаем анимацию рулетки
            await startRouletteAnimation();
            
            // Показываем результат
            showResult(currentItem);
            
            // Обновляем UI
            updateUI();
            
        } else {
            console.error('Ошибка открытия кейса:', response?.error);
            alert(response?.error || 'Ошибка при открытии кейса');
            
            // Обновляем UI (возможно данные изменились)
            await syncWithServer();
            updateUI();
        }
        
    } catch (error) {
        console.error('Ошибка при открытии кейса:', error);
        alert('Ошибка соединения с сервером');
    } finally {
        // Восстанавливаем кнопку
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
        isOpening = false;
    }
}

// Генерация выигрышного предмета для демо-режима
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
        common: [
            { name: "Железный Слиток", icon: "⛓️", price: 50, rarity: "common", description: "Базовый ресурс" },
            { name: "Уголь", icon: "⚫", price: 30, rarity: "common", description: "Топливо и краситель" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", price: 150, rarity: "uncommon", description: "Ценный минерал" },
            { name: "Изумруд", icon: "🟩", price: 200, rarity: "uncommon", description: "Торговая валюта" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", price: 500, rarity: "rare", description: "Элитный материал" },
            { name: "Элитра", icon: "🧥", price: 800, rarity: "rare", description: "Позволяет летать" }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", price: 1000, rarity: "epic", description: "Спасение от смерти" },
            { name: "Сердце Моря", icon: "💙", price: 1200, rarity: "epic", description: "Редкая реликвия" }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", price: 5000, rarity: "legendary", description: "Божественный предмет" },
            { name: "Корона Власти", icon: "👑", price: 10000, rarity: "legendary", description: "Знак абсолютной власти" }
        ]
    };
    
    const availableItems = itemsByRarity[selectedRarity] || itemsByRarity.common;
    const randomItem = {...availableItems[Math.floor(Math.random() * availableItems.length)]};
    
    return randomItem;
}

// Запуск анимации рулетки
function startRouletteAnimation() {
    return new Promise((resolve) => {
        isRouletteActive = true;
        
        // Генерируем выигрышный предмет для анимации
        const wonItem = currentItem || generateWonItem(currentCase);
        
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
    const sequenceLength = 40;
    
    // Временные данные
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", rarity: "common" },
            { name: "Уголь", icon: "⚫", rarity: "common" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", rarity: "uncommon" },
            { name: "Изумруд", icon: "🟩", rarity: "uncommon" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", rarity: "rare" },
            { name: "Элитра", icon: "🧥", rarity: "rare" }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", rarity: "epic" },
            { name: "Сердце Моря", icon: "💙", rarity: "epic" }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", rarity: "legendary" },
            { name: "Корона Власти", icon: "👑", rarity: "legendary" }
        ]
    };
    
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

// Анимация рулетки
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

// Завершение анимации рулетки
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
        }, 800);
    }, 300);
}

// Показ результата
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
    
    // Обновляем иконку
    const itemImageHTML = getItemImageHTML(item);
    elements.resultItemIcon.innerHTML = itemImageHTML;
    
    if (userData) {
        elements.newBalance.textContent = userData.balance.toLocaleString();
    }
    
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
    alert(`🎁 ${item.name}\n🎯 Редкость: ${getRarityText(item.rarity)}\n💎 Цена: ${item.price}\n📝 ${item.description || 'Нет описания'}`);
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
    
    // Вспомогательная функция для добавления touch-обработчиков
    function addTouchHandlers(element, handler) {
        let touchStartTime = 0;
        
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            e.preventDefault();
        }, { passive: false });
        
        element.addEventListener('touchend', (e) => {
            if (Date.now() - touchStartTime < 500) {
                handler(e);
            }
            e.preventDefault();
        }, { passive: false });
        
        element.addEventListener('click', (e) => {
            // Для десктопов
            if (Date.now() - touchStartTime > 100) {
                handler(e);
            }
        });
    }
    
    // Обработчики для всех кнопок
    if (elements.inventoryBtn) {
        addTouchHandlers(elements.inventoryBtn, openInventoryModal);
    }
    
    if (elements.closeModal) {
        addTouchHandlers(elements.closeModal, () => {
            if (isRouletteActive) {
                if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                    isRouletteActive = false;
                    hideModal(elements.caseModal);
                    if (userData && userData.balance >= currentCase?.price) {
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
        addTouchHandlers(elements.closeInventory, () => hideModal(elements.inventoryModal));
    }
    
    if (elements.closeResult) {
        addTouchHandlers(elements.closeResult, () => hideModal(elements.resultModal));
    }
    
    if (elements.openCaseBtn) {
        addTouchHandlers(elements.openCaseBtn, openCase);
    }
    
    // Закрытие модальных окон по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isOpening) {
                if (overlay === elements.caseModal && isRouletteActive) {
                    if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                        isRouletteActive = false;
                        hideModal(elements.caseModal);
                        if (userData && userData.balance >= currentCase?.price) {
                            elements.openCaseBtn.disabled = false;
                            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase?.price || 0} 💎`;
                        }
                    }
                    return;
                }
                hideModal(overlay);
            }
        });
        
        // Также добавляем touch обработчик для overlay
        overlay.addEventListener('touchend', (e) => {
            if (e.target === overlay && !isOpening) {
                if (overlay === elements.caseModal && isRouletteActive) {
                    if (confirm('Рулетка все еще активна. Вы уверены, что хотите отменить открытие?')) {
                        isRouletteActive = false;
                        hideModal(elements.caseModal);
                        if (userData && userData.balance >= currentCase?.price) {
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