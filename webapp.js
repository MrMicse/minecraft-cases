// ========== КОНФИГУРАЦИЯ ==========
// Автоматическое определение URL сервера
function getServerUrl() {
    // Если в URL указан сервер
    const urlParams = new URLSearchParams(window.location.search);
    const customServer = urlParams.get('server');
    if (customServer) return customServer;
    
    // Если в window есть serverUrl (из бота)
    if (window.SERVER_URL) return window.SERVER_URL;
    
    // По умолчанию - текущий домен
    return window.location.origin.includes('localhost') ? 
        'http://localhost:3000' : 
        window.location.origin;
}

const SERVER_URL = getServerUrl();
let tg = window.Telegram?.WebApp;
let userId = null;
let userData = {
    balance: 10000,
    firstName: 'Гость',
    username: '',
    history: [],
    lastSync: null
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Инициализация приложения
async function initApp() {
    // Получаем ID пользователя
    userId = getUserId();
    
    // Приоритет: баланс из URL (самые актуальные данные из бота)
    await loadBalanceFromUrl();
    
    // Загружаем данные с сервера
    await loadUserData();
    
    // Обновляем интерфейс
    updateUI();
    
    // Автоматическая синхронизация при открытии
    await autoSync();
    
    // Настройка Telegram WebApp
    if (tg) {
        setupTelegramApp();
    }
    
    console.log(`📱 WebApp инициализирован. User ID: ${userId}, Баланс: ${userData.balance} ₽`);
}

// Настройка Telegram WebApp
function setupTelegramApp() {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.MainButton.setText('Закрыть').show();
    tg.MainButton.onClick(() => tg.close());
    
    // Устанавливаем цвет темы
    tg.setHeaderColor('#667eea');
    tg.setBackgroundColor('#667eea');
    
    // Обработка нажатия кнопки "Назад"
    tg.BackButton.onClick(() => {
        showMessage('🔄 Синхронизация перед выходом...', true);
        syncWithServer().then(() => {
            setTimeout(() => tg.close(), 500);
        });
    });
}

// Получение ID пользователя
function getUserId() {
    // 1. Из Telegram WebApp
    if (tg?.initDataUnsafe?.user?.id) {
        const tgUser = tg.initDataUnsafe.user;
        userData.firstName = tgUser.first_name || 'Пользователь';
        userData.username = tgUser.username || '';
        return tgUser.id.toString();
    }
    
    // 2. Из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    const tgId = urlParams.get('tg_id');
    const urlName = urlParams.get('name');
    
    if (urlName) {
        userData.firstName = decodeURIComponent(urlName);
    }
    
    if (tgId) return tgId;
    
    // 3. Из localStorage (демо режим)
    const savedId = localStorage.getItem('tg_user_id');
    if (savedId) return savedId;
    
    // 4. Создаем новый ID для демо
    const newId = 'demo_' + Date.now();
    localStorage.setItem('tg_user_id', newId);
    userData.firstName = 'Демо-пользователь';
    return newId;
}

// Загрузка баланса из URL (приоритетные данные из бота)
function loadBalanceFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const urlBalance = urlParams.get('balance');
    
    if (urlBalance) {
        const newBalance = parseInt(urlBalance);
        if (!isNaN(newBalance) && newBalance !== userData.balance) {
            console.log(`🔄 Используем баланс из URL: ${userData.balance} → ${newBalance} ₽`);
            userData.balance = newBalance;
            return true;
        }
    }
    return false;
}

// Автоматическая синхронизация при открытии
async function autoSync() {
    showMessage('🔄 Проверка обновлений...', true);
    
    // Сначала синхронизируем с сервером (чтобы получить последние данные)
    const success = await syncWithServer();
    
    if (success) {
        // Если в URL есть флаг принудительной синхронизации, игнорируем локальные данные
        const urlParams = new URLSearchParams(window.location.search);
        const forceSync = urlParams.get('force_sync') === 'true';
        
        if (forceSync) {
            console.log('🔄 Принудительная синхронизация из бота');
            await loadUserData(); // Загружаем свежие данные с сервера
        }
        
        showMessage('✅ Данные синхронизированы', true);
    } else {
        showMessage('⚠️ Используем локальные данные', false);
    }
    
    // Обновляем URL с актуальным балансом
    updateUrlWithBalance();
}

