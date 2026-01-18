// Конфигурация
const SERVER_URL = 'http://localhost:3000'; // URL вашего сервера бота
let tg = null;
let userId = null;
let userData = null;
let currentBalance = 10000;
let history = [];

// Инициализация Telegram WebApp
async function initTelegramWebApp() {
    tg = window.Telegram.WebApp;
    
    if (!tg) {
        console.error('Telegram WebApp не доступен');
        showStatus('Ошибка: Запускайте через Telegram', false);
        initDemoMode();
        return;
    }
    
    // Расширяем на весь экран
    tg.expand();
    
    // Получаем данные пользователя из Telegram
    const user = tg.initDataUnsafe.user;
    userId = user?.id || getUserIdFromUrl();
    
    if (!userId) {
        initDemoMode();
        return;
    }
    
    // Сохраняем ID в localStorage для демо-режима
    localStorage.setItem('telegram_user_id', userId);
    
    // Загружаем данные пользователя
    await loadUserData();
    
    // Показываем кнопку "Закрыть"
    tg.MainButton.setText('Закрыть').show();
    tg.MainButton.onClick(() => {
        // Синхронизируем перед закрытием
        syncWithServer().then(() => tg.close());
    });
    
    // Добавляем кнопку "Профиль"
    tg.MainButton.setText('👤 Профиль').show();
}

// Демо-режим (без Telegram)
function initDemoMode() {
    userId = localStorage.getItem('telegram_user_id') || 
             `demo_${Math.floor(Math.random() * 1000000)}`;
    
    document.getElementById('username').textContent = 'Демо-пользователь';
    document.getElementById('userid').textContent = userId;
    
    // Загружаем данные
    loadUserData();
    
    showStatus('⚠️ Демо-режим (без Telegram)', false);
}

// Получение ID из URL
function getUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('user_id');
}

