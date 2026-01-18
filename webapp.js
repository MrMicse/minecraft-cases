// Конфигурация
const SERVER_URL = 'http://localhost:3000';
let tg = window.Telegram?.WebApp;
let userId = null;
let userData = {
    balance: 10000,
    firstName: 'Гость',
    history: []
};

// Инициализация
async function initApp() {
    // Получаем ID пользователя
    userId = getUserId();
    
    // Загружаем данные
    await loadUserData();
    
    // Обновляем интерфейс
    updateUI();
    
    // Если это Telegram WebApp
    if (tg) {
        tg.expand();
        tg.MainButton.setText('Закрыть').show();
        tg.MainButton.onClick(() => tg.close());
    }
}

// Получение ID пользователя
function getUserId() {
    // 1. Из Telegram
    if (tg?.initDataUnsafe?.user?.id) {
        return tg.initDataUnsafe.user.id.toString();
    }
    
    // 2. Из URL
    const urlParams = new URLSearchParams(window.location.search);
    const tgId = urlParams.get('tg_id');
    if (tgId) return tgId;
    
    // 3. Из localStorage (демо режим)
    const savedId = localStorage.getItem('tg_user_id');
    if (savedId) return savedId;
    
    // 4. Создаем новый ID
    const newId = 'demo_' + Date.now();
    localStorage.setItem('tg_user_id', newId);
    return newId;
}

// Загрузка данных пользователя
async function loadUserData() {
    showLoading(true);
    
    try {
        // Пробуем загрузить с сервера
        const response = await fetch(`${SERVER_URL}/api/user/${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                userData = data.user;
                saveToLocalStorage();
            }
        } else {
            // Загружаем из localStorage
            loadFromLocalStorage();
        }
    } catch (error) {
        console.log('Сервер недоступен, используем локальные данные');
        loadFromLocalStorage();
    } finally {
        showLoading(false);
    }
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    const saved = localStorage.getItem(`user_${userId}`);
    if (saved) {
        try {
            userData = JSON.parse(saved);
        } catch (e) {
            userData = { balance: 10000, firstName: 'Пользователь', history: [] };
        }
    }
}

// Сохранение в localStorage
function saveToLocalStorage() {
    localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
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
        balanceAfter: userData.balance
    });
    
    // Обновляем интерфейс
    updateUI();
    
    // Сохраняем локально
    saveToLocalStorage();
    
    // Синхронизируем с сервером
    await syncWithServer({
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        balanceBefore: oldBalance,
        balanceAfter: userData.balance
    });
    
    // Показываем сообщение
    const action = amount > 0 ? 'Пополнено' : 'Списано';
    showMessage(`${action} ${Math.abs(amount)} ₽. Баланс: ${userData.balance} ₽`, true);
}

// Синхронизация с сервером
async function syncWithServer(operation = null) {
    try {
        const response = await fetch(`${SERVER_URL}/api/user/${userId}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                balance: userData.balance,
                operation: operation
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Обновляем данные с сервера
                userData.balance = data.user.balance;
                updateUI();
                
                // Вибрация в Telegram
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('light');
                }
                
                return true;
            }
        } else if (response.status === 409) {
            // Конфликт версий
            const errorData = await response.json();
            if (confirm(`Обнаружено расхождение!\n\nВаш баланс: ${userData.balance}\nНа сервере: ${errorData.serverBalance}\n\nИсправить?`)) {
                userData.balance = errorData.serverBalance;
                updateUI();
                saveToLocalStorage();
                showMessage('✅ Баланс исправлен по серверным данным', true);
            }
        }
    } catch (error) {
        console.log('Синхронизация не удалась');
    }
    
    return false;
}

// Обновление интерфейса
function updateUI() {
    // Обновляем баланс
    document.getElementById('balance').textContent = userData.balance.toLocaleString('ru-RU');
    
    // Обновляем имя
    document.getElementById('username').textContent = userData.firstName || 'Пользователь';
    document.getElementById('userid').textContent = userId;
    
    // Обновляем историю
    updateHistory();
}

// Обновление истории операций
function updateHistory() {
    const historyEl = document.getElementById('historyList');
    if (!historyEl) return;
    
    const recentHistory = userData.history.slice(-5).reverse();
    
    if (recentHistory.length === 0) {
        historyEl.innerHTML = '<div class="empty-history">История операций пуста</div>';
        return;
    }
    
    historyEl.innerHTML = recentHistory.map(item => {
        const date = new Date(item.date);
        const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const typeIcon = item.type === 'deposit' ? '➕' : '➖';
        const typeClass = item.type === 'deposit' ? 'positive' : 'negative';
        
        return `
            <div class="history-item">
                <div>
                    <div class="history-time">${time}</div>
                    <div class="history-type ${typeClass}">${typeIcon} ${item.amount} ₽</div>
                </div>
                <div class="history-balance">${item.balanceAfter} ₽</div>
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
    
    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 3000);
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
    showLoading(true);
    const success = await syncWithServer();
    showLoading(false);
    
    if (success) {
        showMessage('✅ Синхронизация успешна!', true);
    } else {
        showMessage('⚠️ Синхронизация не удалась', false);
    }
}

// Кнопка сброса
function resetButton() {
    if (confirm('Сбросить баланс к 10000 ₽?')) {
        const oldBalance = userData.balance;
        userData.balance = 10000;
        
        userData.history.push({
            type: 'reset',
            amount: 10000 - oldBalance,
            date: new Date().toISOString(),
            balanceBefore: oldBalance,
            balanceAfter: 10000
        });
        
        updateUI();
        saveToLocalStorage();
        syncWithServer();
        showMessage('🔄 Баланс сброшен к 10000 ₽', true);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', initApp);