require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// ========== КОНФИГУРАЦИЯ ==========
const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const WEBAPP_URL = process.env.WEBAPP_URL || 'https://mrmicse.github.io/minecraft-cases';
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

if (!TELEGRAM_TOKEN) {
    console.error('❌ Ошибка: BOT_TOKEN не установлен в .env файле');
    process.exit(1);
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
    polling: true,
    filepath: false
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== ХРАНИЛИЩЕ ДАННЫХ ==========
const DATA_FILE = 'users.json';
let users = {};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Загрузка данных
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            users = JSON.parse(data);
            console.log(`📊 Загружено ${Object.keys(users).length} пользователей`);
        } else {
            console.log('📁 Создаем новую базу данных');
            users = {};
            saveData();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error.message);
        users = {};
    }
}

// Сохранение данных
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error.message);
        return false;
    }
}

// Инициализация пользователя
function initUser(userId, userInfo) {
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            firstName: userInfo.first_name || 'Пользователь',
            username: userInfo.username || '',
            balance: 10000,
            createdAt: new Date().toISOString(),
            lastSync: null,
            history: [],
            webappUrl: `${WEBAPP_URL}/?tg_id=${userId}&balance=10000`
        };
        saveData();
        console.log(`👤 Новый пользователь: ${userId} (${users[userId].firstName})`);
    }
    
    // Обновляем URL с актуальным балансом
    users[userId].webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${users[userId].balance}`;
    
    return users[userId];
}

// Обновление URL WebApp
function updateWebAppUrl(userId) {
    if (users[userId]) {
        users[userId].webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&balance=${users[userId].balance}`;
    }
}

// Форматирование профиля
function formatProfile(user) {
    const regDate = new Date(user.createdAt).toLocaleDateString('ru-RU');
    const lastSync = user.lastSync ? 
        new Date(user.lastSync).toLocaleTimeString('ru-RU') : 'никогда';
    
    return `👤 *ВАШ ПРОФИЛЬ*\n\n` +
           `▫️ *Имя:* ${user.firstName}\n` +
           `▫️ *Баланс:* ${user.balance.toLocaleString('ru-RU')} ₽\n` +
           `▫️ *ID:* \`${user.id}\`\n` +
           `▫️ *Регистрация:* ${regDate}\n` +
           `▫️ *Синхронизация:* ${lastSync}\n` +
           `▫️ *Операций:* ${user.history.length}\n\n` +
           `💡 *Команды:*\n` +
           `▫️ /profile - ваш профиль\n` +
           `▫️ /balance - баланс\n` +
           `▫️ /sync - синхронизировать\n` +
           `▫️ /webapp - открыть мини-приложение\n` +
           `▫️ /sync_status - статус синхронизации`;
}

// Добавление операции в историю
function addHistory(userId, operation) {
    if (!users[userId]) return;
    
    const operationData = {
        ...operation,
        date: new Date().toISOString(),
        source: operation.source || 'bot'
    };
    
    users[userId].history.push(operationData);
    
    // Ограничиваем историю последними 50 операциями
    if (users[userId].history.length > 50) {
        users[userId].history = users[userId].history.slice(-50);
    }
    
    users[userId].lastSync = new Date().toISOString();
    updateWebAppUrl(userId);
    
    return saveData();
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
                [{ text: '👤 Профиль' }, { text: '💰 Баланс' }],
                [{ text: '🔄 Синхронизация' }, { text: '📱 WebApp' }],
                [{ text: '➕ +100' }, { text: '➖ -100' }],
                [{ text: '📊 Статус синхр.' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 *Привет, ${user.firstName}!*\n\n` +
        `Добро пожаловать в систему управления балансом!\n\n` +
        `*Баланс синхронизируется* между ботом и WebApp.\n` +
        `Изменения в одном месте сразу отображаются в другом.\n\n` +
        formatProfile(user),
        { 
            parse_mode: 'Markdown',
            ...keyboard 
        }
    );
});

// /profile
bot.onText(/\/profile|👤 Профиль/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, formatProfile(user), { parse_mode: 'Markdown' });
});

// /balance
bot.onText(/\/balance|💰 Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const lastOp = user.history.length > 0 ? 
        `\n📝 Последняя операция: ${new Date(user.history[user.history.length - 1].date).toLocaleTimeString('ru-RU')}` : '';
    
    bot.sendMessage(chatId, 
        `💰 *Текущий баланс:* ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `📱 *WebApp URL:* ${user.webappUrl}${lastOp}`,
        { parse_mode: 'Markdown' }
    );
});

