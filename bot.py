import os
import asyncio
import json
import random
from datetime import datetime
from typing import Dict, List, Optional
import asyncpg
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message, InlineKeyboardMarkup,
    InlineKeyboardButton, WebAppInfo, CallbackQuery,
    MenuButtonWebApp
)
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

# Загрузка переменных окружения
load_dotenv()

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DATABASE_URL = os.getenv('DATABASE_URL')

# Проверка конфигурации
if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL не найден в .env файле!")

# Инициализация бота
bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
dp = Dispatcher()
router = Router()
dp.include_router(router)

# Пул соединений с базой данных
pool = None

async def init_db():
    """Инициализация базы данных PostgreSQL"""
    global pool
    
    print(f"🔄 Подключение к базе данных PostgreSQL...")
    
    try:
        # Создаем пул соединений
        pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10,
            command_timeout=60
        )
        
        async with pool.acquire() as conn:
            # Создаем таблицы
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                balance INTEGER DEFAULT 10000,
                experience INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                last_login TIMESTAMP DEFAULT NOW(),
                webapp_data JSONB DEFAULT '{}'::jsonb
            )
            ''')
            
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS items (
                item_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
                category TEXT NOT NULL CHECK(category IN ('food', 'resources', 'weapons', 'tools', 'special')),
                price INTEGER NOT NULL,
                sell_price INTEGER NOT NULL,
                description TEXT,
                texture_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
            ''')
            
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS inventory (
                inventory_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
                quantity INTEGER DEFAULT 1,
                obtained_at TIMESTAMP DEFAULT NOW(),
                is_favorite BOOLEAN DEFAULT FALSE,
                UNIQUE(user_id, item_id)
            )
            ''')
            
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS cases (
                case_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                icon TEXT NOT NULL,
                description TEXT,
                rarity_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
                texture_url TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
            ''')
            
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS opening_history (
                history_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(user_id),
                case_id INTEGER NOT NULL REFERENCES cases(case_id),
                item_id INTEGER NOT NULL REFERENCES items(item_id),
                opened_at TIMESTAMP DEFAULT NOW()
            )
            ''')
            
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(user_id),
                type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward', 'sell')),
                amount INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )
            ''')
            
            # Добавляем индексы для производительности
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_opening_history_user_id ON opening_history(user_id)')
            await conn.execute('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)')
            
            # Проверяем, есть ли тестовые данные
            count = await conn.fetchval('SELECT COUNT(*) FROM items')
            if count == 0:
                await add_initial_data(conn)
        
        print(f"✅ База данных инициализирована: {DATABASE_URL}")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка инициализации базы данных: {e}")
        return False

async def add_initial_data(conn):
    """Добавление начальных данных"""
    print("📦 Добавление начальных данных...")
    
    # Предметы Minecraft
    items_data = [
        # Common - Еда
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает 2 единицы голода", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Восстанавливает 5 единиц голода", "bread.png"),
        # ... (все остальные предметы из вашего кода)
    ]
    
    for item in items_data:
        await conn.execute('''
            INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ''', *item)
    
    # Кейсы
    cases_data = [
        ("Кейс с Едой", 100, "🍎", "Содержит разнообразную еду", 
         '{"common": 70, "uncommon": 30}', "case_food.png"),
        # ... (все остальные кейсы)
    ]
    
    for case in cases_data:
        await conn.execute('''
            INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url)
            VALUES ($1, $2, $3, $4, $5, $6)
        ''', *case)
    
    print(f"✅ Добавлены начальные данные")

async def get_user(user_id: int) -> Optional[Dict]:
    """Получение или создание пользователя"""
    try:
        async with pool.acquire() as conn:
            # Пытаемся получить существующего пользователя
            user = await conn.fetchrow('''
                SELECT user_id, username, first_name, last_name, 
                       balance, experience, level, webapp_data
                FROM users 
                WHERE user_id = $1
            ''', user_id)
            
            if not user:
                # Создаем нового пользователя
                await conn.execute('''
                    INSERT INTO users (user_id, balance, experience, level)
                    VALUES ($1, 10000, 0, 1)
                ''', user_id)
                
                # Создаем начальную транзакцию
                await conn.execute('''
                    INSERT INTO transactions (user_id, type, amount, description)
                    VALUES ($1, 'reward', 10000, 'Стартовый бонус')
                ''', user_id)
                
                # Получаем созданного пользователя
                user = await conn.fetchrow('''
                    SELECT user_id, username, first_name, last_name, 
                           balance, experience, level, webapp_data
                    FROM users 
                    WHERE user_id = $1
                ''', user_id)
            
            return dict(user) if user else None
            
    except Exception as e:
        print(f"❌ Ошибка при получении пользователя {user_id}: {e}")
        return None

