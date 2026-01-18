// Конфигурация
const BOT_API_URL = 'https://mrmicse.github.io/minecraft-cases/'; // Замени на URL твоего бота
let tg = null;
let userId = null;
let currentBalance = 10000;
let history = [];

// Инициализация Telegram WebApp
function initTelegramWebApp() {
    tg = window.Telegram.WebApp;
    
    if (!tg) {
        console.error('Telegram WebApp не доступен');
        showStatus('Ошибка: Запускайте через Telegram', false);
        return;
    }
    
    // Расширяем на весь экран
    tg.expand();
    
    // Получаем данные пользователя
    const user = tg.initDataUnsafe.user;
    userId = user?.id || getUserIdFromUrl();
    
    if (!userId) {
        userId = Math.floor(Math.random() * 1000000);
        showStatus('⚠️ Режим тестирования (случайный ID)', false);
    }
    
    // Обновляем интерфейс
    document.getElementById('username').textContent = user?.first_name || 'Тестовый пользователь';
    document.getElementById('userid').textContent = userId;
    
    // Загружаем баланс
    loadBalance();
    
    // Показываем кнопку "Закрыть" в Telegram
    tg.MainButton.setText('Закрыть WebApp').show();
    tg.MainButton.onClick(() => {
        tg.close();
    });
}

// Получение ID из URL
function getUserIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('user_id');
}

// Загрузка баланса с сервера бота
async function loadBalance() {
    showLoading(true);
    
    try {
        // В реальном приложении здесь был бы запрос к API бота
        // Для демо используем localStorage
        const savedBalance = localStorage.getItem(`balance_${userId}`);
        
        if (savedBalance) {
            currentBalance = parseInt(savedBalance);
        } else {
            currentBalance = 10000;
            localStorage.setItem(`balance_${userId}`, currentBalance);
        }
        
        updateBalanceDisplay();
        showStatus('✅ Баланс загружен', true);
        
    } catch (error) {
        console.error('Ошибка загрузки баланса:', error);
        showStatus('❌ Ошибка загрузки', false);
    } finally {
        showLoading(false);
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
    
    // Сохраняем локально
    localStorage.setItem(`balance_${userId}`, currentBalance);
    
    // Добавляем в историю
    addToHistory(amount, oldBalance, currentBalance);
    
    updateBalanceDisplay();
    
    showStatus(
        `${amount > 0 ? '➕ Пополнено' : '➖ Списано'} ${Math.abs(amount)} руб.\n` +
        `Новый баланс: ${currentBalance} руб.`,
        true
    );
    
    // Пытаемся синхронизировать с ботом
    setTimeout(syncWithBot, 1000);
}

// Синхронизация с ботом
async function syncWithBot() {
    showLoading(true);
    
    try {
        // Имитация запроса к API бота
        console.log(`[WebApp] Синхронизация для пользователя ${userId}, баланс: ${currentBalance}`);
        
        // В реальном приложении:
        // const response = await fetch(`${BOT_API_URL}/${userId}`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ balance: currentBalance })
        // });
        // const data = await response.json();
        
        // Для демо - имитируем ответ сервера
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const success = Math.random() > 0.2; // 80% успеха
        
        if (success) {
            showStatus('✅ Синхронизировано с ботом!', true);
            
            // Вибрация в Telegram
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('medium');
            }
        } else {
            showStatus('⚠️ Бот временно недоступен', false);
        }
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showStatus('❌ Ошибка сети', false);
    } finally {
        showLoading(false);
    }
}

// Сброс баланса
function resetBalance() {
    if (confirm('Сбросить баланс к 10000 рублей?')) {
        const oldBalance = currentBalance;
        currentBalance = 10000;
        
        localStorage.setItem(`balance_${userId}`, currentBalance);
        addToHistory(10000 - oldBalance, oldBalance, currentBalance);
        
        updateBalanceDisplay();
        showStatus('🔄 Баланс сброшен к 10000 руб.', true);
        
        // Синхронизируем
        setTimeout(syncWithBot, 1000);
    }
}

// Обновление отображения баланса
function updateBalanceDisplay() {
    document.getElementById('balance').textContent = currentBalance;
}

// Добавление в историю
function addToHistory(change, oldBalance, newBalance) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString();
    
    const historyItem = {
        id: Date.now(),
        time: `${date} ${time}`,
        change: change,
        oldBalance: oldBalance,
        newBalance: newBalance
    };
    
    history.unshift(historyItem); // Добавляем в начало
    
    // Ограничиваем историю 10 записями
    if (history.length > 10) {
        history = history.slice(0, 10);
    }
    
    updateHistoryDisplay();
}

// Обновление отображения истории
function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        
        div.innerHTML = `
            <div>
                <div>${item.time}</div>
                <div class="${item.change > 0 ? 'positive' : 'negative'}">
                    ${item.change > 0 ? '+' : ''}${item.change} руб.
                </div>
            </div>
            <div>
                <div>${item.newBalance} руб.</div>
                <div style="font-size: 12px; opacity: 0.7">
                    было: ${item.oldBalance}
                </div>
            </div>
        `;
        
        historyList.appendChild(div);
    });
}

// Показать/скрыть загрузку
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Показать статус
function showStatus(message, isSuccess) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `sync-status ${isSuccess ? 'status-success' : 'status-error'}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
        statusEl.style.display = 'none';
    }, 3000);
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initTelegramWebApp);