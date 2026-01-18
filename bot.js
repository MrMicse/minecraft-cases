// bot.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С СИНХРОНИЗАЦИЕЙ
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// ========== КОНФИГУРАЦИЯ ==========
const TELEGRAM_TOKEN = "6010244074:AAF703_o0k1nhFpA3_EhRixwpZgm6zRrITQ";
const PORT = 3000;
const WEBAPP_URL = 'https://mrmicse.github.io/minecraft-cases';

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true
});

const app = express();
app.use(express.json());

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
const DATA_FILE = 'users.json';
let users = {};

// Загрузка данных
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            users = JSON.parse(data);
            console.log(`Загружено ${Object.keys(users).length} пользователей`);
        }
    } catch (error) {
        console.log('Создаем новую базу данных');
        users = {};
    }
}

// Сохранение данных
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        return false;
    }
}

// Инициализация пользователя
function initUser(userId, userInfo) {
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            firstName: userInfo.first_name || 'Пользователь',
            balance: 10000,
            createdAt: new Date().toISOString(),
            lastSync: null,
            history: [],
            webappUrl: `${WEBAPP_URL}/?tg_id=${userId}&balance=10000&name=${encodeURIComponent(userInfo.first_name || 'Пользователь')}`
        };
        saveData();
        console.log(`Новый пользователь: ${userId} (${users[userId].firstName})`);
    }
    
    // Всегда обновляем URL с актуальным балансом
    users[userId].webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${users[userId].balance}&name=${encodeURIComponent(users[userId].firstName)}`;
    
    return users[userId];
}

// Функция для обновления баланса
function updateBalance(userId, amount) {
    const user = users[userId];
    if (!user) return false;
    
    if (amount < 0 && user.balance < Math.abs(amount)) {
        return false; // Недостаточно средств
    }
    
    const oldBalance = user.balance;
    user.balance += amount;
    
    user.history.push({
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        date: new Date().toISOString(),
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        source: 'bot'
    });
    
    user.lastSync = new Date().toISOString();
    user.webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${user.balance}&name=${encodeURIComponent(user.firstName)}`;
    
    saveData();
    return true;
}

// ========== КОМАНДЫ БОТА ==========

// /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: 'Профиль' }, { text: 'Баланс' }],
                [{ text: 'Синхронизация' }, { text: 'WebApp' }],
                [{ text: '+100' }, { text: '-100' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${user.firstName}!\n\n` +
        `Добро пожаловать в систему управления балансом!\n\n` +
        `💰 Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `🆔 ID: ${user.id}\n` +
        `📅 Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}\n\n` +
        `Команды:\n` +
        `/profile - ваш профиль\n` +
        `/balance - текущий баланс\n` +
        `/sync - синхронизировать\n` +
        `/webapp - открыть мини-приложение`,
        keyboard
    );
});

