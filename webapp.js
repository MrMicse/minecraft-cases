// webapp.js - УПРОЩЕННАЯ И НАДЕЖНАЯ ВЕРСИЯ
const SERVER_URL = 'http://localhost:3000'; // ИЛИ ваш реальный сервер
let tg = window.Telegram?.WebApp;
let userId = null;
let userData = {
    balance: 10000,
    firstName: 'Пользователь',
    lastSync: null,
    history: []
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// Инициализация
async function initApp() {
    console.log('🚀 WebApp инициализируется...');
    
    // Получаем ID пользователя
    userId = getUserId();
    console.log(`👤 User ID: ${userId}`);
    
    // Настраиваем Telegram WebApp
    if (tg) {
        setupTelegramApp();
    }
    
    // Загружаем начальные данные
    await loadInitialData();
    
    // Обновляем интерфейс
    updateUI();
    
    // Показываем статус
    showMessage('✅ WebApp готов к работе', true);
    
    console.log('🎉 WebApp успешно инициализирован');
}

// Получение ID пользователя
function getUserId() {
    // 1. Из Telegram
    if (tg?.initDataUnsafe?.user?.id) {
        const tgUser = tg.initDataUnsafe.user;
        userData.firstName = tgUser.first_name || 'Пользователь';
        return tgUser.id.toString();
    }
    
    // 2. Из URL
    const urlParams = new URLSearchParams(window.location.search);
    const tgId = urlParams.get('tg_id');
    
    if (tgId) {
        const name = urlParams.get('name');
        if (name) {
            userData.firstName = decodeURIComponent(name);
        }
        
        // Берем баланс из URL (самые актуальные данные из бота!)
        const urlBalance = urlParams.get('balance');
        if (urlBalance) {
            userData.balance = parseInt(urlBalance) || 10000;
            console.log(`💰 Баланс из URL: ${userData.balance}`);
        }
        
        return tgId;
    }
    
    // 3. Демо режим
    const demoId = 'demo_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('demo_user_id', demoId);
    return demoId;
}

// Настройка Telegram WebApp
function setupTelegramApp() {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.MainButton.setText('Закрыть').show();
    tg.MainButton.onClick(() => tg.close());
    
    // Настройка цветов
    tg.setHeaderColor('#667eea');
    tg.setBackgroundColor('#667eea');
}

// Загрузка начальных данных
async function loadInitialData() {
    showLoading(true);
    
    try {
        // Пробуем загрузить с сервера
        const serverData = await loadFromServer();
        
        if (serverData.success) {
            // Используем данные с сервера
            userData = serverData.user;
            console.log('✅ Данные загружены с сервера');
            showMessage('✅ Данные синхронизированы с сервером', true);
        } else {
            // Загружаем из localStorage
            loadFromLocalStorage();
            console.log('⚠️ Используем локальные данные');
            showMessage('⚠️ Сервер недоступен. Работаем в оффлайн режиме', false);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        loadFromLocalStorage();
        showMessage('⚠️ Ошибка загрузки данных', false);
    } finally {
        showLoading(false);
    }
}

// Загрузка с сервера
async function loadFromServer() {
    console.log(`🔄 Загрузка данных с сервера для userId: ${userId}`);
    
    try {
        // Сначала проверяем, доступен ли сервер
        const pingResponse = await fetch(`${SERVER_URL}/api/ping`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (!pingResponse.ok) {
            throw new Error('Сервер недоступен');
        }
        
        // Загружаем данные пользователя
        const response = await fetch(`${SERVER_URL}/api/user/${userId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.user) {
                return {
                    success: true,
                    user: {
                        balance: data.user.balance,
                        firstName: data.user.firstName || userData.firstName,
                        lastSync: data.user.lastSync,
                        history: data.user.history || []
                    }
                };
            }
        }
        
        return { success: false, error: 'User not found on server' };
    } catch (error) {
        console.log('❌ Ошибка соединения с сервером:', error.message);
        return { success: false, error: error.message };
    }
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(`user_${userId}`);
        if (saved) {
            const parsed = JSON.parse(saved);
            userData = {
                ...userData,
                ...parsed,
                balance: parsed.balance || userData.balance
            };
            console.log('📱 Данные загружены из localStorage');
        }
    } catch (e) {
        console.error('❌ Ошибка загрузки из localStorage:', e);
    }
}

// Сохранение в localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem(`user_${userId}`, JSON.stringify({
            balance: userData.balance,
            firstName: userData.firstName,
            lastSync: userData.lastSync,
            history: userData.history.slice(-50) // Сохраняем последние 50 операций
        }));
        console.log('💾 Данные сохранены в localStorage');
    } catch (e) {
        console.error('❌ Ошибка сохранения в localStorage:', e);
    }
}

// Изменение баланса
async function changeBalance(amount) {
    console.log(`🔄 Изменение баланса: ${amount}`);
    
    // Проверка на недостаток средств
    if (amount < 0 && userData.balance < Math.abs(amount)) {
        showMessage('❌ Недостаточно средств!', false);
        return;
    }
    
    const oldBalance = userData.balance;
    userData.balance += amount;
    
    // Добавляем в историю
    userData.history.push({
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        date: new Date().toISOString(),
        balanceBefore: oldBalance,
        balanceAfter: userData.balance,
        source: 'webapp'
    });
    
    // Сохраняем локально
    saveToLocalStorage();
    
    // Обновляем интерфейс
    updateUI();
    
    // Пытаемся синхронизировать с сервером
    const syncSuccess = await syncWithServer(amount, oldBalance);
    
    // Показываем сообщение
    const action = amount > 0 ? 'Пополнено' : 'Списано';
    if (syncSuccess) {
        showMessage(`✅ ${action} ${Math.abs(amount)} ₽. Баланс: ${userData.balance.toLocaleString('ru-RU')} ₽`, true);
    } else {
        showMessage(`⚠️ ${action} ${Math.abs(amount)} ₽ (только локально). Баланс: ${userData.balance.toLocaleString('ru-RU')} ₽`, false);
    }
    
    // Вибрация в Telegram
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Синхронизация с сервером
async function syncWithServer(amount, oldBalance) {
    console.log('🔄 Синхронизация с сервером...');
    
    try {
        const operation = {
            type: amount > 0 ? 'deposit' : 'withdraw',
            amount: Math.abs(amount),
            balanceBefore: oldBalance,
            balanceAfter: userData.balance
        };
        
        const response = await fetch(`${SERVER_URL}/api/user/${userId}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                balance: userData.balance,
                operation: operation
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Обновляем lastSync
                userData.lastSync = data.user.lastSync;
                console.log('✅ Успешная синхронизация с сервером');
                return true;
            }
        }
        
        console.log('❌ Ошибка синхронизации');
        return false;
    } catch (error) {
        console.log('❌ Ошибка соединения при синхронизации:', error.message);
        return false;
    }
}

// Кнопка синхронизации
async function syncButton() {
    showMessage('🔄 Проверка соединения с сервером...', true);
    
    try {
        const serverData = await loadFromServer();
        
        if (serverData.success) {
            // Обновляем данные с сервера
            userData.balance = serverData.user.balance;
            userData.lastSync = serverData.user.lastSync;
            
            updateUI();
            saveToLocalStorage();
            
            showMessage(`✅ Синхронизация успешна! Баланс: ${userData.balance.toLocaleString('ru-RU')} ₽`, true);
        } else {
            showMessage('❌ Сервер недоступен. Используем локальные данные', false);
        }
    } catch (error) {
        showMessage('❌ Ошибка синхронизации', false);
    }
}

// Кнопка сброса
function resetButton() {
    if (confirm(`Сбросить баланс к 10000 ₽?\nТекущий баланс: ${userData.balance.toLocaleString('ru-RU')} ₽`)) {
        const oldBalance = userData.balance;
        userData.balance = 10000;
        
        userData.history.push({
            type: 'reset',
            amount: Math.abs(10000 - oldBalance),
            date: new Date().toISOString(),
            balanceBefore: oldBalance,
            balanceAfter: 10000,
            source: 'webapp'
        });
        
        updateUI();
        saveToLocalStorage();
        
        // Пытаемся синхронизировать
        syncWithServer(10000 - oldBalance, oldBalance);
        
        showMessage('🔄 Баланс сброшен к 10000 ₽', true);
    }
}

// Обновление интерфейса
function updateUI() {
    // Баланс
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
        balanceEl.textContent = userData.balance.toLocaleString('ru-RU');
    }
    
    // Имя пользователя
    const usernameEl = document.getElementById('username');
    if (usernameEl) {
        usernameEl.textContent = userData.firstName;
    }
    
    // ID пользователя
    const useridEl = document.getElementById('userid');
    if (useridEl) {
        useridEl.textContent = userId;
    }
    
    // Счетчик операций
    const historyCountEl = document.getElementById('historyCount');
    if (historyCountEl) {
        historyCountEl.textContent = userData.history.length;
    }
    
    // История операций
    updateHistory();
}

// Обновление истории
function updateHistory() {
    const historyEl = document.getElementById('historyList');
    if (!historyEl) return;
    
    const recentHistory = userData.history
        .slice()
        .reverse()
        .slice(0, 5);
    
    if (recentHistory.length === 0) {
        historyEl.innerHTML = '<div class="empty-history">История операций пуста</div>';
        return;
    }
    
    historyEl.innerHTML = recentHistory.map(item => {
        const date = new Date(item.date);
        const time = date.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let typeIcon, typeClass, typeText;
        
        if (item.type === 'deposit') {
            typeIcon = '➕';
            typeClass = 'positive';
            typeText = 'Пополнение';
        } else if (item.type === 'withdraw') {
            typeIcon = '➖';
            typeClass = 'negative';
            typeText = 'Списание';
        } else {
            typeIcon = '🔄';
            typeClass = '';
            typeText = item.type;
        }
        
        return `
            <div class="history-item">
                <div>
                    <div class="history-time">${time} (${item.source || 'webapp'})</div>
                    <div class="history-type ${typeClass}">
                        ${typeIcon} ${typeText}: ${item.amount} ₽
                    </div>
                </div>
                <div class="history-balance">${item.balanceAfter.toLocaleString('ru-RU')} ₽</div>
            </div>
        `;
    }).join('');
}

// Показать сообщение
function showMessage(text, isSuccess) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = text;
    messageEl.className = `message ${isSuccess ? 'success' : 'error'}`;
    messageEl.style.display = 'block';
    
    setTimeout(() => {
        if (messageEl.textContent === text) {
            messageEl.style.display = 'none';
        }
    }, 3000);
}

// Показать/скрыть загрузку
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

// Экспорт функций для глобального использования
window.changeBalance = changeBalance;
window.syncButton = syncButton;
window.resetButton = resetButton;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initApp);

// Добавляем глобальную функцию для отладки
window.debugInfo = () => {
    console.log('=== DEBUG INFO ===');
    console.log('User ID:', userId);
    console.log('User Data:', userData);
    console.log('Server URL:', SERVER_URL);
    console.log('Telegram WebApp:', tg ? 'available' : 'not available');
    console.log('LocalStorage:', localStorage.getItem(`user_${userId}`));
    console.log('==================');
};