// Загрузка данных пользователя с сервера
async function loadUserData() {
    showLoading(true);
    
    try {
        // 1. Пробуем загрузить с сервера
        const response = await fetch(`${SERVER_URL}/api/user/${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            userData = data.user;
            currentBalance = userData.balance;
            history = userData.history || [];
            
            // Обновляем интерфейс
            updateUserDisplay();
            updateBalanceDisplay();
            updateHistoryDisplay();
            
            showStatus('✅ Данные загружены с сервера', true);
        } else {
            // 2. Если сервер недоступен, используем localStorage
            await loadFromLocalStorage();
            showStatus('⚠️ Используются локальные данные', false);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        await loadFromLocalStorage();
        showStatus('❌ Сервер недоступен', false);
    } finally {
        showLoading(false);
    }
}

// Загрузка из localStorage
async function loadFromLocalStorage() {
    const savedData = localStorage.getItem(`user_${userId}`);
    
    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            userData = parsed;
            currentBalance = parsed.balance || 10000;
            history = parsed.history || [];
        } catch (e) {
            // Ошибка парсинга
            userData = createDefaultUserData();
        }
    } else {
        userData = createDefaultUserData();
    }
    
    updateUserDisplay();
    updateBalanceDisplay();
    updateHistoryDisplay();
}

// Создание данных пользователя по умолчанию
function createDefaultUserData() {
    return {
        id: userId,
        firstName: 'Пользователь',
        balance: 10000,
        registrationDate: new Date().toISOString(),
        lastSync: null,
        history: []
    };
}

// Обновление отображения профиля
function updateUserDisplay() {
    document.getElementById('username').textContent = userData?.firstName || 'Пользователь';
    document.getElementById('userid').textContent = userId;
    
    // Обновляем дополнительную информацию если есть элемент
    const profileInfo = document.getElementById('profileInfo');
    if (profileInfo) {
        const lastSync = userData?.lastSync ? 
            new Date(userData.lastSync).toLocaleString('ru-RU') : 'никогда';
        
        profileInfo.innerHTML = `
            <div>🔄 Последняя синхронизация: ${lastSync}</div>
            <div>📊 Операций: ${history.length}</div>
        `;
    }
}

// Изменение баланса
async function changeBalance(amount) {
    if (amount < 0 && currentBalance < Math.abs(amount)) {
        showStatus('❌ Недостаточно средств', false);
        return;
    }
    
    const oldBalance = currentBalance;
    currentBalance += amount;
    
    // Создаем запись операции
    const operation = {
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        balanceBefore: oldBalance,
        balanceAfter: currentBalance,
        source: 'webapp'
    };
    
    // Добавляем в историю
    addToHistory(operation);
    
    // Сохраняем локально
    await saveToLocalStorage(operation);
    
    // Обновляем отображение
    updateBalanceDisplay();
    
    // Показываем статус
    const action = amount > 0 ? 'Пополнено' : 'Списано';
    showStatus(
        `${action} ${Math.abs(amount)} руб.\n` +
        `Новый баланс: ${currentBalance} руб.`,
        true
    );
    
    // Синхронизируем с сервером
    setTimeout(() => syncWithServer(operation), 500);
}

// Синхронизация с сервером
async function syncWithServer(operation = null) {
    showLoading(true);
    
    try {
        const syncData = {
            balance: currentBalance,
            history: history,
            operation: operation
        };
        
        const response = await fetch(`${SERVER_URL}/api/user/${userId}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(syncData)
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Обновляем данные с сервера
            if (data.success) {
                userData = data.user;
                currentBalance = data.user.balance;
                
                // Обновляем интерфейс
                updateUserDisplay();
                updateBalanceDisplay();
                
                // Вибрация в Telegram
                if (tg?.HapticFeedback) {
                    tg.HapticFeedback.impactOccurred('medium');
                }
                
                showStatus('✅ Синхронизировано с сервером!', true);
            }
        } else if (response.status === 409) {
            // Конфликт версий
            const errorData = await response.json();
            showStatus(`⚠️ Конфликт: ${errorData.error}`, false);
            
            // Предлагаем разрешить конфликт
            if (confirm(`Обнаружено расхождение!\n\n` +
                       `Ваш баланс: ${currentBalance}\n` +
                       `На сервере: ${errorData.serverBalance}\n\n` +
                       `Использовать серверный баланс?`)) {
                currentBalance = errorData.serverBalance;
                updateBalanceDisplay();
                await syncWithServer(); // Повторная синхронизация
            }
        } else {
            showStatus('⚠️ Ошибка синхронизации', false);
        }
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showStatus('❌ Сервер недоступен', false);
    } finally {
        showLoading(false);
    }
}

