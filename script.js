// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
    console.log('Telegram Web App инициализирован');
    
    // Основная кнопка
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
let isSyncing = false;

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
    syncBtn: document.getElementById('sync-btn'),
    
    // Текстовые элементы
    caseName: document.getElementById('case-name'),
    casePriceValue: document.getElementById('case-price-value'),
    openPrice: document.getElementById('open-price'),
    resultItemName: document.getElementById('result-item-name'),
    resultItemRarity: document.getElementById('result-item-rarity'),
    resultItemPrice: document.getElementById('result-item-price'),
    resultItemIcon: document.getElementById('result-icon'),
    newBalance: document.getElementById('new-balance'),
    
    // Уведомления
    notificationArea: document.getElementById('notification-area')
};

// Minecraft предметы (демо)
const minecraftItems = {
    common: [
        { name: "Железный Слиток", icon: "⛓️", price: 50, description: "Базовый ресурс" },
        { name: "Уголь", icon: "⚫", price: 30, description: "Топливо" },
        { name: "Яблоко", icon: "🍎", price: 40, description: "Еда" },
        { name: "Хлеб", icon: "🍞", price: 45, description: "Хорошая еда" }
    ],
    uncommon: [
        { name: "Алмаз", icon: "💎", price: 150, description: "Ценный минерал" },
        { name: "Изумруд", icon: "🟩", price: 200, description: "Торговая валюта" },
        { name: "Железная Кираса", icon: "🛡️", price: 180, description: "Защита" }
    ],
    rare: [
        { name: "Незеритовый Слиток", icon: "🔱", price: 500, description: "Элитный материал" },
        { name: "Кирокрыло", icon: "🪶", price: 600, description: "Мгновенное перемещение" }
    ],
    epic: [
        { name: "Тотем Бессмертия", icon: "🐦", price: 1000, description: "Спасение от смерти" },
        { name: "Сердце Моря", icon: "💙", price: 1200, description: "Редкая реликвия" }
    ],
    legendary: [
        { name: "Командный Блок", icon: "🟪", price: 5000, description: "Божественный предмет" },
        { name: "Меч Незера", icon: "🗡️", price: 3000, description: "Легендарное оружие" }
    ]
};

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    try {
        // Загружаем из localStorage
        loadFromLocalStorage();
        
        // Синхронизируем с сервером
        await syncWithServer();
        
        // Обновляем UI
        updateUI();
        
        // Показываем уведомление
        showNotification('✅ Приложение загружено. Баланс синхронизирован с сервером.', 'success');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('⚠️ Ошибка загрузки. Используется локальная версия.', 'warning');
    }
    
    setTimeout(hideLoading, 500);
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('minecraftCaseData');
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            userData.balance = parsed.balance || 10000;
            userData.experience = parsed.experience || 0;
            userData.level = parsed.level || 1;
            inventoryData = parsed.inventory || [];
            console.log('Данные загружены из localStorage');
        } catch (e) {
            console.error('Ошибка загрузки из localStorage:', e);
            userData.balance = 10000;
        }
    } else {
        userData.balance = 10000;
        saveToLocalStorage();
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

// Синхронизация с сервером
async function syncWithServer() {
    if (isSyncing) return;
    isSyncing = true;
    
    console.log('Синхронизация с сервером...');
    showNotification('🔄 Синхронизация с сервером...', 'info');
    
    try {
        const response = await sendDataToBot('init', {});
        
        if (response && response.success) {
            // Обновляем данные с сервера
            if (response.user) {
                userData.balance = response.user.balance;
                userData.experience = response.user.experience;
                userData.level = response.user.level;
            }
            
            if (response.inventory) {
                inventoryData = response.inventory;
            }
            
            if (response.cases) {
                casesData = response.cases;
            }
            
            // Сохраняем локально
            saveToLocalStorage();
            
            console.log('✅ Данные синхронизированы');
            showNotification('✅ Данные синхронизированы с сервером', 'success');
            
            return response;
        } else {
            console.warn('Сервер не ответил, используем локальные данные');
            loadDemoData();
            return null;
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        loadDemoData();
        showNotification('⚠️ Ошибка синхронизации. Используются локальные данные.', 'warning');
        return null;
    } finally {
        isSyncing = false;
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
            description: 'Уникальные предметы',
            rarityWeights: { rare: 30, epic: 50, legendary: 20 }
        },
        {
            id: 5,
            name: '👑 Доступный Кейс',
            price: 5000,
            icon: '👑',
            description: 'Эксклюзивные донат предметы',
            rarityWeights: { epic: 40, legendary: 60 }
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
    
    if (userData.balance === 0) {
        userData.balance = 10000;
    }
}

// Отправка данных боту - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
async function sendDataToBot(action, data) {
    return new Promise((resolve) => {
        if (!tg) {
            console.log('Telegram Web App не доступен, используем демо-режим');
            resolve(handleDemoMode(action, data));
            return;
        }
        
        console.log(`📤 Отправка: ${action}`, data);
        
        const requestData = JSON.stringify({
            action: action,
            ...data,
            timestamp: Date.now()
        });
        
        let responseHandler = null;
        
        responseHandler = async (event) => {
            if (event.data && event.data.type === 'message') {
                try {
                    const message = event.data;
                    
                    if (message.text) {
                        const parsedData = JSON.parse(message.text);
                        
                        if (window._botResponseHandler === responseHandler) {
                            window.removeEventListener('message', responseHandler);
                            window._botResponseHandler = null;
                        }
                        
                        resolve(parsedData);
                    }
                } catch (e) {
                    console.error('Ошибка парсинга:', e);
                    
                    if (window._botResponseHandler === responseHandler) {
                        window.removeEventListener('message', responseHandler);
                        window._botResponseHandler = null;
                    }
                    
                    resolve(handleDemoMode(action, data));
                }
            }
        };
        
        window._botResponseHandler = responseHandler;
        window.addEventListener('message', responseHandler);
        
        // Отправляем данные
        tg.sendData(requestData);
        
        // Таймаут
        setTimeout(() => {
            if (window._botResponseHandler === responseHandler) {
                window.removeEventListener('message', responseHandler);
                window._botResponseHandler = null;
            }
            
            console.warn(`Таймаут запроса: ${action}`);
            resolve(handleDemoMode(action, data));
        }, 3000);
    });
}

// Демо-режим
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
            userData.balance -= caseItem.price;
            
            inventoryData.unshift({
                ...wonItem,
                id: Date.now(),
                obtained_at: new Date().toISOString()
            });
            
            saveToLocalStorage();
            
            return {
                success: true,
                item: wonItem,
                new_balance: userData.balance,
                experience_gained: caseItem.price / 10,
                user: {
                    balance: userData.balance,
                    experience: userData.experience,
                    level: userData.level
                },
                inventory: inventoryData
            };
            
        case 'sync_balance':
            const newBalance = data.balance;
            const oldBalance = userData.balance;
            
            if (newBalance !== undefined) {
                userData.balance = newBalance;
                saveToLocalStorage();
                
                return {
                    success: true,
                    user: {
                        balance: userData.balance,
                        experience: userData.experience,
                        level: userData.level
                    },
                    message: `Баланс обновлен: ${oldBalance} → ${newBalance}`
                };
            }
            
            return { success: false, error: 'Не указан баланс' };
            
        default:
            return { success: false, error: 'Действие не поддерживается' };
    }
}

// Синхронизация баланса с сервером
async function syncBalanceWithServer() {
    console.log(`Синхронизация баланса: ${userData.balance}`);
    
    try {
        const response = await sendDataToBot('sync_balance', {
            balance: userData.balance,
            old_balance: userData.balance,
            timestamp: Date.now()
        });
        
        if (response && response.success) {
            console.log('✅ Баланс синхронизирован с сервером');
            
            if (response.user) {
                userData.balance = response.user.balance;
                updateUI();
                saveToLocalStorage();
            }
            
            showNotification('✅ Баланс сохранен на сервере', 'success');
            return true;
        } else {
            console.warn('❌ Ошибка синхронизации баланса');
            showNotification('⚠️ Баланс сохранен только локально', 'warning');
            return false;
        }
    } catch (error) {
        console.error('Ошибка синхронизации баланса:', error);
        showNotification('⚠️ Ошибка синхронизации с сервером', 'error');
        return false;
    }
}

// Обновление UI
function updateUI() {
    if (elements.balance) {
        elements.balance.textContent = userData.balance.toLocaleString();
    }
    renderCases();
    renderInventory();
}

// Отрисовка кейсов
function renderCases() {
    if (!elements.casesGrid) return;
    
    elements.casesGrid.innerHTML = '';
    
    if (!casesData || casesData.length === 0) {
        loadDemoData();
    }
    
    casesData.forEach((caseItem, index) => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        caseCard.style.setProperty('--index', index);
        
        // Получаем предметы для превью
        const previewItems = getPreviewItems(caseItem);
        
        caseCard.innerHTML = `
            <div class="case-image">
                <div class="case-icon">${caseItem.icon}</div>
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
        
        // Обработчики
        let touchStartTime = 0;
        
        caseCard.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            e.preventDefault();
        }, { passive: false });
        
        caseCard.addEventListener('touchend', (e) => {
            if (Date.now() - touchStartTime < 500) {
                openCaseModal(caseItem);
            }
            e.preventDefault();
        }, { passive: false });
        
        caseCard.addEventListener('click', () => {
            if (Date.now() - touchStartTime > 100) {
                openCaseModal(caseItem);
            }
        });
        
        elements.casesGrid.appendChild(caseCard);
    });
}

// Получение предметов для превью
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
    if (!elements.inventoryGrid) return;
    
    elements.inventoryGrid.innerHTML = '';
    
    if (inventoryData.length === 0) {
        elements.inventoryGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🎒</div>
                <p style="color: var(--text-secondary); font-size: 1.1rem;">Инвентарь пуст</p>
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
            <div class="item-icon">${item.icon || '📦'}</div>
            <h4>${item.name}</h4>
            <span class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</span>
            <p style="font-size: 0.8rem; color: var(--accent-diamond); margin-top: 5px;">
                💎 ${item.price || 0}
            </p>
        `;
        
        itemElement.addEventListener('click', () => viewItem(item));
        elements.inventoryGrid.appendChild(itemElement);
    });
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
    randomItem.id = Date.now();
    
    return randomItem;
}

