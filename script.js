// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
    console.log('✅ Telegram Web App инициализирован');
    
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

// DOM элементы
const elements = {
    balance: document.getElementById('user-balance'),
    casesGrid: document.getElementById('cases-grid'),
    inventoryGrid: document.getElementById('inventory-grid'),
    
    // Модальные окна
    inventoryModal: document.getElementById('inventory-modal'),
    loadingOverlay: document.getElementById('loading'),
    
    // Кнопки
    inventoryBtn: document.getElementById('inventory-btn'),
    closeInventory: document.getElementById('close-inventory'),
    
    // Тестовые элементы
    syncInfo: document.getElementById('sync-info'),
    localBalance: document.getElementById('local-balance'),
    serverBalance: document.getElementById('server-balance'),
    localCases: document.getElementById('local-cases'),
    serverCases: document.getElementById('server-cases'),
    tgStatus: document.getElementById('tg-status'),
    
    // Тестовые кнопки
    addBalanceBtn: document.getElementById('add-balance'),
    removeBalanceBtn: document.getElementById('remove-balance'),
    resetBalanceBtn: document.getElementById('reset-balance'),
    forceSyncBtn: document.getElementById('force-sync'),
    clearStorageBtn: document.getElementById('clear-storage'),
    simulateOpenBtn: document.getElementById('simulate-open')
};

// Флаг для отслеживания синхронизации
let lastSyncStatus = null;
let serverUserData = null;
let serverCasesData = [];

// Инициализация приложения
async function initApp() {
    console.log('🚀 Инициализация приложения...');
    showLoading();
    
    try {
        // Обновляем статус Telegram
        updateTelegramStatus();
        
        // Загружаем из localStorage
        loadFromLocalStorage();
        console.log('📁 Загружено из localStorage:', userData);
        
        // Пробуем синхронизацию с сервером
        await tryServerSync();
        
        // Обновляем UI
        updateUI();
        
        // Обновляем статус синхронизации
        updateSyncStatus();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showSyncStatus('error', `Ошибка: ${error.message}`);
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('✅ Приложение загружено!');
    }, 500);
}

// Обновление статуса Telegram
function updateTelegramStatus() {
    if (tg) {
        elements.tgStatus.textContent = '✅ Доступен';
        elements.tgStatus.style.color = '#00d26a';
    } else {
        elements.tgStatus.textContent = '❌ Не доступен';
        elements.tgStatus.style.color = '#ff4444';
    }
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
            casesData = parsed.cases || [];
            
            console.log('✅ Данные загружены из localStorage');
            console.log('- Баланс:', userData.balance);
            console.log('- Кейсы:', casesData.length);
            console.log('- Инвентарь:', inventoryData.length);
            
            // Обновляем отображение localStorage
            elements.localBalance.textContent = userData.balance;
            elements.localCases.textContent = casesData.length;
            
        } catch (e) {
            console.error('❌ Ошибка загрузки из localStorage:', e);
            resetToDefault();
        }
    } else {
        console.log('🆕 Первый запуск, устанавливаем значения по умолчанию');
        resetToDefault();
    }
}

// Сброс к значениям по умолчанию
function resetToDefault() {
    userData.balance = 10000;
    userData.experience = 0;
    userData.level = 1;
    inventoryData = [];
    casesData = [];
    
    elements.localBalance.textContent = userData.balance;
    elements.localCases.textContent = casesData.length;
}

// Сохранение в localStorage
function saveToLocalStorage() {
    const data = {
        balance: userData.balance,
        experience: userData.experience,
        level: userData.level,
        inventory: inventoryData,
        cases: casesData
    };
    localStorage.setItem('minecraftCaseData', JSON.stringify(data));
    console.log('💾 Данные сохранены в localStorage');
    
    // Обновляем отображение
    elements.localBalance.textContent = userData.balance;
    elements.localCases.textContent = casesData.length;
}

// Попытка синхронизации с сервером
async function tryServerSync() {
    console.log('🔄 Попытка синхронизации с сервером...');
    
    try {
        const response = await sendDataToBot('init', {});
        
        if (response && response.success) {
            console.log('✅ Синхронизация с сервером успешна');
            console.log('Данные с сервера:', response);
            
            // Сохраняем данные с сервера
            serverUserData = response.user;
            serverCasesData = response.cases || [];
            
            // Применяем данные с сервера (баланс - приоритет сервера)
            if (serverUserData) {
                userData.balance = serverUserData.balance;
                userData.experience = serverUserData.experience;
                userData.level = serverUserData.level;
            }
            
            // Кейсы берем с сервера если есть
            if (serverCasesData.length > 0) {
                casesData = serverCasesData;
                console.log(`✅ Загружено ${casesData.length} кейсов с сервера`);
            }
            
            // Инвентарь берем с сервера если есть
            if (response.inventory) {
                inventoryData = response.inventory;
            }
            
            // Сохраняем объединенные данные в localStorage
            saveToLocalStorage();
            
            // Обновляем отображение серверных данных
            if (serverUserData) {
                elements.serverBalance.textContent = serverUserData.balance;
            }
            elements.serverCases.textContent = serverCasesData.length;
            
            lastSyncStatus = 'success';
            return true;
            
        } else {
            console.warn('⚠️ Сервер ответил с ошибкой:', response?.error);
            lastSyncStatus = 'error';
            return false;
        }
        
    } catch (error) {
        console.error('❌ Ошибка соединения с сервером:', error);
        lastSyncStatus = 'error';
        return false;
    }
}