// +100
bot.onText(/➕ \+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const oldBalance = user.balance;
    user.balance += 100;
    
    addHistory(userId, {
        type: 'deposit',
        amount: 100,
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        source: 'bot'
    });
    
    bot.sendMessage(chatId, 
        `✅ *+100 ₽ добавлено*\n` +
        `Старый баланс: ${oldBalance.toLocaleString('ru-RU')} ₽\n` +
        `Новый баланс: *${user.balance.toLocaleString('ru-RU')} ₽*\n\n` +
        `📱 WebApp обновлен автоматически`,
        { parse_mode: 'Markdown' }
    );
});

// -100
bot.onText(/➖ \-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    if (user.balance < 100) {
        bot.sendMessage(chatId, '❌ *Недостаточно средств!*', { parse_mode: 'Markdown' });
        return;
    }
    
    const oldBalance = user.balance;
    user.balance -= 100;
    
    addHistory(userId, {
        type: 'withdraw',
        amount: 100,
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        source: 'bot'
    });
    
    bot.sendMessage(chatId, 
        `✅ *-100 ₽ списано*\n` +
        `Старый баланс: ${oldBalance.toLocaleString('ru-RU')} ₽\n` +
        `Новый баланс: *${user.balance.toLocaleString('ru-RU')} ₽*\n\n` +
        `📱 WebApp обновлен автоматически`,
        { parse_mode: 'Markdown' }
    );
});

// Синхронизация
bot.onText(/\/sync|🔄 Синхронизация/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    user.lastSync = new Date().toISOString();
    saveData();
    
    bot.sendMessage(chatId, 
        `✅ *Синхронизация выполнена*\n\n` +
        `Баланс: *${user.balance.toLocaleString('ru-RU')} ₽*\n` +
        `Время: ${new Date().toLocaleTimeString('ru-RU')}\n` +
        `Операций: ${user.history.length}\n\n` +
        `📱 WebApp URL: ${user.webappUrl}`,
        { parse_mode: 'Markdown' }
    );
});

// Статус синхронизации
bot.onText(/\/sync_status|📊 Статус синхр\./, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const status = user.lastSync ? 
        `✅ Синхронизировано: ${new Date(user.lastSync).toLocaleString('ru-RU')}` :
        '⚠️ Требуется синхронизация';
    
    const lastOps = user.history.slice(-3).map(op => {
        const type = op.type === 'deposit' ? '➕' : (op.type === 'withdraw' ? '➖' : '🔄');
        return `${type} ${op.amount} ₽ (${new Date(op.date).toLocaleTimeString('ru-RU')})`;
    }).join('\n');
    
    bot.sendMessage(chatId, 
        `🔄 *СТАТУС СИНХРОНИЗАЦИИ*\n\n` +
        `${status}\n` +
        `Баланс: ${user.balance.toLocaleString('ru-RU')} ₽\n` +
        `Источник данных: ${user.history.length > 0 ? user.history[user.history.length - 1].source : 'нет данных'}\n\n` +
        `📝 *Последние операции:*\n${lastOps || 'Нет операций'}\n\n` +
        `🌐 *API статус:* ${SERVER_URL}/api/user/${userId}`,
        { parse_mode: 'Markdown' }
    );
});

// WebApp
bot.onText(/\/webapp|📱 WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    // Обновляем URL с актуальным балансом
    updateWebAppUrl(userId);
    
    bot.sendMessage(chatId, 
        `📱 *Мини-приложение*\n\n` +
        `Баланс в боте: *${user.balance.toLocaleString('ru-RU')} ₽*\n` +
        `Откройте WebApp для управления:`,
        {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🔓 Открыть WebApp',
                        web_app: { url: user.webappUrl }
                    }
                ], [
                    {
                        text: '🔄 Синхронизировать сейчас',
                        callback_data: 'sync_now'
                    }
                ]]
            }
        }
    );
});

