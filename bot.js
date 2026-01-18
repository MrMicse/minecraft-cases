const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// Настройки
const TELEGRAM_TOKEN = os.getenv("BOT_TOKEN") // Замени на свой токен
const PORT = process.env.PORT || 3000;

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();

// Хранилище балансов пользователей (в реальном приложении - база данных)
const userBalances = new Map(); // user_id -> balance

// Начальный баланс
const DEFAULT_BALANCE = 10000;

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Инициализируем баланс пользователя
    if (!userBalances.has(userId)) {
        userBalances.set(userId, DEFAULT_BALANCE);
    }
    
    const balance = userBalances.get(userId);
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '💰 Мой баланс' }, { text: '➕ Пополнить' }],
                [{ text: '➖ Списать' }, { text: '🔄 Синхронизация' }],
                [{ text: '🔄 Проверить WebApp' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${msg.from.first_name}!\n\n` +
        `Это тест синхронизации баланса между ботом и мини-приложением.\n\n` +
        `Твой текущий баланс: *${balance} руб.*\n\n` +
        `Используй кнопки ниже или открой мини-приложение:`,
        { parse_mode: 'Markdown', ...keyboard }
    );
});

// Кнопка "Мой баланс"
bot.onText(/💰 Мой баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const balance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    bot.sendMessage(chatId, 
        `💰 *Твой баланс:* ${balance} руб.\n\n` +
        `💡 Для работы с балансом используй мини-приложение ниже ⬇️`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Пополнить"
bot.onText(/➕ Пополнить/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const balance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    userBalances.set(userId, balance + 100);
    
    bot.sendMessage(chatId, 
        `✅ Пополнено 100 руб.\n` +
        `Новый баланс: *${balance + 100} руб.*`,
        { parse_mode: 'Markdown' }
    );
});

// Кнопка "Списать"
bot.onText(/➖ Списать/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const balance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    if (balance >= 100) {
        userBalances.set(userId, balance - 100);
        bot.sendMessage(chatId, 
            `✅ Списано 100 руб.\n` +
            `Новый баланс: *${balance - 100} руб.*`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId, '❌ Недостаточно средств!');
    }
});

// Кнопка "Синхронизация"
bot.onText(/🔄 Синхронизация/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    // Имитация запроса к API
    const webAppBalance = await getWebAppBalance(userId);
    const botBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    if (webAppBalance === null) {
        bot.sendMessage(chatId, 
            '❌ Не удалось получить баланс из WebApp.\n' +
            'Запусти мини-приложение сначала!'
        );
        return;
    }
    
    if (webAppBalance === botBalance) {
        bot.sendMessage(chatId, 
            `✅ Балансы синхронизированы!\n` +
            `И в боте, и в WebApp: *${botBalance} руб.*`,
            { parse_mode: 'Markdown' }
        );
    } else {
        // Решаем конфликт - берем большее значение
        const newBalance = Math.max(webAppBalance, botBalance);
        userBalances.set(userId, newBalance);
        
        bot.sendMessage(chatId, 
            `🔄 Обнаружено расхождение!\n\n` +
            `В боте: *${botBalance} руб.*\n` +
            `В WebApp: *${webAppBalance} руб.*\n\n` +
            `✅ Установлен баланс: *${newBalance} руб.*`,
            { parse_mode: 'Markdown' }
        );
    }
});

// Кнопка "Проверить WebApp"
bot.onText(/🔄 Проверить WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const balance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    const webAppUrl = `https://yourdomain.com/index.html?user_id=${userId}&balance=${balance}`;
    
    bot.sendMessage(chatId, 
        '📱 Открой мини-приложение для работы с балансом:',
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🔓 Открыть WebApp',
                        web_app: { url: webAppUrl }
                    }
                ]]
            }
        }
    );
});

// API для получения баланса пользователя
app.get('/api/balance/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const balance = userBalances.get(userId) || DEFAULT_BALANCE;
    
    res.json({
        success: true,
        balance: balance,
        user_id: userId,
        source: 'bot_server'
    });
});

// API для обновления баланса
app.post('/api/balance/:userId', express.json(), (req, res) => {
    const userId = parseInt(req.params.userId);
    const newBalance = req.body.balance;
    
    if (typeof newBalance !== 'number' || newBalance < 0) {
        return res.status(400).json({
            success: false,
            error: 'Некорректный баланс'
        });
    }
    
    // Логируем изменение
    const oldBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    console.log(`[BOT] User ${userId}: ${oldBalance} -> ${newBalance}`);
    
    // Обновляем баланс
    userBalances.set(userId, newBalance);
    
    res.json({
        success: true,
        balance: newBalance,
        previous_balance: oldBalance,
        user_id: userId
    });
});

// Функция для получения баланса из WebApp (имитация)
async function getWebAppBalance(userId) {
    // В реальном приложении здесь был бы запрос к вашему серверу WebApp
    // Для теста возвращаем случайный баланс или null
    const shouldFail = Math.random() < 0.2; // 20% шанс на ошибку
    
    if (shouldFail) {
        return null;
    }
    
    // Имитируем возможное расхождение
    const botBalance = userBalances.get(userId) || DEFAULT_BALANCE;
    const difference = Math.random() < 0.3 ? 500 : 0; // 30% шанс на расхождение
    
    return botBalance + (Math.random() < 0.5 ? difference : -difference);
}

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер бота запущен на порту ${PORT}`);
    console.log(`👥 Зарегистрировано пользователей: ${userBalances.size}`);
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('Ошибка polling:', error);
});