// Обновление URL с балансом
function updateUrlWithBalance() {
    if (history.replaceState && window.location.search.includes('tg_id=')) {
        const url = new URL(window.location);
        url.searchParams.set('balance', userData.balance);
        url.searchParams.set('last_sync', Date.now());
        history.replaceState(null, '', url.toString());
    }
}

// Загрузка данных пользователя
async function loadUserData() {
    showLoading(true);
    
    try {
        const response = await fetch(`${SERVER_URL}/api/user/${userId}?t=${Date.now()}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Сохраняем старые данные для сравнения
                const oldBalance = userData.balance;
                
                // Обновляем данные с сервера
                Object.assign(userData, data.user);
                
                // Логируем изменение баланса
                if (oldBalance !== userData.balance) {
                    console.log(`🔄 Баланс обновлен с сервера: ${oldBalance} → ${userData.balance} ₽`);
                }
                
                saveToLocalStorage();
                return true;
            }
        }
    } catch (error) {
        console.log('❌ Сервер недоступен:', error.message);
    } finally {
        showLoading(false);
    }
    
    // Если сервер недоступен, загружаем из localStorage
    loadFromLocalStorage();
    return false;
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem(`user_${userId}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            userData = {
                ...userData,
                ...parsed
            };
        } catch (e) {
            console.log('❌ Ошибка загрузки из localStorage:', e);
        }
    }
}

// Сохранение в localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem(`user_${userId}`, JSON.stringify({
            balance: userData.balance,
            firstName: userData.firstName,
            history: userData.history.slice(-20),
            lastSync: userData.lastSync
        }));
    } catch (e) {
        console.log('❌ Ошибка сохранения в localStorage:', e);
    }
}

// Изменение баланса
async function changeBalance(amount) {
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
    
    // Обновляем интерфейс
    updateUI();
    updateUrlWithBalance();
    
    // Сохраняем локально
    saveToLocalStorage();
    
    // Синхронизируем с сервером
    const success = await syncWithServer({
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        balanceBefore: oldBalance,
        balanceAfter: userData.balance
    });
    
    // Показываем сообщение
    const action = amount > 0 ? 'Пополнено' : 'Списано';
    const message = success ? 
        `${action} ${Math.abs(amount)} ₽. Баланс: ${userData.balance.toLocaleString('ru-RU')} ₽` :
        `${action} ${Math.abs(amount)} ₽ (только локально)`;
    
    showMessage(message, success);
    
    // Вибрация в Telegram
    if (success && tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// Синхронизация с сервером
async function syncWithServer(operation = null) {
    showLoading(true);
    
    try {
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
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем данные с сервера
            userData.balance = data.user.balance;
            userData.lastSync = data.user.lastSync;
            
            // Обновляем интерфейс
            updateUI();
            updateUrlWithBalance();
            saveToLocalStorage();
            
            console.log(`✅ Синхронизация успешна. Баланс: ${userData.balance} ₽`);
            return true;
        } else {
            showMessage(`❌ Ошибка: ${data.error || 'Неизвестная ошибка'}`, false);
            return false;
        }
    } catch (error) {
        console.log('❌ Ошибка синхронизации:', error.message);
        showMessage('⚠️ Сервер недоступен. Данные сохранены локально', false);
        return false;
    } finally {
        showLoading(false);
    }
}

// Обновление интерфейса
function updateUI() {
    // Обновляем баланс
    const balanceEl = document.getElementById('balance');
    if (balanceEl) {
        balanceEl.textContent = userData.balance.toLocaleString('ru-RU');
    }
    
    // Обновляем имя
    const usernameEl = document.getElementById('username');
    if (usernameEl) {
        usernameEl.textContent = userData.firstName || 'Пользователь';
    }
    
    // Обновляем ID
    const useridEl = document.getElementById('userid');
    if (useridEl) {
        useridEl.textContent = userId;
    }
    
    // Обновляем историю
    updateHistory();
    
    // Обновляем счетчик операций
    const historyCountEl = document.getElementById('historyCount');
    if (historyCountEl) {
        historyCountEl.textContent = userData.history.length;
    }
}

// Обновление истории операций
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
        
        switch (item.type) {
            case 'deposit':
                typeIcon = '➕';
                typeClass = 'positive';
                typeText = 'Пополнение';
                break;
            case 'withdraw':
                typeIcon = '➖';
                typeClass = 'negative';
                typeText = 'Списание';
                break;
            case 'reset':
                typeIcon = '🔄';
                typeClass = '';
                typeText = 'Сброс';
                break;
            default:
                typeIcon = '📝';
                typeClass = '';
                typeText = 'Операция';
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

// Показ сообщения
function showMessage(text, isSuccess) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;
    
    messageEl.textContent = text;
    messageEl.className = `message ${isSuccess ? 'success' : 'error'}`;
    messageEl.style.display = 'block';
    
    // Автоматическое скрытие
    setTimeout(() => {
        if (messageEl.textContent === text) {
            messageEl.style.display = 'none';
        }
    }, 4000);
}

// Показать/скрыть загрузку
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'flex' : 'none';
    }
}

