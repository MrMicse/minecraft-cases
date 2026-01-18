const TelegramBot = require('node-telegram-bot-api');

// Токен бота
const TOKEN = '6010244074:AAF703_o0k1nhFpA3_EhRixwpZgm6zRrITQ';
const WEBAPP_URL = 'https://mrmicse.github.io/minecraft-cases';

// Создаем бота
const bot = new TelegramBot(TOKEN, { polling: true });

console.log('🤖 Бот запущен...');

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    // Ссылка на WebApp с параметрами
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&ts=${Date.now()}`;
    
    // Клавиатура с кнопками
    const keyboard = {
        reply_markup: {
            keyboard: [
                [{ text: '💰 Баланс' }, { text: '📱 WebApp' }],
                [{ text: '+100' }, { text: '-100' }],
                [{ text: '🔄 Синхронизация' }]
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, 
        `👋 Привет, ${userName}!\n\n` +
        `Это тестовый бот для синхронизации баланса с WebApp.\n\n` +
        `💰 Нажми "💰 Баланс" - чтобы узнать баланс\n` +
        `📱 Нажми "📱 WebApp" - чтобы открыть мини-приложение\n` +
        `➕ Нажми "+100" - чтобы пополнить баланс\n` +
        `➖ Нажми "-100" - чтобы списать с баланса\n\n` +
        `Баланс синхронизируется с мини-приложением в реальном времени!`,
        keyboard
    );
});

// Кнопка "💰 Баланс"
bot.onText(/💰 Баланс/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        // Запрашиваем баланс с сервера
        const response = await fetch(`http://localhost:3000/api/user/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            bot.sendMessage(chatId, 
                `💰 Ваш баланс: ${data.user.balance.toLocaleString('ru-RU')} ₽\n` +
                `🕐 Последняя синхронизация: ${new Date(data.user.lastSync).toLocaleTimeString('ru-RU')}`
            );
        } else {
            bot.sendMessage(chatId, 
                `💰 Ваш баланс: 10,000 ₽\n` +
                `⚠️ Это начальный баланс. Откройте WebApp для синхронизации.`
            );
        }
    } catch (error) {
        bot.sendMessage(chatId, 
            `💰 Ваш баланс: 10,000 ₽\n` +
            `❌ Сервер недоступен. Используется локальный баланс.`
        );
    }
});

// Кнопка "+100"
bot.onText(/\+100/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    try {
        // Отправляем запрос на изменение баланса
        const response = await fetch(`http://localhost:3000/api/user/${userId}/change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 100 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Обновляем WebApp URL с новым балансом
            const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${data.balance}&ts=${Date.now()}`;
            
            bot.sendMessage(chatId, 
                `✅ +100 ₽ успешно начислено!\n\n` +
                `💰 Новый баланс: ${data.balance.toLocaleString('ru-RU')} ₽\n\n` +
                `Баланс обновлен на сервере. Откройте WebApp чтобы увидеть изменения.`,
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
            bot.sendMessage(chatId, `❌ Ошибка: ${data.message}`);
        }
    } catch (error) {
        bot.sendMessage(chatId, 
            `❌ Сервер недоступен!\n` +
            `Пополнение не удалось. Проверьте, запущен ли сервер.`
        );
    }
});

// Кнопка "-100"
bot.onText(/\-100/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    try {
        const response = await fetch(`http://localhost:3000/api/user/${userId}/change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: -100 })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&balance=${data.balance}&ts=${Date.now()}`;
            
            bot.sendMessage(chatId, 
                `✅ -100 ₽ успешно списано!\n\n` +
                `💰 Новый баланс: ${data.balance.toLocaleString('ru-RU')} ₽\n\n` +
                `Баланс обновлен на сервере.`,
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
            bot.sendMessage(chatId, `❌ ${data.message}`);
        }
    } catch (error) {
        bot.sendMessage(chatId, '❌ Сервер недоступен!');
    }
});

// Кнопка "🔄 Синхронизация"
bot.onText(/🔄 Синхронизация/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
        const response = await fetch(`http://localhost:3000/api/user/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            bot.sendMessage(chatId, 
                `✅ Синхронизация успешна!\n\n` +
                `💰 Баланс: ${data.user.balance.toLocaleString('ru-RU')} ₽\n` +
                `🕐 Время: ${new Date(data.user.lastSync).toLocaleTimeString('ru-RU')}\n` +
                `📊 Операций: ${data.user.history.length}`
            );
        } else {
            bot.sendMessage(chatId, 
                `⚠️ Пользователь не найден на сервере.\n` +
                `Откройте WebApp чтобы создать аккаунт.`
            );
        }
    } catch (error) {
        bot.sendMessage(chatId, '❌ Сервер недоступен! Запустите server.js');
    }
});

// Кнопка "📱 WebApp"
bot.onText(/📱 WebApp/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const userName = msg.from.first_name;
    
    // Создаем URL с актуальными параметрами
    const webappUrl = `${WEBAPP_URL}/?tg_id=${userId}&name=${encodeURIComponent(userName)}&ts=${Date.now()}`;
    
    bot.sendMessage(chatId, 
        `📱 Нажмите кнопку ниже чтобы открыть мини-приложение:\n\n` +
        `🔗 ${webappUrl}\n\n` +
        `В мини-приложении вы сможете:\n` +
        `• Видеть текущий баланс\n` +
        `• Изменять баланс\n` +
        `• Синхронизировать с ботом\n` +
        `• Смотреть историю операций`,
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

// Простая команда для тестирования
bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    bot.sendMessage(chatId, 
        `🧪 Тестовая информация:\n\n` +
        `👤 Ваш ID: ${userId}\n` +
        `💻 WebApp URL: ${WEBAPP_URL}\n` +
        `🔗 Ваша ссылка: ${WEBAPP_URL}/?tg_id=${userId}\n\n` +
        `Откройте ссылку в браузере или через кнопку WebApp.`
    );
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка бота:', error.message);
});