// Открытие кейса - ОСНОВНАЯ ФУНКЦИЯ С СИНХРОНИЗАЦИЕЙ
async function openCase() {
    console.log('Открытие кейса...');
    
    if (!currentCase || isOpening) {
        console.log('Не могу открыть кейс');
        return;
    }
    
    if (userData.balance < currentCase.price) {
        showNotification('❌ Недостаточно алмазов!', 'error');
        return;
    }
    
    // Сохраняем старый баланс
    const oldBalance = userData.balance;
    
    // Сразу обновляем баланс локально
    userData.balance -= currentCase.price;
    updateUI();
    
    // Отключаем кнопку
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    isOpening = true;
    
    try {
        // Простая анимация (без рулетки)
        await simpleAnimation();
        
        // Генерируем предмет
        const wonItem = generateWonItem(currentCase);
        currentItem = wonItem;
        
        // Добавляем в инвентарь
        inventoryData.unshift({
            ...wonItem,
            id: Date.now(),
            obtained_at: new Date().toISOString()
        });
        
        // Сохраняем локально
        saveToLocalStorage();
        
        // СИНХРОНИЗИРУЕМ С СЕРВЕРОМ
        const syncResult = await syncBalanceWithServer();
        
        // Показываем результат
        showResult(wonItem);
        
        // Обновляем UI
        updateUI();
        
        if (!syncResult) {
            // Показываем предупреждение если синхронизация не удалась
            setTimeout(() => {
                showNotification('⚠️ Изменения сохранены только локально', 'warning');
            }, 2000);
        }
        
    } catch (error) {
        console.error('Ошибка при открытии кейса:', error);
        
        // Откатываем изменения при ошибке
        userData.balance = oldBalance;
        updateUI();
        
        showNotification('❌ Ошибка при открытии кейса', 'error');
    } finally {
        // Восстанавливаем кнопку
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
        isOpening = false;
    }
}

