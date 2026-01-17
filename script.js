// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
}

// Глобальные переменные
let userData = {
    balance: 10000,
    inventory: [],
    userId: null,
    username: null
};

let casesData = [];
let inventoryData = [];
let currentCase = null;
let currentItem = null;
let isOpening = false;
let isInitialized = false;

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
    rouletteContainer: document.getElementById('roulette-container'),
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

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    try {
        // Загружаем кейсы
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
        
        // Получаем данные пользователя
        await loadUserData();
        
        updateUI();
        isInitialized = true;
        
        console.log('Данные пользователя:', {
            balance: userData.balance,
            inventoryCount: inventoryData.length,
            userId: userData.userId
        });
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        // Используем локальные данные при ошибке
        loadUserDataFromLocal();
        updateUI();
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 1000);
}

// Загрузка данных пользователя
async function loadUserData() {
    console.log('Загрузка данных пользователя...');
    
    // Сначала пытаемся загрузить из localStorage
    const localData = loadUserDataFromLocal();
    
    // Если есть Telegram Web App, синхронизируем с сервером
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        userData.userId = tg.initDataUnsafe.user.id;
        userData.username = tg.initDataUnsafe.user.username || 
                           tg.initDataUnsafe.user.first_name;
        
        console.log('Telegram пользователь:', {
            id: userData.userId,
            username: userData.username
        });
        
        try {
            // Пытаемся получить свежие данные с сервера
            const serverData = await getServerUserData();
            
            if (serverData && serverData.success) {
                console.log('Получены данные с сервера:', serverData);
                
                // Приоритет у серверных данных
                userData.balance = serverData.user.balance || localData.balance || 10000;
                
                // Объединяем инвентари (серверный + локальный)
                if (serverData.inventory && serverData.inventory.length > 0) {
                    inventoryData = serverData.inventory;
                } else if (localData.inventory && localData.inventory.length > 0) {
                    inventoryData = localData.inventory;
                }
                
                console.log('Используем серверные данные');
            } else {
                // Если сервер не ответил, используем локальные данные
                console.log('Используем локальные данные (сервер не ответил)');
                userData.balance = localData.balance || 10000;
                inventoryData = localData.inventory || [];
            }
            
        } catch (error) {
            console.error('Ошибка загрузки с сервера:', error);
            // При ошибке используем локальные данные
            userData.balance = localData.balance || 10000;
            inventoryData = localData.inventory || [];
        }
        
        // Сохраняем обновленные данные локально
        saveUserDataToLocal();
        
    } else {
        // Без Telegram используем только локальные данные
        console.log('Telegram не обнаружен, используем локальные данные');
        userData.balance = localData.balance || 10000;
        inventoryData = localData.inventory || [];
    }
}

// Загрузка данных с сервера
async function getServerUserData() {
    return new Promise((resolve, reject) => {
        if (!tg) {
            reject(new Error('Telegram Web App не доступен'));
            return;
        }
        
        const data = {
            action: 'get_user_data',
            timestamp: Date.now()
        };
        
        // Отправляем запрос через sendData
        tg.sendData(JSON.stringify(data));
        
        // Ожидаем ответ от бота
        const handler = (eventData) => {
            try {
                const parsedData = JSON.parse(eventData);
                if (parsedData.success) {
                    resolve(parsedData);
                } else {
                    reject(new Error(parsedData.error || 'Ошибка сервера'));
                }
            } catch (error) {
                reject(error);
            }
        };
        
        // Добавляем обработчик для получения ответа
        tg.onEvent('webAppDataReceived', handler);
        
        // Таймаут на случай отсутствия ответа
        setTimeout(() => {
            tg.offEvent('webAppDataReceived', handler);
            reject(new Error('Таймаут ожидания ответа от сервера'));
        }, 3000);
    });
}