// Полная синхронизация (принудительная)
async function forceSync() {
    if (confirm('Выполнить принудительную синхронизацию?\nТекущие данные будут отправлены на сервер.')) {
        showLoading(true);
        
        try {
            const response = await fetch(`${SERVER_URL}/api/user/${userId}/full-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    balance: currentBalance,
                    history: history,
                    force: true
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    userData = data.user;
                    currentBalance = data.user.balance;
                    
                    updateUserDisplay();
                    updateBalanceDisplay();
                    showStatus('✅ Принудительная синхронизация выполнена', true);
                }
            }
        } catch (error) {
            console.error('Ошибка:', error);
            showStatus('❌ Ошибка синхронизации', false);
        } finally {
            showLoading(false);
        }
    }
}

// Сброс баланса
async function resetBalance() {
    if (confirm('Сбросить баланс к 10000 рублей?')) {
        const oldBalance = currentBalance;
        currentBalance = 10000;
        
        const operation = {
            type: 'reset',
            amount: 10000 - oldBalance,
            balanceBefore: oldBalance,
            balanceAfter: currentBalance,
            source: 'webapp'
        };
        
        addToHistory(operation);
        await saveToLocalStorage(operation);
        
        updateBalanceDisplay();
        showStatus('🔄 Баланс сброшен к 10000 руб.', true);
        
        // Синхронизируем
        await syncWithServer(operation);
    }
}

// Сохранение в localStorage
async function saveToLocalStorage(operation) {
    if (!userData) {
        userData = createDefaultUserData();
    }
    
    userData.balance = currentBalance;
    userData.lastSync = new Date().toISOString();
    
    if (operation) {
        operation.date = new Date().toISOString();
        userData.history = userData.history || [];
        userData.history.push(operation);
        history = userData.history;
    }
    
    localStorage.setItem(`user_${userId}`, JSON.stringify(userData));
}

// Добавление в историю
function addToHistory(operation) {
    const now = new Date();
    const historyItem = {
        ...operation,
        id: Date.now(),
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString(),
        timestamp: now.toISOString()
    };
    
    history.unshift(historyItem);
    
    // Ограничиваем историю
    if (history.length > 20) {
        history = history.slice(0, 20);
    }
    
    updateHistoryDisplay();
}

// Обновление отображения баланса
function updateBalanceDisplay() {
    document.getElementById('balance').textContent = currentBalance.toLocaleString('ru-RU');
}

// Обновление отображения истории
function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    history.slice(0, 10).forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        const typeIcon = item.type === 'deposit' ? '➕' : 
                        item.type === 'withdraw' ? '➖' : '🔄';
        const typeClass = item.type === 'deposit' ? 'positive' : 
                         item.type === 'withdraw' ? 'negative' : 'neutral';
        
        div.innerHTML = `
            <div>
                <div style="font-size: 14px; opacity: 0.8">${item.date} ${item.time}</div>
                <div class="${typeClass}">
                    ${typeIcon} ${item.type === 'deposit' ? '+' : ''}${item.amount} руб.
                </div>
            </div>
            <div style="text-align: right">
                <div style="font-weight: bold">${item.balanceAfter.toLocaleString('ru-RU')} руб.</div>
                <div style="font-size: 12px; opacity: 0.7">было: ${item.balanceBefore.toLocaleString('ru-RU')}</div>
            </div>
        `;
        
        historyList.appendChild(div);
    });
}

// Показать профиль
function showProfile() {
    const profileHtml = `
        <div class="profile-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000;">
            <div style="background: white; padding: 20px; border-radius: 15px; max-width: 400px; width: 90%; color: #333;">
                <h2 style="margin-bottom: 15px;">👤 Ваш профиль</h2>
                <div style="margin-bottom: 15px;">
                    <div><strong>ID:</strong> ${userId}</div>
                    <div><strong>Имя:</strong> ${userData?.firstName || 'Не указано'}</div>
                    <div><strong>Баланс:</strong> ${currentBalance.toLocaleString('ru-RU')} руб.</div>
                    <div><strong>Операций:</strong> ${history.length}</div>
                    <div><strong>Последняя синхронизация:</strong><br>${userData?.lastSync ? new Date(userData.lastSync).toLocaleString('ru-RU') : 'никогда'}</div>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button onclick="closeProfile()" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 8px;">Закрыть</button>
                    <button onclick="forceSync()" style="flex: 1; padding: 10px; background: #ff9800; color: white; border: none; border-radius: 8px;">🔄 Синхронизировать</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = profileHtml;
    document.body.appendChild(modal);
    
    window.closeProfile = function() {
        document.body.removeChild(modal);
    };
}

// Показать/скрыть загрузку
function showLoading(show) {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.display = show ? 'block' : 'none';
    }
}

// Показать статус
function showStatus(message, isSuccess) {
    const statusEl = document.getElementById('status');
    if (!statusEl) return;
    
    statusEl.textContent = message;
    statusEl.className = `sync-status ${isSuccess ? 'status-success' : 'status-error'}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    initTelegramWebApp();
    
    // Добавляем кнопку профиля
    const controls = document.querySelector('.controls');
    if (controls) {
        const profileBtn = document.createElement('button');
        profileBtn.className = 'btn btn-primary';
        profileBtn.innerHTML = '<span>👤</span> Профиль';
        profileBtn.onclick = showProfile;
        controls.appendChild(profileBtn);
    }
});