// Отправка данных боту через Web App
async function sendDataToBot(action, data) {
    return new Promise((resolve) => {
        if (!tg) {
            console.log('📡 Telegram Web App не доступен, используем демо-режим');
            resolve(handleDemoMode(action, data));
            return;
        }
        
        console.log(`📤 Отправка данных боту: ${action}`, data);
        
        // Подготавливаем данные для отправки
        const requestData = JSON.stringify({
            action: action,
            ...data,
            timestamp: Date.now()
        });
        
        // Глобальная переменная для хранения обработчика
        window._botResponseHandler = null;
        
        // Создаем обработчик для получения ответа от бота
        window._botResponseHandler = async (event) => {
            if (event.data && event.data.type === 'message') {
                try {
                    const message = event.data;
                    console.log('📥 Получено сообщение от бота:', message);
                    
                    if (message.text) {
                        try {
                            const parsedData = JSON.parse(message.text);
                            console.log('✅ Парсинг ответа от бота:', parsedData);
                            
                            // Удаляем обработчик
                            if (window._botResponseHandler) {
                                window.removeEventListener('message', window._botResponseHandler);
                                window._botResponseHandler = null;
                            }
                            resolve(parsedData);
                        } catch (e) {
                            console.error('❌ Ошибка парсинга JSON:', e);
                            resolve(handleDemoMode(action, data));
                        }
                    }
                } catch (e) {
                    console.error('❌ Ошибка обработки сообщения:', e);
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
            console.warn('⏱️ Таймаут запроса, используем демо-режим');
            if (window._botResponseHandler) {
                window.removeEventListener('message', window._botResponseHandler);
                window._botResponseHandler = null;
            }
            resolve(handleDemoMode(action, data));
        }, 3000);
    });
}

// Обработка действий в демо-режиме
function handleDemoMode(action, data) {
    console.log(`🦺 Демо-режим: ${action}`);
    
    switch (action) {
        case 'init':
            return {
                success: true,
                user: {
                    balance: 10000, // Всегда 10000 в демо-режиме
                    experience: 0,
                    level: 1
                },
                inventory: [],
                cases: [],
                config: {
                    min_bet: 10,
                    max_bet: 10000,
                    daily_bonus: 100,
                    version: '1.0.0'
                }
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

// Отрисовка кейсов
function renderCases() {
    console.log('🎨 Отрисовка кейсов...');
    if (!elements.casesGrid) return;
    
    elements.casesGrid.innerHTML = '';
    
    if (casesData.length === 0) {
        elements.casesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">📦</div>
                <p style="color: var(--text-secondary); font-size: 1.1rem; margin-bottom: 10px;">Кейсы временно недоступны</p>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 10px;">
                    Используйте тестовые кнопки для проверки баланса
                </p>
            </div>
        `;
        return;
    }
    
    // Здесь будет отрисовка кейсов, если они появятся
}

// Отрисовка инвентаря
function renderInventory() {
    console.log('🎨 Отрисовка инвентаря...');
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
        return;
    }
    
    // Здесь будет отрисовка инвентаря
}

// Обновление статуса синхронизации
function updateSyncStatus() {
    let statusText = '';
    let statusClass = '';
    
    if (lastSyncStatus === 'success') {
        statusText = '✅ Последняя синхронизация: Успешно';
        statusClass = 'sync-success';
    } else if (lastSyncStatus === 'error') {
        statusText = '❌ Последняя синхронизация: Ошибка';
        statusClass = 'sync-error';
    } else {
        statusText = '⏳ Синхронизация не выполнялась';
        statusClass = 'sync-none';
    }
    
    elements.syncInfo.innerHTML = `${statusText} <span class="sync-status ${statusClass}">${lastSyncStatus || 'none'}</span>`;
}

// Показ статуса синхронизации
function showSyncStatus(type, message) {
    let icon = '';
    let color = '';
    
    switch (type) {
        case 'success':
            icon = '✅';
            color = '#00d26a';
            break;
        case 'error':
            icon = '❌';
            color = '#ff4444';
            break;
        case 'warning':
            icon = '⚠️';
            color = '#ffd700';
            break;
        default:
            icon = 'ℹ️';
            color = '#4b69ff';
    }
    
    elements.syncInfo.innerHTML = `${icon} ${message}`;
    elements.syncInfo.style.color = color;
}

// Тестовые функции
function addBalance(amount = 1000) {
    userData.balance += amount;
    saveToLocalStorage();
    updateUI();
    console.log(`💰 Баланс увеличен на ${amount}. Новый баланс: ${userData.balance}`);
    showSyncStatus('success', `Баланс увеличен на ${amount} 💎`);
}

function removeBalance(amount = 1000) {
    if (userData.balance >= amount) {
        userData.balance -= amount;
        saveToLocalStorage();
        updateUI();
        console.log(`💰 Баланс уменьшен на ${amount}. Новый баланс: ${userData.balance}`);
        showSyncStatus('success', `Баланс уменьшен на ${amount} 💎`);
    } else {
        console.log('❌ Недостаточно средств');
        showSyncStatus('error', 'Недостаточно средств!');
    }
}

function resetBalance() {
    userData.balance = 10000;
    saveToLocalStorage();
    updateUI();
    console.log(`💰 Баланс сброшен до ${userData.balance}`);
    showSyncStatus('success', 'Баланс сброшен до 10000 💎');
}

async function forceSync() {
    showSyncStatus('warning', 'Синхронизация...');
    const success = await tryServerSync();
    
    if (success) {
        updateUI();
        showSyncStatus('success', 'Синхронизация успешна!');
    } else {
        showSyncStatus('error', 'Ошибка синхронизации');
    }
    
    updateSyncStatus();
}

function clearStorage() {
    localStorage.removeItem('minecraftCaseData');
    resetToDefault();
    updateUI();
    console.log('🗑️ localStorage очищен');
    showSyncStatus('warning', 'localStorage очищен');
}

function simulateOpenCase() {
    const casePrice = 500;
    if (userData.balance >= casePrice) {
        userData.balance -= casePrice;
        saveToLocalStorage();
        updateUI();
        
        // Добавляем случайный предмет в инвентарь
        const mockItems = [
            { name: "Алмаз", icon: "💎", price: 150, rarity: "uncommon" },
            { name: "Золотой Слиток", icon: "🟨", price: 80, rarity: "common" },
            { name: "Незеритовый Слиток", icon: "🔱", price: 500, rarity: "rare" }
        ];
        const randomItem = mockItems[Math.floor(Math.random() * mockItems.length)];
        
        inventoryData.unshift({
            ...randomItem,
            id: Date.now(),
            obtained_at: new Date().toISOString()
        });
        
        saveToLocalStorage();
        
        console.log(`🎁 Симулировано открытие кейса за ${casePrice}. Новый баланс: ${userData.balance}`);
        showSyncStatus('success', `Кейс открыт! Получен: ${randomItem.name}`);
    } else {
        console.log('❌ Недостаточно средств для симуляции');
        showSyncStatus('error', 'Недостаточно средств!');
    }
}

// Открытие модального окна инвентаря
function openInventoryModal() {
    console.log('📦 Открытие инвентаря');
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
    console.log('🎮 Настройка обработчиков событий...');
    
    // Основные кнопки
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', openInventoryModal);
    }
    
    if (elements.closeInventory) {
        elements.closeInventory.addEventListener('click', () => hideModal(elements.inventoryModal));
    }
    
    // Тестовые кнопки
    if (elements.addBalanceBtn) {
        elements.addBalanceBtn.addEventListener('click', () => addBalance(1000));
    }
    
    if (elements.removeBalanceBtn) {
        elements.removeBalanceBtn.addEventListener('click', () => removeBalance(1000));
    }
    
    if (elements.resetBalanceBtn) {
        elements.resetBalanceBtn.addEventListener('click', resetBalance);
    }
    
    if (elements.forceSyncBtn) {
        elements.forceSyncBtn.addEventListener('click', forceSync);
    }
    
    if (elements.clearStorageBtn) {
        elements.clearStorageBtn.addEventListener('click', clearStorage);
    }
    
    if (elements.simulateOpenBtn) {
        elements.simulateOpenBtn.addEventListener('click', simulateOpenCase);
    }
    
    // Закрытие модальных окон по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideModal(overlay);
            }
        });
    });
    
    console.log('✅ Все обработчики настроены');
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM загружен, запускаем приложение...');
    
    // Инициализация приложения
    initApp();
    
    // Настройка обработчиков событий
    initEventListeners();
    
    console.log('✅ Приложение запущено');
});