async def update_user_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> Optional[int]:
    """Обновление баланса пользователя"""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Обновляем баланс
                await conn.execute('''
                    UPDATE users 
                    SET balance = balance + $1
                    WHERE user_id = $2
                ''', amount, user_id)
                
                # Добавляем транзакцию
                await conn.execute('''
                    INSERT INTO transactions (user_id, type, amount, description)
                    VALUES ($1, $2, $3, $4)
                ''', user_id, transaction_type, amount, description)
                
                # Получаем новый баланс
                new_balance = await conn.fetchval('''
                    SELECT balance FROM users WHERE user_id = $1
                ''', user_id)
                
                return new_balance
                
    except Exception as e:
        print(f"❌ Ошибка обновления баланса для {user_id}: {e}")
        return None

async def get_inventory(user_id: int) -> List[Dict]:
    """Получение инвентаря пользователя"""
    try:
        async with pool.acquire() as conn:
            items = await conn.fetch('''
                SELECT i.item_id, i.name, i.icon, i.rarity, i.category, 
                       i.price, i.sell_price, i.description, i.texture_url,
                       inv.quantity, inv.obtained_at, inv.is_favorite
                FROM inventory inv
                JOIN items i ON inv.item_id = i.item_id
                WHERE inv.user_id = $1
                ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
            ''', user_id)
            
            return [dict(item) for item in items]
            
    except Exception as e:
        print(f"❌ Ошибка получения инвентаря для {user_id}: {e}")
        return []

async def get_cases() -> List[Dict]:
    """Получение списка кейсов"""
    try:
        async with pool.acquire() as conn:
            cases = await conn.fetch('''
                SELECT case_id, name, price, icon, description, rarity_weights, texture_url 
                FROM cases 
                WHERE is_active = TRUE
            ''')
            
            return [dict(case) for case in cases]
            
    except Exception as e:
        print(f"❌ Ошибка получения кейсов: {e}")
        return []

