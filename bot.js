const TelegramBot = require('node-telegram-bot-api');

const TOKEN = '6010244074:AAF703_o0k1nhFpA3_EhRixwpZgm6zRrITQ';
const WEBAPP_URL = 'https://mrmicse.github.io/minecraft-cases';

const bot = new TelegramBot(TOKEN, { polling: true });

// Храним балансы локально в памяти бота
let userBalances = {};

console.log('🤖 Бот запущен...');

// Получить баланс пользователя
function getUserBalance(userId) {
    if (!userBalances[userId]) {
        userBalances[userId] = 10000; // Начальный баланс
    }
    return userBalances[userId];
}

// Обновить баланс
function updateBalance(userId, amount) {
    const currentBalance = getUserBalance(userId);
    const newBalance = currentBalance + amount;
    
    if (newBalance < 0) {
        return { success: false, message: 'Недостаточно средств' };
    }
    
    userBalances[userId] = newBalance;
    console.log(`💰 ${userId}: ${currentBalance} → ${newBalance} (${amount > 0 ? '+' : ''}${amount})`);
    
    return { success: true, balance: newBalance };
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    const balance = getUserBalance(userId);
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${balance}&ts=${Date.now()}`;
    
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '💰 Баланс' }, { text: '📱 WebApp' }],
                [{ text: '+100' }, { text: '-100' }],
                [{ text: '🔄 Синхронизировать' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId,
        `👋 Привет, ${userName}!\n\n` +
        `💰 Твой баланс: ${balance.toLocaleString('ru-RU')} ₽\n\n` +
        `Используй кнопки для управления балансом.`,
        keyboard
    );
});

// Кнопка "💰 Баланс"
bot.onText(/💰 Баланс/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    const balance = getUserBalance(userId);
    
    bot.sendMessage(chatId,
        `💰 Твой баланс: ${balance.toLocaleString('ru-RU')} ₽\n\n` +
        `Чтобы изменить баланс:\n` +
        `• Нажми +100/-100 в боте\n` +
        `• Или открой WebApp`
    );
});

// Кнопка "+100"
bot.onText(/\+100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    const result = updateBalance(userId, 100);
    
    if (result.success) {
        const newBalance = result.balance;
        const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${newBalance}&ts=${Date.now()}`;
        
        bot.sendMessage(chatId,
            `✅ +100 ₽ начислено!\n\n` +
            `💰 Новый баланс: ${newBalance.toLocaleString('ru-RU')} ₽\n\n` +
            `Открой WebApp чтобы увидеть изменения:`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📱 Открыть WebApp',
                            web_app: { url: webappUrl }
                        }
                    ]]
                }
            }
        );
    } else {
        bot.sendMessage(chatId, `❌ ${result.message}`);
    }
});

// Кнопка "-100"
bot.onText(/\-100/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    const result = updateBalance(userId, -100);
    
    if (result.success) {
        const newBalance = result.balance;
        const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${newBalance}&ts=${Date.now()}`;
        
        bot.sendMessage(chatId,
            `✅ -100 ₽ списано!\n\n` +
            `💰 Новый баланс: ${newBalance.toLocaleString('ru-RU')} ₽\n\n` +
            `Открой WebApp чтобы увидеть изменения:`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        {
                            text: '📱 Открыть WebApp',
                            web_app: { url: webappUrl }
                        }
                    ]]
                }
            }
        );
    } else {
        bot.sendMessage(chatId, `❌ ${result.message}`);
    }
});

// Кнопка "🔄 Синхронизировать"
bot.onText(/🔄 Синхронизировать/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    const balance = getUserBalance(userId);
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${balance}&force=true&ts=${Date.now()}`;
    
    bot.sendMessage(chatId,
        `🔄 Создана ссылка для синхронизации!\n\n` +
        `💰 Текущий баланс: ${balance.toLocaleString('ru-RU')} ₽\n\n` +
        `Нажмите кнопку ниже чтобы открыть WebApp с актуальным балансом:`,
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

// Кнопка "📱 WebApp"
bot.onText(/📱 WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    const balance = getUserBalance(userId);
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${balance}&ts=${Date.now()}`;
    
    bot.sendMessage(chatId,
        `📱 Нажмите кнопку чтобы открыть мини-приложение:\n\n` +
        `💰 Текущий баланс: ${balance.toLocaleString('ru-RU')} ₽`,
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

// Команда для просмотра всех пользователей
bot.onText(/\/users/, (msg) => {
    const chatId = msg.chat.id;
    
    const usersList = Object.entries(userBalances)
        .map(([id, balance]) => `👤 ${id}: ${balance.toLocaleString('ru-RU')} ₽`)
        .join('\n');
    
    bot.sendMessage(chatId,
        `👥 Все пользователи (${Object.keys(userBalances).length}):\n\n${usersList || 'Нет пользователей'}`
    );
});

// Сохраняем данные при выходе
process.on('SIGINT', () => {
    console.log('💾 Сохранение данных...');
    // Здесь можно сохранить userBalances в файл
    process.exit(0);
});