// Простая анимация открытия
function simpleAnimation() {
    return new Promise((resolve) => {
        const modal = elements.caseModal;
        if (!modal) {
            resolve();
            return;
        }
        
        const caseImage = modal.querySelector('.case-image');
        if (caseImage) {
            caseImage.classList.add('opening');
            
            setTimeout(() => {
                caseImage.classList.remove('opening');
                caseImage.classList.add('opened');
                
                setTimeout(() => {
                    caseImage.classList.remove('opened');
                    resolve();
                }, 500);
            }, 1000);
        } else {
            setTimeout(resolve, 1000);
        }
    });
}

// Показать результат
function showResult(item) {
    console.log('Показ результата:', item);
    
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price.toLocaleString();
    elements.resultItemIcon.innerHTML = `<div class="item-icon-large">${item.icon}</div>`;
    elements.newBalance.textContent = userData.balance.toLocaleString();
    
    // Создаем эффект частиц
    createParticles();
    
    showModal(elements.resultModal);
}

// Создание частиц
function createParticles() {
    const particleContainer = document.querySelector('.particle-effect');
    if (!particleContainer) return;
    
    particleContainer.innerHTML = '';
    
    const colors = {
        common: '#4b69ff',
        uncommon: '#00d26a',
        rare: '#ffd700',
        epic: '#8847ff',
        legendary: '#ff0000'
    };
    
    const color = colors[currentItem.rarity] || '#4b69ff';
    
    for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        const size = 5 + Math.random() * 10;
        const angle = (i / 15) * Math.PI * 2;
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
    alert(`🎁 ${item.name}\n🎯 Редкость: ${getRarityText(item.rarity)}\n💎 Цена: ${item.price}\n📝 ${item.description || ''}`);
}