// Обработка callback кнопок
bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const user = initUser(userId, callbackQuery.from);
    
    if (callbackQuery.data === 'sync_now') {
        user.lastSync = new Date().toISOString();
        saveData();
        
        bot.answerCallbackQuery(callbackQuery.id, {
            text: '✅ Баланс синхронизирован',
            show_alert: false
        });
        
        bot.editMessageText(
            `📱 *Мини-приложение*\n\n` +
            `Баланс: *${user.balance.toLocaleString('ru-RU')} ₽*\n` +
            `Синхронизировано: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
            `Откройте WebApp для управления:`,
            {
                chat_id: msg.chat.id,
                message_id: msg.message_id,
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
    }
});

// ========== API ДЛЯ СИНХРОНИЗАЦИИ ==========

// Получить данные пользователя
app.get('/api/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = users[userId];
    
    if (!user) {
        return res.status(200).json({
            success: false,
            error: 'User not found',
            message: 'Пользователь не найден'
        });
    }
    
    res.json({
        success: true,
        user: {
            id: user.id,
            firstName: user.firstName,
            username: user.username,
            balance: user.balance,
            lastSync: user.lastSync,
            createdAt: user.createdAt,
            history: user.history.slice(-10),
            webappUrl: user.webappUrl
        }
    });
});

// Синхронизировать данные из WebApp
app.post('/api/user/:userId/sync', (req, res) => {
    const userId = req.params.userId;
    const { balance, operation } = req.body;
    
    let user = users[userId];
    if (!user) {
        return res.status(200).json({
            success: false,
            error: 'User not found',
            message: 'Пользователь не найден'
        });
    }
    
    const oldBalance = user.balance;
    const newBalance = parseInt(balance);
    
    // Если есть операция - добавляем в историю
    if (operation && operation.type) {
        addHistory(userId, {
            type: operation.type,
            amount: Math.abs(operation.amount || 0),
            balanceBefore: operation.balanceBefore || oldBalance,
            balanceAfter: newBalance,
            source: 'webapp'
        });
    }
    
    // Обновляем баланс
    user.balance = newBalance;
    user.lastSync = new Date().toISOString();
    updateWebAppUrl(userId);
    saveData();
    
    console.log(`🔄 WebApp → Бот: ${userId} = ${oldBalance} → ${newBalance}`);
    
    // Отправляем уведомление в Telegram (если изменение больше 0)
    if (Math.abs(newBalance - oldBalance) > 0) {
        try {
            bot.sendMessage(userId,
                `📱 *WebApp обновил баланс*\n\n` +
                `Старый: ${oldBalance.toLocaleString('ru-RU')} ₽\n` +
                `Новый: ${newBalance.toLocaleString('ru-RU')} ₽\n` +
                `Разница: ${(newBalance - oldBalance) > 0 ? '+' : ''}${(newBalance - oldBalance).toLocaleString('ru-RU')} ₽\n\n` +
                `✅ Баланс синхронизирован`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log('Не удалось отправить уведомление:', error.message);
        }
    }
    
    res.json({
        success: true,
        message: 'Баланс синхронизирован',
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync
        },
        changes: {
            oldBalance: oldBalance,
            newBalance: newBalance,
            difference: newBalance - oldBalance
        }
    });
});

// Статистика
app.get('/api/stats', (req, res) => {
    const userCount = Object.keys(users).length;
    const totalBalance = Object.values(users).reduce((sum, user) => sum + user.balance, 0);
    const syncedUsers = Object.values(users).filter(u => u.lastSync).length;
    const recentUsers = Object.values(users)
        .filter(u => new Date(u.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .length;
    
    res.json({
        success: true,
        stats: {
            totalUsers: userCount,
            syncedUsers: syncedUsers,
            recentUsers: recentUsers,
            totalBalance: totalBalance,
            avgBalance: userCount > 0 ? Math.round(totalBalance / userCount) : 0,
            serverTime: new Date().toISOString(),
            serverUrl: SERVER_URL
        }
    });
});

// Статус сервера
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        server: 'Telegram Balance Bot',
        version: '1.0.0',
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        users: Object.keys(users).length,
        timestamp: new Date().toISOString()
    });
});

// Получить историю операций
app.get('/api/user/:userId/history', (req, res) => {
    const userId = req.params.userId;
    const user = users[userId];
    
    if (!user) {
        return res.status(200).json({
            success: false,
            error: 'User not found'
        });
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const history = user.history
        .slice()
        .reverse()
        .slice(offset, offset + limit);
    
    res.json({
        success: true,
        userId: userId,
        total: user.history.length,
        history: history,
        balance: user.balance
    });
});

// Сброс баланса (для тестирования)
app.post('/api/user/:userId/reset', (req, res) => {
    const userId = req.params.userId;
    const { balance = 10000 } = req.body;
    
    let user = users[userId];
    if (!user) {
        return res.status(200).json({
            success: false,
            error: 'User not found'
        });
    }
    
    const oldBalance = user.balance;
    user.balance = parseInt(balance);
    
    addHistory(userId, {
        type: 'reset',
        amount: Math.abs(user.balance - oldBalance),
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        source: 'api'
    });
    
    res.json({
        success: true,
        message: 'Баланс сброшен',
        user: {
            id: user.id,
            firstName: user.firstName,
            balance: user.balance,
            lastSync: user.lastSync
        }
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========

// Статическая страница для проверки
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Telegram Balance Bot</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                h1 { color: #333; }
                .status { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .endpoint { background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 5px; }
                code { background: #eee; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🤖 Telegram Balance Bot API</h1>
            <div class="status">
                <h2>✅ Сервер работает</h2>
                <p><strong>Пользователей:</strong> ${Object.keys(users).length}</p>
                <p><strong>URL сервера:</strong> ${SERVER_URL}</p>
                <p><strong>WebApp URL:</strong> ${WEBAPP_URL}</p>
            </div>
            
            <h2>📡 API Endpoints:</h2>
            <div class="endpoint">
                <code>GET /api/user/:userId</code> - данные пользователя
            </div>
            <div class="endpoint">
                <code>POST /api/user/:userId/sync</code> - синхронизация из WebApp
            </div>
            <div class="endpoint">
                <code>GET /api/stats</code> - статистика
            </div>
            <div class="endpoint">
                <code>GET /api/status</code> - статус сервера
            </div>
            
            <h2>🔗 Полезные ссылки:</h2>
            <ul>
                <li><a href="/api/stats" target="_blank">Статистика</a></li>
                <li><a href="${WEBAPP_URL}" target="_blank">WebApp</a></li>
            </ul>
            
            <p style="margin-top: 30px; color: #666;">
                Для синхронизации баланса используйте API выше. 
                Баланс автоматически синхронизируется между ботом и WebApp.
            </p>
        </body>
        </html>
    `);
});

// Запуск
loadData();
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 URL: ${SERVER_URL}`);
    console.log(`🤖 Бот токен: ${TELEGRAM_TOKEN ? '✅ Установлен' : '❌ Отсутствует'}`);
    console.log(`👥 Пользователей: ${Object.keys(users).length}`);
    console.log(`\n📡 API эндпоинты:`);
    console.log(`  GET  /api/user/:userId - данные пользователя`);
    console.log(`  POST /api/user/:userId/sync - синхронизация из WebApp`);
    console.log(`  GET  /api/stats - статистика`);
    console.log(`  GET  /api/status - статус сервера`);
    console.log(`\n🤖 Команды бота:`);
    console.log(`  /start - начать работу`);
    console.log(`  /balance - текущий баланс`);
    console.log(`  /sync - синхронизировать`);
    console.log(`  /webapp - открыть WebApp`);
    console.log(`  /sync_status - статус синхронизации`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
    if (error.code === 'EFATAL') {
        console.log('Перезапуск бота...');
        setTimeout(() => {
            bot.startPolling();
        }, 5000);
    }
});

process.on('SIGINT', () => {
    console.log('\n💾 Сохраняем данные перед выходом...');
    saveData();
    process.exit(0);
});