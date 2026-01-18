// bot.js - ВЕРСИЯ С CORS И УЛУЧШЕННОЙ СИНХРОНИЗАЦИЕЙ
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const TELEGRAM_TOKEN = "6010244074:AAF703_o0k1nhFpA3_EhRixwpZgm6zRrITQ";
const PORT = 3000;
const WEBAPP_URL = 'https://mrmicse.github.io';
const WEBAPP_ORIGIN = 'https://mrmicse.github.io';

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true
});

const app = express();

// ========== НАСТРОЙКА CORS ==========
app.use(cors({
    origin: [WEBAPP_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

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
        console.log('✅ Данные сохранены');
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        return false;
    }
}

// Инициализация пользователя
function initUser(userId, userInfo) {
    const isNewUser = !users[userId];
    
    if (isNewUser) {
        users[userId] = {
            id: userId,
            firstName: userInfo.first_name || 'Пользователь',
            balance: 10000,
            createdAt: new Date().toISOString(),
            lastSync: new Date().toISOString(),
            history: [{
                type: 'initial',
                amount: 10000,
                date: new Date().toISOString(),
                source: 'system'
            }]
        };
        saveData();
        console.log(`👤 Новый пользователь: ${userId} (${users[userId].firstName})`);
    }
    
    // Всегда обновляем URL
    users[userId].webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${users[userId].balance}&name=${encodeURIComponent(users[userId].firstName)}&ts=${Date.now()}`;
    
    return users[userId];
}

// Функция для обновления баланса
function updateBalance(userId, amount, source = 'bot') {
    const user = users[userId];
    if (!user) return { success: false, message: 'User not found' };
    
    if (amount < 0 && user.balance < Math.abs(amount)) {
        return { success: false, message: 'Insufficient funds' };
    }
    
    const oldBalance = user.balance;
    user.balance += amount;
    
    user.history.push({
        type: amount > 0 ? 'deposit' : 'withdraw',
        amount: Math.abs(amount),
        date: new Date().toISOString(),
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        source: source
    });
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    console.log(`💰 ${source === 'bot' ? 'Бот' : 'WebApp'}: ${userId} - ${oldBalance} → ${user.balance} (${amount > 0 ? '+' : ''}${amount})`);
    
    return { success: true, newBalance: user.balance };
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
        `💰 Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `🆔 ID: ${user.id}\n` +
        `📅 Регистрация: ${new Date(user.createdAt).toLocaleDateString('ru-RU')}\n\n` +
        `Нажмите "WebApp" для открытия мини-приложения`,
        keyboard
    );
});

// Обработка кнопок +100/-100
bot.onText(/\+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const user = initUser(userId, msg.from);
    const result = updateBalance(userId, 100, 'bot');
    
    if (result.success) {
        bot.sendMessage(chatId, 
            `✅ +100 ₽\n` +
            `Новый баланс: ${result.newBalance.toLocaleString('ru-RU')} ₽\n\n` +
            `Откройте WebApp для просмотра`,
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
        bot.sendMessage(chatId, '❌ Ошибка обновления баланса');
    }
});

bot.onText(/\-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const user = initUser(userId, msg.from);
    const result = updateBalance(userId, -100, 'bot');
    
    if (result.success) {
        bot.sendMessage(chatId, 
            `✅ -100 ₽\n` +
            `Новый баланс: ${result.newBalance.toLocaleString('ru-RU')} ₽\n\n` +
            `Откройте WebApp для просмотра`,
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

// WebApp кнопка
bot.onText(/\/webapp|WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${user.balance}&name=${encodeURIComponent(user.firstName)}&ts=${Date.now()}`;
    
    bot.sendMessage(chatId, 
        `📱 Нажмите кнопку ниже для открытия мини-приложения:\n\n` +
        `💰 Баланс: ${user.balance.toLocaleString('ru-RU')} ₽`,
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

// Синхронизация
bot.onText(/\/sync|Синхронизация/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    bot.sendMessage(chatId, 
        `✅ Данные синхронизированы\n\n` +
        `💰 Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `🕐 Время: ${new Date().toLocaleTimeString('ru-RU')}`
    );
});

// Профиль
bot.onText(/\/profile|Профиль/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const lastSync = user.lastSync ? 
        new Date(user.lastSync).toLocaleTimeString('ru-RU') : 'никогда';
    
    bot.sendMessage(chatId, 
        `👤 ПРОФИЛЬ\n\n` +
        `▫️ Имя: ${user.firstName}\n` +
        `▫️ Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `▫️ ID: ${user.id}\n` +
        `▫️ Синхронизация: ${lastSync}\n` +
        `▫️ Операций: ${user.history.length}`
    );
});

// Баланс
bot.onText(/\/balance|Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, 
        `💰 Баланс: ${user.balance.toLocaleString('ru-RU')} ₽`
    );
});

// ========== API ДЛЯ WEBAPP ==========

// Проверка сервера
app.get('/api/ping', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        users: Object.keys(users).length
    });
});

// Получить данные пользователя
app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = users[userId];
    
    console.log(`📡 GET /api/user/${userId}`, user ? 'found' : 'not found');
    
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found',
            suggestion: 'Send /start in bot first'
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync,
            history: user.history.slice(-20),
            webappUrl: user.webappUrl
        }
    });
});

// Синхронизировать данные (WebApp → Server)
app.post('/api/user/:userId/sync', (req, res) => {
    const userId = req.params.userId;
    const { balance, operation } = req.body;
    
    console.log(`📡 POST /api/user/${userId}/sync`, { balance, operation });
    
    // Создаем пользователя, если не существует
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            firstName: 'WebApp User',
            balance: balance || 10000,
            createdAt: new Date().toISOString(),
            lastSync: new Date().toISOString(),
            history: []
        };
    }
    
    const user = users[userId];
    
    // Логируем операцию из WebApp
    if (operation) {
        user.history.push({
            ...operation,
            date: new Date().toISOString(),
            source: 'webapp'
        });
    }
    
    // Обновляем баланс из WebApp
    if (balance !== undefined && balance !== null) {
        const oldBalance = user.balance;
        user.balance = parseInt(balance);
        
        console.log(`🔄 Баланс обновлен: ${oldBalance} → ${user.balance}`);
    }
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    res.json({
        success: true,
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync
        },
        message: 'Data synchronized successfully'
    });
});

// Обновить баланс (Server → WebApp)
app.post('/api/user/:userId/update', (req, res) => {
    const userId = req.params.userId;
    const { amount } = req.body;
    
    console.log(`📡 POST /api/user/${userId}/update`, { amount });
    
    if (!users[userId]) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    
    const result = updateBalance(userId, parseInt(amount), 'api');
    
    if (result.success) {
        res.json({
            success: true,
            balance: result.newBalance,
            message: 'Balance updated'
        });
    } else {
        res.status(400).json({
            success: false,
            error: result.message
        });
    }
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
            serverTime: new Date().toISOString(),
            uptime: process.uptime()
        }
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========

loadData();

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`🌐 CORS разрешен для: ${WEBAPP_ORIGIN}`);
    console.log(`👥 Пользователей: ${Object.keys(users).length}`);
    console.log(`\n📡 API эндпоинты:`);
    console.log(`  GET  /api/ping - проверка сервера`);
    console.log(`  GET  /api/user/:userId - данные пользователя`);
    console.log(`  POST /api/user/:userId/sync - синхронизация из WebApp`);
    console.log(`  POST /api/user/:userId/update - обновить баланс`);
    console.log(`  GET  /api/stats - статистика`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Bot polling error:', error.message);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});