async def open_case(user_id: int, case_id: int) -> Dict:
    """Открытие кейса"""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Получаем информацию о кейсе
                case = await conn.fetchrow('''
                    SELECT name, price, rarity_weights 
                    FROM cases 
                    WHERE case_id = $1
                ''', case_id)
                
                if not case:
                    return {"error": "Кейс не найден"}
                
                case_name, case_price, rarity_weights = case
                
                # Проверяем баланс
                balance = await conn.fetchval('''
                    SELECT balance FROM users WHERE user_id = $1
                ''', user_id)
                
                if balance < case_price:
                    return {"error": "Недостаточно средств"}
                
                # Выбираем редкость на основе весов
                rarity_weights_dict = rarity_weights
                total_weight = sum(rarity_weights_dict.values())
                random_value = random.uniform(0, total_weight)
                
                selected_rarity = None
                cumulative_weight = 0
                for rarity, weight in rarity_weights_dict.items():
                    cumulative_weight += weight
                    if random_value <= cumulative_weight:
                        selected_rarity = rarity
                        break
                
                # Получаем случайный предмет выбранной редкости
                item = await conn.fetchrow('''
                    SELECT item_id, name, icon, rarity, price, description, texture_url 
                    FROM items 
                    WHERE rarity = $1 
                    ORDER BY RANDOM() 
                    LIMIT 1
                ''', selected_rarity)
                
                if not item:
                    return {"error": "Не удалось выбрать предмет"}
                
                # Списание средств
                new_balance = await update_user_balance(
                    user_id, 
                    -case_price, 
                    'purchase', 
                    f"Покупка кейса: {case_name}"
                )
                
                # Добавляем предмет в инвентарь
                await conn.execute('''
                    INSERT INTO inventory (user_id, item_id)
                    VALUES ($1, $2)
                    ON CONFLICT (user_id, item_id) 
                    DO UPDATE SET quantity = inventory.quantity + 1
                ''', user_id, item['item_id'])
                
                # Добавляем в историю открытий
                await conn.execute('''
                    INSERT INTO opening_history (user_id, case_id, item_id)
                    VALUES ($1, $2, $3)
                ''', user_id, case_id, item['item_id'])
                
                # Начисляем опыт
                experience_gained = case_price // 10
                await conn.execute('''
                    UPDATE users 
                    SET experience = experience + $1
                    WHERE user_id = $2
                ''', experience_gained, user_id)
                
                # Проверяем повышение уровня
                user_data = await conn.fetchrow('''
                    SELECT experience, level FROM users WHERE user_id = $1
                ''', user_id)
                
                user_exp, user_level = user_data['experience'], user_data['level']
                new_level = user_level
                
                while user_exp >= new_level * 1000:
                    new_level += 1
                
                if new_level > user_level:
                    await conn.execute('''
                        UPDATE users SET level = $1 WHERE user_id = $2
                    ''', new_level, user_id)
                
                # Получаем обновленные данные
                user = await get_user(user_id)
                inventory = await get_inventory(user_id)
                
                return {
                    "success": True,
                    "item": dict(item),
                    "new_balance": new_balance,
                    "experience_gained": experience_gained,
                    "case_price": case_price,
                    "user": user,
                    "inventory": inventory
                }
                
    except Exception as e:
        print(f"❌ Ошибка открытия кейса для {user_id}: {e}")
        return {"error": f"Ошибка сервера: {str(e)}"}

async def sell_item(user_id: int, item_id: int) -> Dict:
    """Продажа предмета"""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Получаем информацию о предмете
                item = await conn.fetchrow('''
                    SELECT i.item_id, i.name, i.sell_price, inv.quantity
                    FROM items i
                    JOIN inventory inv ON i.item_id = inv.item_id
                    WHERE inv.user_id = $1 AND i.item_id = $2
                ''', user_id, item_id)
                
                if not item:
                    return {"error": "Предмет не найден в инвентаре"}
                
                # Удаляем один предмет из инвентаря
                if item['quantity'] > 1:
                    await conn.execute('''
                        UPDATE inventory 
                        SET quantity = quantity - 1
                        WHERE user_id = $1 AND item_id = $2
                    ''', user_id, item_id)
                else:
                    await conn.execute('''
                        DELETE FROM inventory 
                        WHERE user_id = $1 AND item_id = $2
                    ''', user_id, item_id)
                
                # Добавляем деньги
                new_balance = await update_user_balance(
                    user_id,
                    item['sell_price'],
                    'sell',
                    f"Продажа предмета: {item['name']}"
                )
                
                # Получаем обновленные данные
                user = await get_user(user_id)
                inventory = await get_inventory(user_id)
                
                return {
                    "success": True,
                    "sell_price": item['sell_price'],
                    "new_balance": new_balance,
                    "item": dict(item),
                    "user": user,
                    "inventory": inventory
                }
                
    except Exception as e:
        print(f"❌ Ошибка продажи предмета для {user_id}: {e}")
        return {"error": f"Ошибка сервера: {str(e)}"}

async def get_user_data_for_webapp(user_id: int) -> Dict:
    """Получение данных пользователя для веб-приложения"""
    try:
        user = await get_user(user_id)
        if not user:
            return {"error": "Пользователь не найден"}
        
        inventory = await get_inventory(user_id)
        cases = await get_cases()
        
        return {
            "success": True,
            "user": {
                "balance": user['balance'],
                "experience": user['experience'],
                "level": user['level'],
                "user_id": user['user_id']
            },
            "inventory": inventory,
            "cases": cases,
            "config": {
                "min_bet": 10,
                "max_bet": 10000,
                "daily_bonus": 100,
                "version": "1.0.0"
            }
        }
        
    except Exception as e:
        print(f"❌ Ошибка получения данных для веб-приложения: {e}")
        return {"error": "Ошибка сервера"}