// Открытие модального окна кейса
function openCaseModal(caseItem) {
    console.log('Открытие модального окна кейса:', caseItem.name);
    currentCase = caseItem;
    
    elements.caseName.textContent = caseItem.name;
    elements.casePriceValue.textContent = caseItem.price;
    elements.openPrice.textContent = caseItem.price;
    
    // Проверяем баланс
    if (userData.balance < caseItem.price) {
        elements.openCaseBtn.disabled = true;
        elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
    } else {
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${caseItem.price} 💎`;
    }
    
    showModal(elements.caseModal);
}

// Открытие инвентаря
function openInventoryModal() {
    console.log('Открытие инвентаря');
    renderInventory();
    showModal(elements.inventoryModal);
}

// Синхронизация данных
async function syncData() {
    showNotification('🔄 Синхронизация с сервером...', 'info');
    
    const result = await syncWithServer();
    
    if (result) {
        updateUI();
        showNotification('✅ Данные синхронизированы!', 'success');
    } else {
        showNotification('⚠️ Используются локальные данные', 'warning');
    }
}

// Показать уведомление
function showNotification(message, type = 'info') {
    console.log(`Уведомление [${type}]: ${message}`);
    
    if (!elements.notificationArea) {
        // Создаем область уведомлений если её нет
        const notificationArea = document.createElement('div');
        notificationArea.id = 'notification-area';
        notificationArea.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 300px;
        `;
        document.body.appendChild(notificationArea);
        elements.notificationArea = notificationArea;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    elements.notificationArea.appendChild(notification);
    
    // Автоматическое удаление
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
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

// Инициализация обработчиков
function initEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    // Кнопка инвентаря
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', openInventoryModal);
    }
    
    // Кнопка синхронизации
    if (elements.syncBtn) {
        elements.syncBtn.addEventListener('click', syncData);
    }
    
    // Кнопки закрытия
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => hideModal(elements.caseModal));
    }
    
    if (elements.closeInventory) {
        elements.closeInventory.addEventListener('click', () => hideModal(elements.inventoryModal));
    }
    
    if (elements.closeResult) {
        elements.closeResult.addEventListener('click', () => hideModal(elements.resultModal));
    }
    
    // Кнопка открытия кейса
    if (elements.openCaseBtn) {
        elements.openCaseBtn.addEventListener('click', openCase);
    }
    
    // Закрытие по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay && !isOpening) {
                if (overlay === elements.caseModal) {
                    hideModal(elements.caseModal);
                } else if (overlay === elements.inventoryModal) {
                    hideModal(elements.inventoryModal);
                } else if (overlay === elements.resultModal) {
                    hideModal(elements.resultModal);
                }
            }
        });
    });
    
    // Синхронизация при видимости страницы
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Синхронизируем при возвращении на страницу
            setTimeout(syncData, 1000);
        }
    });
    
    // Синхронизация при загрузке
    window.addEventListener('load', () => {
        setTimeout(syncData, 2000);
    });
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем приложение...');
    
    // Инициализация
    initApp();
    
    // Обработчики
    initEventListeners();
    
    console.log('Приложение запущено');
});