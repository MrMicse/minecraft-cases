const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');

// Настройки
const TELEGRAM_TOKEN = os.getenv("BOT_TOKEN")
const PORT = process.env.PORT || 3000;

// Инициализация
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
app.use(express.json());

// Хранилище данных
const DATA_FILE = 'users.json';
let users = {};

// Загрузка данных
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            users = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            console.log(`📊 Загружено ${Object.keys(users).length} пользователей`);
        }
    } catch (e) {
        console.log('📁 Создаем новую базу данных');
        users = {};
    }
}

// Сохранение данных
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Ошибка сохранения:', e);
    }
}

// Инициализация пользователя
function initUser(userId, userInfo) {
    if (!users[userId]) {
        users[userId] = {
            id: userId,
            firstName: userInfo.first_name,
            username: userInfo.username,
            balance: 10000,
            createdAt: new Date().toISOString(),
            lastSync: null,
            history: [],
            webappUrl: `https://mrmicse.github.io/minecraft-cases/?tg_id=${userId}`
        };
        saveData();
        console.log(`👤 Новый пользователь: ${userId} (${userInfo.first_name})`);
    }
    return users[userId];
}

// Функция для форматирования профиля
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
           `▫️ /balance - текущий баланс\n` +
           `▫️ /sync - синхронизировать\n` +
           `▫️ /webapp - открыть мини-приложение`;
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '👤 Профиль' }, { text: '💰 Баланс' }],
                [{ text: '🔄 Синхронизация' }, { text: '📱 WebApp' }],
                [{ text: '➕ +100' }, { text: '➖ -100' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 *Привет, ${user.firstName}!*\n\n` +
        `Добро пожаловать в систему управления балансом!\n\n` +
        formatProfile(user),
        { 
            parse_mode: 'Markdown',
            ...keyboard 
        }
    );
});

// Команда /profile
bot.onText(/\/profile|👤 Профиль/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, formatProfile(user), { parse_mode: 'Markdown' });
});

// Команда /balance
bot.onText(/\/balance|💰 Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, 
        `💰 *Текущий баланс:* ${user.balance.toLocaleString('ru-RU')} ₽\n\n` +
        `💡 Используйте мини-приложение для управления`,
        { parse_mode: 'Markdown' }
    );
});

// Пополнение баланса
bot.onText(/➕ \+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = users[userId];
    
    if (user) {
        user.balance += 100;
        user.history.push({
            type: 'deposit',
            amount: 100,
            date: new Date().toISOString(),
            source: 'bot'
        });
        user.lastSync = new Date().toISOString();
        saveData();
        
        bot.sendMessage(chatId, 
            `✅ *+100 ₽*\n` +
            `Новый баланс: *${user.balance.toLocaleString('ru-RU')} ₽*`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Списание баланса
bot.onText(/➖ \-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = users[userId];
    
    if (user) {
        if (user.balance >= 100) {
            user.balance -= 100;
            user.history.push({
                type: 'withdraw',
                amount: 100,
                date: new Date().toISOString(),
                source: 'bot'
            });
            user.lastSync = new Date().toISOString();
            saveData();
            
            bot.sendMessage(chatId, 
                `✅ *-100 ₽*\n` +
                `Новый баланс: *${user.balance.toLocaleString('ru-RU')} ₽*`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, '❌ *Недостаточно средств!*', { parse_mode: 'Markdown' });
        }
    }
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
        `Время: ${new Date().toLocaleTimeString('ru-RU')}\n\n` +
        `Теперь данные актуальны в боте и WebApp`,
        { parse_mode: 'Markdown' }
    );
});

// Открытие WebApp
bot.onText(/\/webapp|📱 WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = initUser(userId, msg.from);
    
    bot.sendMessage(chatId, 
        '📱 *Откройте мини-приложение для полного управления балансом:*',
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
    
    // Обновляем баланс (проверяем конфликты)
    const oldBalance = user.balance;
    const difference = Math.abs(balance - oldBalance);
    
    if (difference > 1000) {
        // Большое расхождение
        return res.status(409).json({
            success: false,
            error: 'Большое расхождение в балансе',
            serverBalance: oldBalance,
            clientBalance: balance
        });
    }
    
    // Принимаем баланс от клиента
    user.balance = parseInt(balance);
    user.lastSync = new Date().toISOString();
    saveData();
    
    console.log(`🔄 Синхронизация: ${userId} - ${oldBalance} → ${user.balance}`);
    
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

// Запуск сервера
loadData();
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log(`👥 Пользователей: ${Object.keys(users).length}`);
    console.log(`\nAPI эндпоинты:`);
    console.log(`  GET  /api/user/:userId - данные пользователя`);
    console.log(`  POST /api/user/:userId/sync - синхронизация`);
    console.log(`  GET  /api/stats - статистика`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Bot error:', error.message);
});