# Обработчики команд
@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    user = await get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Ошибка загрузки профиля. Попробуйте позже.")
        return
    
    # Обновляем информацию о пользователе
    async with pool.acquire() as conn:
        await conn.execute('''
            UPDATE users 
            SET username = $1, first_name = $2, last_name = $3, last_login = NOW()
            WHERE user_id = $4
        ''', message.from_user.username, message.from_user.first_name, 
           message.from_user.last_name, message.from_user.id)
    
    # Создаем клавиатуру с веб-приложением
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text="⛏️ Открыть кейсы",
                web_app=WebAppInfo(url="https://ваш-домен.railway.app")
            )],
            [InlineKeyboardButton(text="💰 Баланс", callback_data="balance"),
             InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory")]
        ]
    )
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening!</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

Нажмите кнопку ниже, чтобы открыть веб-приложение!
    """
    
    await message.answer(text, reply_markup=keyboard)

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Команда /balance"""
    user = await get_user(message.from_user.id)
    inventory = await get_inventory(message.from_user.id)
    
    if not user:
        await message.answer("❌ Пользователь не найден")
        return
    
    total_value = sum(item['price'] * item.get('quantity', 1) for item in inventory)
    
    text = f"""
💰 <b>Статистика аккаунта</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']}
📦 <b>Предметов в инвентаре:</b> {len(inventory)}
📊 <b>Общая стоимость:</b> {total_value} 💎
    """
    
    await message.answer(text)

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из веб-приложения"""
    try:
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        action = data.get('action')
        
        print(f"🌐 Web App действие: {action} от пользователя {user_id}")
        
        response = {"success": False, "error": "Неизвестное действие"}
        
        if action == 'init' or action == 'sync_data':
            # Инициализация или синхронизация
            response = await get_user_data_for_webapp(user_id)
            
        elif action == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            if not case_id:
                response = {"error": "Не указан ID кейса"}
            else:
                response = await open_case(user_id, int(case_id))
                
        elif action == 'sell_item':
            # Продажа предмета
            item_id = data.get('item_id')
            if not item_id:
                response = {"error": "Не указан ID предмета"}
            else:
                response = await sell_item(user_id, int(item_id))
                
        elif action == 'update_balance':
            # Обновление баланса (для админа)
            if user_id == ADMIN_ID:
                target_id = data.get('user_id')
                amount = data.get('amount')
                if target_id and amount:
                    new_balance = await update_user_balance(
                        int(target_id), 
                        int(amount), 
                        'deposit', 
                        'Админское пополнение'
                    )
                    response = {"success": True, "new_balance": new_balance}
                else:
                    response = {"error": "Не указаны user_id или amount"}
            else:
                response = {"error": "Нет прав"}
        
        # Отправляем ответ обратно в веб-приложение
        await message.answer(json.dumps(response, ensure_ascii=False))
        print(f"📤 Отправлен ответ на {action}")
        
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка JSON: {e}")
        await message.answer(json.dumps({"error": "Неверный формат данных"}))
    except Exception as e:
        print(f"❌ Ошибка обработки Web App: {e}")
        await message.answer(json.dumps({"error": "Ошибка сервера"}))

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ панель"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("❌ Нет доступа")
        return
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")],
            [InlineKeyboardButton(text="💰 Пополнить баланс", callback_data="admin_add_balance")],
            [InlineKeyboardButton(text="🔄 Сбросить данные", callback_data="admin_reset")]
        ]
    )
    
    await message.answer("👑 Админ панель", reply_markup=keyboard)

async def main():
    """Основная функция запуска бота"""
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"🤖 Бот запускается...")
    print(f"👑 Админ ID: {ADMIN_ID}")
    print(f"🐛 Режим отладки: {DEBUG}")
    print("=" * 50)
    
    # Инициализация базы данных
    if not await init_db():
        print("❌ Не удалось инициализировать базу данных")
        return
    
    print("✅ База данных готова")
    print("🤖 Бот запущен!")
    print("⛏️ Ожидание команд...")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")
    finally:
        # Закрываем пул соединений при завершении
        if pool:
            await pool.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")