// Загрузка данных из localStorage
function loadUserDataFromLocal() {
    try {
        const savedData = localStorage.getItem('minecraft_case_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            
            // Проверяем, не устарели ли данные (больше 1 дня)
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            if (data.timestamp && data.timestamp > oneDayAgo) {
                console.log('Локальные данные загружены:', {
                    balance: data.balance,
                    inventoryCount: data.inventory ? data.inventory.length : 0
                });
                return data;
            } else {
                console.log('Локальные данные устарели');
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки локальных данных:', error);
    }
    
    return { balance: 10000, inventory: [] };
}

// Сохранение данных в localStorage
function saveUserDataToLocal() {
    try {
        const data = {
            balance: userData.balance,
            inventory: inventoryData,
            userId: userData.userId,
            username: userData.username,
            timestamp: Date.now()
        };
        
        localStorage.setItem('minecraft_case_data', JSON.stringify(data));
        console.log('Данные сохранены локально:', {
            balance: userData.balance,
            inventoryCount: inventoryData.length
        });
    } catch (error) {
        console.error('Ошибка сохранения локальных данных:', error);
    }
}

// Синхронизация с сервером
async function syncWithServer() {
    if (!tg || !userData.userId) {
        console.log('Синхронизация невозможна: нет Telegram или user_id');
        return false;
    }
    
    try {
        const syncData = {
            action: 'sync_user_data',
            data: {
                balance: userData.balance,
                inventory: inventoryData,
                userId: userData.userId,
                username: userData.username
            },
            timestamp: Date.now()
        };
        
        console.log('Отправка данных на сервер для синхронизации:', {
            balance: userData.balance,
            inventoryCount: inventoryData.length
        });
        
        // Отправляем данные через Telegram
        tg.sendData(JSON.stringify(syncData));
        
        // Ожидаем подтверждения
        return new Promise((resolve) => {
            const handler = (eventData) => {
                try {
                    const parsedData = JSON.parse(eventData);
                    if (parsedData.success) {
                        console.log('Синхронизация успешна:', parsedData.message);
                        resolve(true);
                    } else {
                        console.error('Ошибка синхронизации:', parsedData.error);
                        resolve(false);
                    }
                } catch (error) {
                    console.error('Ошибка обработки ответа синхронизации:', error);
                    resolve(false);
                }
            };
            
            tg.onEvent('webAppDataReceived', handler);
            
            setTimeout(() => {
                tg.offEvent('webAppDataReceived', handler);
                console.log('Таймаут синхронизации');
                resolve(false);
            }, 2000);
        });
        
    } catch (error) {
        console.error('Ошибка синхронизации с сервером:', error);
        return false;
    }
}

// Обновление интерфейса
function updateUI() {
    elements.balance.textContent = userData.balance.toLocaleString();
    renderCases();
    renderInventory();
}

// Отрисовка кейсов
function renderCases() {
    elements.casesGrid.innerHTML = '';
    
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
}

// Получение предметов для превью кейса
function getPreviewItems(caseItem) {
    const allItems = [];
    
    // Получаем предметы по редкости
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", price: 50, description: "Базовый ресурс для крафта" },
            { name: "Уголь", icon: "⚫", price: 30, description: "Топливо и краситель" },
            { name: "Яблоко", icon: "🍎", price: 40, description: "Восстанавливает голод" },
            { name: "Хлеб", icon: "🍞", price: 45, description: "Хорошая еда" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", price: 150, description: "Ценный минерал" },
            { name: "Изумруд", icon: "🟩", price: 200, description: "Торговая валюта" },
            { name: "Железная Кираса", icon: "🛡️", price: 180, description: "Защита от урона" },
            { name: "Алмазный Меч", icon: "⚔️", price: 250, description: "Мощное оружие" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", price: 500, description: "Элитный материал" },
            { name: "Кирокрыло", icon: "🪶", price: 600, description: "Мгновенное перемещение" },
            { name: "Элитра", icon: "🧥", price: 800, description: "Полеты в мире" }
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
    
    for (const [rarity, weight] of Object.entries(caseItem.rarityWeights)) {
        if (weight > 0 && minecraftItems[rarity]) {
            allItems.push(...minecraftItems[rarity]);
        }
    }
    
    const count = Math.min(4, allItems.length);
    const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
    return shuffledItems.slice(0, count);
}

// Открытие модального окна кейса
function openCaseModal(caseItem) {
    currentCase = caseItem;
    
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
    
    showModal(elements.caseModal);
}

// Открытие кейса
async function openCase() {
    if (!currentCase || isOpening) return;
    
    if (userData.balance < currentCase.price) {
        alert('❌ Недостаточно алмазов!');
        return;
    }
    
    isOpening = true;
    
    // Списание средств
    userData.balance -= currentCase.price;
    elements.balance.textContent = userData.balance.toLocaleString();
    
    // Отключаем кнопку
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    // Генерируем предмет
    const wonItem = generateWonItem(currentCase);
    currentItem = wonItem;
    
    // Добавляем предмет в инвентарь
    inventoryData.unshift({
        ...wonItem,
        obtained_at: new Date().toISOString()
    });
    
    // Сохраняем данные
    saveUserDataToLocal();
    
    // Синхронизируем с сервером
    const syncSuccess = await syncWithServer();
    
    if (!syncSuccess) {
        console.log('Предупреждение: синхронизация с сервером не удалась');
    }
    
    // Показываем результат
    setTimeout(() => {
        showResult(wonItem);
        isOpening = false;
        
        // Восстанавливаем кнопку
        if (userData.balance >= currentCase.price) {
            elements.openCaseBtn.disabled = false;
            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
        } else {
            elements.openCaseBtn.disabled = true;
            elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
        }
    }, 1500);
}

// Генерация выигрышного предмета
function generateWonItem(caseItem) {
    const minecraftItems = {
        common: [
            { name: "Железный Слиток", icon: "⛓️", price: 50, description: "Базовый ресурс для крафта", rarity: "common" },
            { name: "Уголь", icon: "⚫", price: 30, description: "Топливо и краситель", rarity: "common" },
            { name: "Яблоко", icon: "🍎", price: 40, description: "Восстанавливает голод", rarity: "common" },
            { name: "Хлеб", icon: "🍞", price: 45, description: "Хорошая еда", rarity: "common" },
            { name: "Золотой Слиток", icon: "🟨", price: 80, description: "Редкий ресурс", rarity: "common" },
            { name: "Дубовые Доски", icon: "🪵", price: 20, description: "Строительный материал", rarity: "common" },
            { name: "Камень", icon: "🪨", price: 25, description: "Прочный блок", rarity: "common" },
            { name: "Палка", icon: "〰️", price: 10, description: "Для крафта инструментов", rarity: "common" }
        ],
        uncommon: [
            { name: "Алмаз", icon: "💎", price: 150, description: "Ценный минерал", rarity: "uncommon" },
            { name: "Изумруд", icon: "🟩", price: 200, description: "Торговая валюта", rarity: "uncommon" },
            { name: "Железная Кираса", icon: "🛡️", price: 180, description: "Защита от урона", rarity: "uncommon" },
            { name: "Алмазный Меч", icon: "⚔️", price: 250, description: "Мощное оружие", rarity: "uncommon" },
            { name: "Лук", icon: "🏹", price: 120, description: "Дальнобойное оружие", rarity: "uncommon" },
            { name: "Алмазная Кирка", icon: "⛏️", price: 220, description: "Быстрая добыча", rarity: "uncommon" },
            { name: "Золотое Яблоко", icon: "🍏", price: 160, description: "Мощное лечение", rarity: "uncommon" },
            { name: "Око Эндера", icon: "👁️", price: 300, description: "Для поиска крепости", rarity: "uncommon" }
        ],
        rare: [
            { name: "Незеритовый Слиток", icon: "🔱", price: 500, description: "Элитный материал", rarity: "rare" },
            { name: "Кирокрыло", icon: "🪶", price: 600, description: "Мгновенное перемещение", rarity: "rare" },
            { name: "Элитра", icon: "🧥", price: 800, description: "Полеты в мире", rarity: "rare" },
            { name: "Золотое Яблоко", icon: "🍏", price: 400, description: "Особое зелье", rarity: "rare" },
            { name: "Зачарованная Книга", icon: "📚", price: 350, description: "Мощные чары", rarity: "rare" },
            { name: "Плащ Невидимости", icon: "👻", price: 700, description: "Стать невидимым", rarity: "rare" },
            { name: "Бесконечный Лук", icon: "🏹", price: 450, description: "Не требует стрел", rarity: "rare" }
        ],
        epic: [
            { name: "Тотем Бессмертия", icon: "🐦", price: 1000, description: "Спасение от смерти", rarity: "epic" },
            { name: "Сердце Моря", icon: "💙", price: 1200, description: "Редкая реликвия", rarity: "epic" },
            { name: "Голова Дракона", icon: "🐲", price: 1500, description: "Трофей дракона", rarity: "epic" },
            { name: "Кристалл Энда", icon: "💎", price: 900, description: "Восстанавливает дракона", rarity: "epic" },
            { name: "Драконье Яйцо", icon: "🥚", price: 2000, description: "Уникальный трофей", rarity: "epic" },
            { name: "Зачарованный Золотой Меч", icon: "🗡️", price: 1100, description: "Легендарное оружие", rarity: "epic" }
        ],
        legendary: [
            { name: "Командный Блок", icon: "🟪", price: 5000, description: "Божественный предмет", rarity: "legendary" },
            { name: "Меч Незера", icon: "🗡️", price: 3000, description: "Легендарное оружие", rarity: "legendary" },
            { name: "Корона Власти", icon: "👑", price: 10000, description: "Знак абсолютной власти", rarity: "legendary" },
            { name: "Артефакт Создателя", icon: "⭐", price: 7500, description: "Сила творения", rarity: "legendary" },
            { name: "Сфера Бессмертия", icon: "🔮", price: 6000, description: "Вечная жизнь", rarity: "legendary" }
        ]
    };
    
    const totalWeight = Object.values(currentCase.rarityWeights).reduce((a, b) => a + b, 0);
    let randomWeight = Math.random() * totalWeight;
    
    let selectedRarity = 'common';
    for (const [rarity, weight] of Object.entries(currentCase.rarityWeights)) {
        randomWeight -= weight;
        if (randomWeight <= 0) {
            selectedRarity = rarity;
            break;
        }
    }
    
    const items = minecraftItems[selectedRarity] || minecraftItems.common;
    const randomItem = {...items[Math.floor(Math.random() * items.length)]};
    
    return randomItem;
}

// Отрисовка инвентаря
function renderInventory() {
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
        
        itemElement.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <h4>${item.name}</h4>
            <span class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</span>
            <p style="font-size: 0.8rem; color: var(--accent-diamond); margin-top: 5px;">
                💎 ${item.price}
            </p>
        `;
        
        elements.inventoryGrid.appendChild(itemElement);
    });
}

// Показ результата
function showResult(item) {
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price.toLocaleString();
    elements.resultItemIcon.textContent = item.icon;
    elements.newBalance.textContent = userData.balance.toLocaleString();
    
    hideModal(elements.caseModal);
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
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', () => {
            renderInventory();
            showModal(elements.inventoryModal);
        });
    }
    
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => hideModal(elements.caseModal));
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
    
    // Сохраняем данные при закрытии
    window.addEventListener('beforeunload', () => {
        if (isInitialized) {
            console.log('Сохранение данных перед закрытием...');
            saveUserDataToLocal();
            
            if (tg && userData.userId) {
                // Пытаемся синхронизировать перед закрытием
                const syncData = {
                    action: 'sync_user_data',
                    data: {
                        balance: userData.balance,
                        inventory: inventoryData,
                        userId: userData.userId,
                        username: userData.username
                    },
                    timestamp: Date.now()
                };
                
                try {
                    tg.sendData(JSON.stringify(syncData));
                } catch (error) {
                    console.error('Ошибка синхронизации при закрытии:', error);
                }
            }
        }
    });
}

// Обработка сообщений от Telegram
if (tg) {
    tg.onEvent('webAppDataReceived', (data) => {
        try {
            console.log('Получены данные от Telegram:', data);
            
            if (typeof data === 'string') {
                const parsedData = JSON.parse(data);
                
                if (parsedData.success && parsedData.user) {
                    // Обновляем баланс с сервера
                    userData.balance = parsedData.user.balance || userData.balance;
                    
                    // Обновляем инвентарь если он есть
                    if (parsedData.inventory && parsedData.inventory.length > 0) {
                        inventoryData = parsedData.inventory;
                    }
                    
                    // Сохраняем локально
                    saveUserDataToLocal();
                    
                    // Обновляем UI
                    updateUI();
                    
                    console.log('Данные обновлены с сервера');
                }
            }
        } catch (error) {
            console.error('Error parsing web app data:', error);
        }
    });
    
    tg.onEvent('closing', () => {
        console.log('Мини-приложение закрывается, сохраняем данные...');
        saveUserDataToLocal();
    });
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    initApp();
    initEventListeners();
    
    console.log('Приложение запущено');
});