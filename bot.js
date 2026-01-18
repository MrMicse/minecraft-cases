const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const os = require('os');
const fs = require('fs');

// Настройки
const TELEGRAM_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN_HERE";
const PORT = process.env.PORT || 3000;

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
app.use(express.json());

// Хранилище данных пользователей (в файле для сохранения между перезапусками)
const DATA_FILE = 'users_data.json';

// Загрузка данных из файла
let usersData = loadUsersData();

// Загрузка данных
function loadUsersData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            console.log(`Загружены данные ${Object.keys(parsed).length} пользователей`);
            return parsed;
        }
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
    return {};
}

// Сохранение данных
function saveUsersData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(usersData, null, 2));
        console.log(`Данные сохранены (${Object.keys(usersData).length} пользователей)`);
    } catch (error) {
        console.error('Ошибка сохранения данных:', error);
    }
}

// Инициализация пользователя
function initUser(userId, firstName) {
    if (!usersData[userId]) {
        usersData[userId] = {
            balance: 10000,
            firstName: firstName,
            registrationDate: new Date().toISOString(),
            lastSync: null,
            history: [],
            webappUrl: `https://mrmicse.github.io/minecraft-cases/?user_id=${userId}`
        };
        saveUsersData();
        console.log(`Создан новый пользователь: ${userId} (${firstName})`);
    }
    return usersData[userId];
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const firstName = msg.from.first_name;
    
    // Инициализируем пользователя
    const user = initUser(userId, firstName);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '👤 Мой профиль' }, { text: '💰 Баланс' }],
                [{ text: '➕ Пополнить +100' }, { text: '➖ Списать -100' }],
                [{ text: '🔄 Синхронизировать' }, { text: '📱 Открыть WebApp' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${firstName}!\n\n` +
        `✅ Ваш профиль создан!\n` +
        `💰 Баланс: *${user.balance} руб.*\n\n` +
        `Используй кнопки ниже для управления балансом:`,
        { parse_mode: 'Markdown', ...keyboard }
    );
});

// Кнопка "Мой профиль"
bot.onText(/👤 Мой профиль/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    const regDate = new Date(user.registrationDate).toLocaleDateString('ru-RU');
    const lastSync = user.lastSync ? new Date(user.lastSync).toLocaleString('ru-RU') : 'никогда';
    
    bot.sendMessage(chatId, 
        `👤 *Ваш профиль*\n\n` +
        `🆔 ID: \`${userId}\`\n` +
        `👤 Имя: ${user.firstName}\n` +
        `📅 Регистрация: ${regDate}\n` +
        `💰 Баланс: *${user.balance} руб.*\n` +
        `🔄 Последняя синхронизация: ${lastSync}\n\n` +
        `💡 Всего операций: ${user.history.length}`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Баланс"
bot.onText(/💰 Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    bot.sendMessage(chatId, 
        `💰 *Ваш баланс:* ${user.balance} руб.\n\n` +
        `💡 Для детальной работы с балансом используй мини-приложение`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Пополнить +100"
bot.onText(/➕ Пополнить \+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    user.balance += 100;
    user.history.push({
        type: 'deposit',
        amount: 100,
        date: new Date().toISOString(),
        source: 'bot',
        balanceBefore: user.balance - 100,
        balanceAfter: user.balance
    });
    saveUsersData();
    
    bot.sendMessage(chatId, 
        `✅ *Пополнено 100 руб.*\n` +
        `Новый баланс: *${user.balance} руб.*`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Списать -100"
bot.onText(/➖ Списать \-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    if (user.balance >= 100) {
        user.balance -= 100;
        user.history.push({
            type: 'withdraw',
            amount: 100,
            date: new Date().toISOString(),
            source: 'bot',
            balanceBefore: user.balance + 100,
            balanceAfter: user.balance
        });
        saveUsersData();
        
        bot.sendMessage(chatId, 
            `✅ *Списано 100 руб.*\n` +
            `Новый баланс: *${user.balance} руб.*`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId, '❌ *Недостаточно средств!*', { parse_mode: 'Markdown' });
    }
});

// Кнопка "Синхронизировать"
bot.onText(/🔄 Синхронизировать/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    // Обновляем время синхронизации
    user.lastSync = new Date().toISOString();
    saveUsersData();
    
    bot.sendMessage(chatId, 
        `✅ *Синхронизация выполнена!*\n\n` +
        `💰 Баланс: *${user.balance} руб.*\n` +
        `🕐 Время: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
        `Теперь баланс актуален в боте и в WebApp`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Открыть WebApp"
bot.onText(/📱 Открыть WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = usersData[userId] || initUser(userId, msg.from.first_name);
    
    bot.sendMessage(chatId, 
        '📱 *Открой мини-приложение для управления балансом:*',
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🔓 Открыть WebApp',
                        web_app: { url: user.webappUrl }
                    }
                ]]
            }
        }
    );
});

// ========== API для синхронизации с WebApp ==========

// Получение данных пользователя
app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = usersData[userId];
    
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'Пользователь не найден'
        });
    }
    
    res.json({
        success: true,
        user: {
            id: userId,
            firstName: user.firstName,
            balance: user.balance,
            registrationDate: user.registrationDate,
            lastSync: user.lastSync,
            history: user.history.slice(-10) // Последние 10 операций
        }
    });
});

// Обновление баланса
app.post('/api/user/:userId/sync', express.json(), (req, res) => {
    const userId = req.params.userId;
    const { balance, operation } = req.body;
    
    if (!usersData[userId]) {
        return res.status(404).json({
            success: false,
            error: 'Пользователь не найден'
        });
    }
    
    const user = usersData[userId];
    const oldBalance = user.balance;
    
    // Логирование операции
    if (operation) {
        user.history.push({
            ...operation,
            date: new Date().toISOString(),
            source: 'webapp',
            syncTime: new Date().toISOString()
        });
    }
    
    // Обновляем баланс
    user.balance = parseInt(balance);
    user.lastSync = new Date().toISOString();
    saveUsersData();
    
    console.log(`[SYNC] User ${userId}: ${oldBalance} -> ${user.balance} (via WebApp)`);
    
    res.json({
        success: true,
        user: {
            id: userId,
            firstName: user.firstName,
            balance: user.balance,
            previousBalance: oldBalance,
            lastSync: user.lastSync
        }
    });
});

// Полная синхронизация (конфликт-резолюция)
app.post('/api/user/:userId/full-sync', express.json(), (req, res) => {
    const userId = req.params.userId;
    const { balance, history, force } = req.body;
    
    let user = usersData[userId];
    if (!user) {
        // Создаем нового пользователя если не существует
        user = {
            balance: parseInt(balance) || 10000,
            firstName: 'WebApp User',
            registrationDate: new Date().toISOString(),
            lastSync: new Date().toISOString(),
            history: history || []
        };
        usersData[userId] = user;
    } else {
        // Решаем конфликт: если разница большая и не форс-синхронизация
        const difference = Math.abs(user.balance - balance);
        if (difference > 1000 && !force) {
            return res.status(409).json({
                success: false,
                error: 'Большое расхождение в балансе',
                serverBalance: user.balance,
                clientBalance: balance,
                requiresForce: true
            });
        }
        
        // Принимаем баланс от клиента, если он больше или если форс-синхронизация
        if (balance > user.balance || force) {
            user.balance = parseInt(balance);
        }
        
        // Объединяем историю
        if (history && Array.isArray(history)) {
            user.history = [...user.history, ...history]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 50); // Последние 50 операций
        }
        
        user.lastSync = new Date().toISOString();
    }
    
    saveUsersData();
    
    res.json({
        success: true,
        user: {
            id: userId,
            balance: user.balance,
            firstName: user.firstName,
            lastSync: user.lastSync
        }
    });
});

// Статистика сервера
app.get('/api/stats', (req, res) => {
    const userCount = Object.keys(usersData).length;
    const totalBalance = Object.values(usersData).reduce((sum, user) => sum + user.balance, 0);
    
    res.json({
        success: true,
        stats: {
            users: userCount,
            totalBalance: totalBalance,
            serverTime: new Date().toISOString(),
            uptime: process.uptime()
        }
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`👥 Пользователей в базе: ${Object.keys(usersData).length}`);
    console.log(`💾 Файл данных: ${DATA_FILE}`);
    console.log(`\nAPI эндпоинты:`);
    console.log(`  GET  http://localhost:${PORT}/api/user/:userId - данные пользователя`);
    console.log(`  POST http://localhost:${PORT}/api/user/:userId/sync - синхронизация`);
    console.log(`  POST http://localhost:${PORT}/api/user/:userId/full-sync - полная синхронизация`);
    console.log(`  GET  http://localhost:${PORT}/api/stats - статистика`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});

// Сохранение данных при выходе
process.on('SIGINT', () => {
    console.log('\nСохранение данных перед выходом...');
    saveUsersData();
    process.exit(0);
});