// Кнопка синхронизации
async function syncButton() {
    showMessage('🔄 Синхронизация...', true);
    const success = await syncWithServer();
    
    if (success) {
        showMessage('✅ Синхронизация успешна!', true);
    } else {
        showMessage('⚠️ Синхронизация не удалась', false);
    }
}

// Кнопка сброса
async function resetButton() {
    if (confirm(`Сбросить баланс к 10000 ₽?\n\nТекущий баланс: ${userData.balance.toLocaleString('ru-RU')} ₽`)) {
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
        updateUrlWithBalance();
        saveToLocalStorage();
        
        const success = await syncWithServer({
            type: 'reset',
            amount: Math.abs(10000 - oldBalance),
            balanceBefore: oldBalance,
            balanceAfter: 10000
        });
        
        if (success) {
            showMessage('🔄 Баланс сброшен к 10000 ₽', true);
        } else {
            showMessage('⚠️ Баланс сброшен только локально', false);
        }
    }
}

// Проверка статуса сервера
async function checkServerStatus() {
    try {
        const response = await fetch(`${SERVER_URL}/api/status`);
        if (response.ok) {
            const data = await response.json();
            return data.status === 'running';
        }
    } catch (error) {
        return false;
    }
    return false;
}

// Тест синхронизации
async function testSynchronization() {
    console.log('🧪 Тест синхронизации начат...');
    
    // 1. Получаем текущий баланс
    const currentBalance = userData.balance;
    console.log(`Текущий баланс: ${currentBalance} ₽`);
    
    // 2. Пытаемся синхронизировать с сервером
    const syncSuccess = await syncWithServer();
    
    // 3. Проверяем результат
    if (syncSuccess) {
        console.log(`✅ Синхронизация успешна`);
        console.log(`Новый баланс: ${userData.balance} ₽`);
        
        if (currentBalance !== userData.balance) {
            console.log(`🔄 Баланс изменился: ${currentBalance} → ${userData.balance} ₽`);
        }
        
        return true;
    } else {
        console.log(`❌ Синхронизация не удалась`);
        return false;
    }
}

// Периодическая синхронизация (каждые 30 секунд)
setInterval(async () => {
    const isOnline = await checkServerStatus();
    if (isOnline) {
        await syncWithServer();
    }
}, 30000);

// Экспорт функции тестирования в глобальную область
window.testSync = testSynchronization;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp);

// Добавляем кнопку тестирования в интерфейс (для разработки)
document.addEventListener('DOMContentLoaded', () => {
    // Добавляем кнопку тестирования только в режиме разработки
    if (window.location.href.includes('localhost') || window.location.href.includes('127.0.0.1')) {
        const controlsDiv = document.querySelector('.controls');
        if (controlsDiv) {
            const testBtn = document.createElement('button');
            testBtn.className = 'btn';
            testBtn.innerHTML = '🧪 Тест синхронизации';
            testBtn.style.background = 'linear-gradient(135deg, #9C27B0, #7B1FA2)';
            testBtn.style.gridColumn = 'span 2';
            testBtn.onclick = testSynchronization;
            controlsDiv.appendChild(testBtn);
        }
    }
});

// Экспорт для тестирования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getUserId,
        changeBalance,
        syncWithServer,
        updateUI,
        testSynchronization
    };
}