// /profile
bot.onText(/\/profile|Профиль/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const lastSync = user.lastSync ? 
        new Date(user.lastSync).toLocaleTimeString('ru-RU') : 'никогда';
    
    bot.sendMessage(chatId, 
        `👤 ВАШ ПРОФИЛЬ\n\n` +
        `▫️ Имя: ${user.firstName}\n` +
        `▫️ Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `▫️ ID: ${user.id}\n` +
        `▫️ Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}\n` +
        `▫️ Синхронизация: ${lastSync}\n` +
        `▫️ Операций: ${user.history.length}\n\n` +
        `💡 Команды:\n` +
        `▫️ /profile - ваш профиль\n` +
        `▫️ /balance - текущий баланс\n` +
        `▫️ /sync - синхронизировать\n` +
        `▫️ /webapp - открыть мини-приложение`
    );
});

// /balance
bot.onText(/\/balance|Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, 
        `💰 Текущий баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n\n` +
        `💡 Используйте мини-приложение для управления`
    );
});

// +100
bot.onText(/\+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Обязательно инициализируем пользователя
    const user = initUser(userId, msg.from);
    
    if (updateBalance(userId, 100)) {
        bot.sendMessage(chatId, 
            `✅ +100 ₽\n` +
            `Новый баланс: ${user.balance.toLocaleString('ru-RU')} ₽`
        );
        
        // Отправляем уведомление о синхронизации
        bot.sendMessage(chatId,
            `🔄 Баланс обновлен в системе\n` +
            `WebApp получит актуальные данные при следующем открытии`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📱 Открыть WebApp',
                            web_app: { url: user.webappUrl }
                        }
                    ]]
                }
            }
        );
    } else {
        bot.sendMessage(chatId, '❌ Ошибка обновления баланса!');
    }
});

// -100
bot.onText(/\-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Обязательно инициализируем пользователя
    const user = initUser(userId, msg.from);
    
    if (updateBalance(userId, -100)) {
        bot.sendMessage(chatId, 
            `✅ -100 ₽\n` +
            `Новый баланс: ${user.balance.toLocaleString('ru-RU')} ₽`
        );
        
        // Отправляем уведомление о синхронизации
        bot.sendMessage(chatId,
            `🔄 Баланс обновлен в системе\n` +
            `WebApp получит актуальные данные при следующем открытии`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📱 Открыть WebApp',
                            web_app: { url: user.webappUrl }
                        }
                    ]]
                }
            }
        );
    } else {
        bot.sendMessage(chatId, '❌ Недостаточно средств!');
    }
});

// Синхронизация
bot.onText(/\/sync|Синхронизация/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    // Отправляем обновленный URL
    const updatedUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${user.balance}&name=${encodeURIComponent(user.firstName)}&force_sync=true&ts=${Date.now()}`;
    
    bot.sendMessage(chatId, 
        `✅ Синхронизация выполнена\n\n` +
        `Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `Время: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
        `WebApp получит актуальные данные при следующем открытии`,
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '📱 Открыть WebApp с актуальными данными',
                        web_app: { url: updatedUrl }
                    }
                ]]
            }
        }
    );
});

// Открытие WebApp
bot.onText(/\/webapp|WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    // Добавляем timestamp для предотвращения кэширования
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${user.balance}&name=${encodeURIComponent(user.firstName)}&force_sync=true&ts=${Date.now()}`;
    
    bot.sendMessage(chatId, 
        `📱 Откройте мини-приложение для полного управления балансом:\n\n` +
        `💰 Текущий баланс: ${user.balance.toLocaleString('ru-RU')} ₽`,
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🔓 Открыть WebApp',
                        web_app: { url: webappUrl }
                    }
                ]]
            }
        }
    );
});

// ========== API ДЛЯ СИНХРОНИЗАЦИИ ==========

// Получить данные пользователя
app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = users[userId];
    
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync,
            history: user.history.slice(-10)
        }
    });
});

// Синхронизировать данные
app.post('/api/user/:userId/sync', (req, res) => {
    const userId = req.params.userId;
    const { balance, operation } = req.body;
    
    let user = users[userId];
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    
    // Логируем операцию
    if (operation) {
        user.history.push({
            ...operation,
            date: new Date().toISOString(),
            source: 'webapp'
        });
    }
    
    // Обновляем баланс (если передан баланс, используем его)
    if (balance !== undefined) {
        user.balance = parseInt(balance);
    }
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    console.log(`Синхронизация: ${userId} - ${user.balance} ₽`);
    
    res.json({
        success: true,
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync
        }
    });
});

// Статистика
app.get('/api/stats', (req, res) => {
    const userCount = Object.keys(users).length;
    const totalBalance = Object.values(users).reduce((sum, user) => sum + user.balance, 0);
    
    res.json({
        success: true,
        stats: {
            totalUsers: userCount,
            totalBalance: totalBalance,
            serverTime: new Date().toISOString()
        }
    });
});

// Проверка статуса сервера
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        users: Object.keys(users).length,
        timestamp: new Date().toISOString()
    });
});

// Запуск сервера
loadData();
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`👥 Пользователей: ${Object.keys(users).length}`);
    console.log(`\nAPI эндпоинты:`);
    console.log(`  GET  /api/user/:userId - данные пользователя`);
    console.log(`  POST /api/user/:userId/sync - синхронизация`);
    console.log(`  GET  /api/stats - статистика`);
    console.log(`  GET  /api/status - статус сервера`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Bot error:', error.message);
});

// Обработка входящих сообщений
bot.on('message', (msg) => {
    // Логирование всех входящих сообщений
    console.log(`📩 Сообщение от ${msg.from.id}: ${msg.text}`);
});