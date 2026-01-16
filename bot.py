import os
import asyncio
import json
import asyncpg
import random
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message, InlineKeyboardMarkup, 
    InlineKeyboardButton, WebAppInfo, CallbackQuery
)
from aiogram.filters import Command
from aiogram.enums import ParseMode

# Загрузка переменных окружения из .env файла
load_dotenv()

# Получение конфигурации из переменных окружения
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DATABASE_URL = os.getenv('DATABASE_URL')  # URL от Railway PostgreSQL

# Проверка наличия обязательных переменных
if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")
if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

# Пул подключений к базе данных
db_pool: Optional[asyncpg.Pool] = None

async def init_db():
    """Инициализация базы данных PostgreSQL"""
    global db_pool
    try:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=1,
            max_size=10
        )
        
        async with db_pool.acquire() as conn:
            # Таблица пользователей
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                balance INTEGER DEFAULT 1000,
                experience INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Таблица предметов Minecraft
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Таблица инвентаря
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS inventory (
                inventory_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                item_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_favorite BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
            )
            ''')
            
            # Таблица кейсов
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS cases (
                case_id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                icon TEXT NOT NULL,
                description TEXT,
                rarity_weights TEXT NOT NULL,
                texture_url TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')
            
            # Таблица истории открытий
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS opening_history (
                history_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                case_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id),
                FOREIGN KEY (case_id) REFERENCES cases(case_id),
                FOREIGN KEY (item_id) REFERENCES items(item_id)
            )
            ''')
            
            # Таблица транзакций
            await conn.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                transaction_id SERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward', 'sync')),
                amount INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
            ''')
            
            # Проверяем наличие данных
            count = await conn.fetchval("SELECT COUNT(*) FROM items")
            if count == 0:
                await add_initial_data(conn)
        
        print(f"✅ База данных PostgreSQL инициализирована")
        
    except Exception as e:
        print(f"❌ Ошибка инициализации БД: {e}")
        raise

async def add_initial_data(conn):
    """Добавление начальных данных в БД"""
    print("📦 Добавление начальных данных...")
    
    minecraft_items = [
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает 2 единицы голода", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Восстанавливает 5 единиц голода", "bread.png"),
        ("Мясо", "🍖", "common", "food", 50, 25, "Восстанавливает 8 единиц голода", "meat.png"),
        ("Тыквенный пирог", "🥧", "common", "food", 60, 30, "Восстанавливает 8 единицы голода", "pie.png"),
        ("Золотое яблоко", "🍏", "uncommon", "food", 400, 200, "Даёт регенерацию здоровья", "golden_apple.png"),
        ("Уголь", "⚫", "common", "resources", 30, 15, "Топливо и краситель", "coal.png"),
        ("Железный слиток", "⛓️", "common", "resources", 50, 25, "Базовый ресурс для крафта", "iron.png"),
        ("Золотой слиток", "🟨", "common", "resources", 80, 40, "Редкий ресурс", "gold.png"),
        ("Красная пыль", "🔴", "common", "resources", 40, 20, "Для механизмов и зелий", "redstone.png"),
        ("Алмаз", "💎", "uncommon", "resources", 150, 75, "Ценный минерал", "diamond.png"),
        ("Изумруд", "🟩", "uncommon", "resources", 200, 100, "Торговая валюта", "emerald.png"),
        ("Лазурит", "🔵", "uncommon", "resources", 100, 50, "Для зачарования", "lapis.png"),
        ("Железный меч", "⚔️", "uncommon", "weapons", 180, 90, "Базовое оружие", "iron_sword.png"),
        ("Лук", "🏹", "uncommon", "weapons", 120, 60, "Дальнобойное оружие", "bow.png"),
        ("Щит", "🛡️", "uncommon", "weapons", 150, 75, "Защита от атак", "shield.png"),
        ("Алмазный меч", "⚔️💎", "rare", "weapons", 250, 125, "Мощное оружие", "diamond_sword.png"),
        ("Алмазная кирка", "⛏️💎", "rare", "tools", 300, 150, "Быстрая добыча", "diamond_pickaxe.png"),
        ("Незеритовый слиток", "🔱", "rare", "resources", 500, 250, "Элитный материал", "netherite.png"),
        ("Элитра", "🧥", "rare", "special", 800, 400, "Позволяет летать", "elytra.png"),
        ("Тотем бессмертия", "🐦", "epic", "special", 1000, 500, "Спасение от смерти", "totem.png"),
        ("Сердце моря", "💙", "epic", "resources", 1200, 600, "Редкая реликвия", "heart.png"),
        ("Голова дракона", "🐲", "epic", "special", 1500, 750, "Трофей дракона", "dragon_head.png"),
        ("Командный блок", "🟪", "legendary", "special", 5000, 2500, "Божественный предмет", "command_block.png"),
        ("Меч незера", "🗡️", "legendary", "weapons", 3000, 1500, "Легендарное оружие", "netherite_sword.png"),
        ("Корона власти", "👑", "legendary", "special", 10000, 5000, "Знак абсолютной власти", "crown.png"),
        ("Броня незера", "🛡️🔥", "legendary", "weapons", 4000, 2000, "Неуязвимая защита", "netherite_armor.png"),
    ]
    
    await conn.executemany(
        """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)""",
        minecraft_items
    )
    
    cases = [
        ("Кейс с Едой", 100, "🍎", "Содержит разнообразную еду и напитки", 
         '{"common": 70, "uncommon": 30}', "case_food.png"),
        ("Ресурсный Кейс", 250, "⛏️", "Руды, минералы и базовые ресурсы", 
         '{"common": 50, "uncommon": 40, "rare": 10}', "case_resources.png"),
        ("Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
         '{"uncommon": 40, "rare": 50, "epic": 10}', "case_weapons.png"),
        ("Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
         '{"rare": 30, "epic": 50, "legendary": 20}', "case_legendary.png"),
        ("Донат Кейс", 5000, "👑", "Эксклюзивные донат предметы", 
         '{"epic": 40, "legendary": 60}', "case_donate.png"),
        ("Случайный Кейс", 750, "🧰", "Микс из всех категорий", 
         '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}', "case_random.png"),
    ]
    
    await conn.executemany(
        """INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url) 
           VALUES ($1, $2, $3, $4, $5, $6)""",
        cases
    )
    
    print(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

async def get_user(user_id: int) -> Dict:
    """Получение или создание пользователя"""
    async with db_pool.acquire() as conn:
        user_data = await conn.fetchrow(
            """SELECT user_id, username, first_name, last_name, balance, experience, level 
               FROM users WHERE user_id = $1""",
            user_id
        )
        
        if not user_data:
            await conn.execute(
                """INSERT INTO users (user_id, balance, experience, level, last_login) 
                   VALUES ($1, 1000, 0, 1, CURRENT_TIMESTAMP)""",
                user_id
            )
            
            await conn.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES ($1, 'reward', 1000, 'Стартовый бонус')""",
                user_id
            )
            
            user_data = await conn.fetchrow(
                """SELECT user_id, username, first_name, last_name, balance, experience, level 
                   FROM users WHERE user_id = $1""",
                user_id
            )
        
        return {
            "user_id": user_data['user_id'],
            "username": user_data['username'],
            "first_name": user_data['first_name'],
            "last_name": user_data['last_name'],
            "balance": user_data['balance'],
            "experience": user_data['experience'],
            "level": user_data['level']
        }

async def update_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> int:
    """Обновление баланса пользователя"""
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET balance = balance + $1 WHERE user_id = $2",
            amount, user_id
        )
        
        await conn.execute(
            """INSERT INTO transactions (user_id, type, amount, description) 
               VALUES ($1, $2, $3, $4)""",
            user_id, transaction_type, amount, description
        )
        
        new_balance = await conn.fetchval(
            "SELECT balance FROM users WHERE user_id = $1", 
            user_id
        )
        
        return new_balance

async def get_inventory(user_id: int) -> List[Dict]:
    """Получение инвентаря пользователя"""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch('''
        SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price, 
               i.description, i.texture_url, inv.quantity, inv.obtained_at, inv.is_favorite
        FROM inventory inv
        JOIN items i ON inv.item_id = i.item_id
        WHERE inv.user_id = $1
        ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
        ''', user_id)
        
        inventory = []
        for row in rows:
            inventory.append({
                "id": row['item_id'],
                "name": row['name'],
                "icon": row['icon'],
                "rarity": row['rarity'],
                "category": row['category'],
                "price": row['price'],
                "sell_price": row['sell_price'],
                "description": row['description'],
                "texture_url": row['texture_url'],
                "quantity": row['quantity'],
                "obtained_at": row['obtained_at'].isoformat() if row['obtained_at'] else None,
                "is_favorite": row['is_favorite']
            })
        
        return inventory

async def get_cases() -> List[Dict]:
    """Получение списка кейсов"""
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT case_id, name, price, icon, description, rarity_weights, texture_url FROM cases WHERE is_active = TRUE"
        )
        
        cases = []
        for row in rows:
            cases.append({
                "id": row['case_id'],
                "name": row['name'],
                "price": row['price'],
                "icon": row['icon'],
                "description": row['description'],
                "rarity_weights": json.loads(row['rarity_weights']),
                "texture_url": row['texture_url']
            })
        
        return cases

async def open_case(user_id: int, case_id: int) -> Dict:
    """Открытие кейса"""
    async with db_pool.acquire() as conn:
        case_data = await conn.fetchrow(
            "SELECT price, rarity_weights FROM cases WHERE case_id = $1",
            case_id
        )
        
        if not case_data:
            return {"error": "Кейс не найден"}
        
        case_price = case_data['price']
        rarity_weights = json.loads(case_data['rarity_weights'])
        
        total_weight = sum(rarity_weights.values())
        random_value = random.uniform(0, total_weight)
        
        selected_rarity = None
        cumulative_weight = 0
        for rarity, weight in rarity_weights.items():
            cumulative_weight += weight
            if random_value <= cumulative_weight:
                selected_rarity = rarity
                break
        
        item_data = await conn.fetchrow(
            """SELECT item_id, name, icon, rarity, price, description, texture_url 
               FROM items WHERE rarity = $1 ORDER BY RANDOM() LIMIT 1""",
            selected_rarity
        )
        
        if not item_data:
            return {"error": "Не удалось выбрать предмет"}
        
        item = {
            "item_id": item_data['item_id'],
            "name": item_data['name'],
            "icon": item_data['icon'],
            "rarity": item_data['rarity'],
            "price": item_data['price'],
            "description": item_data['description'],
            "texture_url": item_data['texture_url']
        }
        
        balance = await conn.fetchval(
            "SELECT balance FROM users WHERE user_id = $1", 
            user_id
        )
        
        if balance < case_price:
            return {"error": "Недостаточно средств"}
        
        new_balance = await update_balance(
            user_id, -case_price, "purchase", 
            f"Покупка кейса: {case_id}"
        )
        
        await conn.execute(
            """INSERT INTO inventory (user_id, item_id) 
               VALUES ($1, $2)""",
            user_id, item["item_id"]
        )
        
        await conn.execute(
            """INSERT INTO opening_history (user_id, case_id, item_id) 
               VALUES ($1, $2, $3)""",
            user_id, case_id, item["item_id"]
        )
        
        experience_gained = case_price // 10
        await conn.execute(
            "UPDATE users SET experience = experience + $1 WHERE user_id = $2",
            experience_gained, user_id
        )
        
        return {
            "success": True,
            "item": item,
            "new_balance": new_balance,
            "experience_gained": experience_gained,
            "case_price": case_price
        }

async def sync_balance(user_id: int, balance: int) -> bool:
    """Синхронизация баланса из Web App"""
    try:
        async with db_pool.acquire() as conn:
            current_balance = await conn.fetchval(
                "SELECT balance FROM users WHERE user_id = $1", 
                user_id
            )
            
            if current_balance is None:
                return False
            
            difference = balance - current_balance
            if difference != 0:
                await conn.execute(
                    "UPDATE users SET balance = $1 WHERE user_id = $2",
                    balance, user_id
                )
                
                await conn.execute(
                    """INSERT INTO transactions (user_id, type, amount, description) 
                       VALUES ($1, 'sync', $2, 'Синхронизация баланса из Web App')""",
                    user_id, difference
                )
            
            return True
    except Exception as e:
        print(f"❌ Ошибка синхронизации баланса: {e}")
        return False

@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 Получена команда /start от пользователя {message.from_user.id}")
    
    user = await get_user(message.from_user.id)
    
    async with db_pool.acquire() as conn:
        await conn.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1",
            user["user_id"]
        )
    
    async with db_pool.acquire() as conn:
        cases_opened = await conn.fetchval(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = $1",
            user["user_id"]
        )
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⛏️ Открыть Minecraft Кейсы",
                    web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")  # Замените на ваш URL
                )
            ],
            [
                InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
                InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory")
            ],
            [
                InlineKeyboardButton(text="💰 Пополнить баланс", callback_data="deposit"),
                InlineKeyboardButton(text="🔄 Обменять предметы", callback_data="trade")
            ]
        ]
    )
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
🏆 <b>Открыто кейсов:</b> {cases_opened} (/stats)

<code>Начни открывать кейсы и собери свою коллекцию!</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлен ответ пользователю {message.from_user.id}")

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    print(f"📥 Получена команда /balance от пользователя {message.from_user.id}")
    
    user = await get_user(message.from_user.id)
    inventory = await get_inventory(user["user_id"])
    
    total_value = sum(item['price'] * item['quantity'] for item in inventory)
    
    text = f"""
💰 <b>Статистика аккаунта</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📦 <b>Предметов в инвентаре:</b> {len(inventory)}
📊 <b>Общая стоимость:</b> {total_value} 💎
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлена статистика пользователю {message.from_user.id}")

@router.message(Command("daily"))
async def cmd_daily(message: Message):
    """Ежедневный бонус"""
    print(f"📥 Получена команда /daily от пользователя {message.from_user.id}")
    
    user_id = message.from_user.id
    user = await get_user(user_id)
    
    async with db_pool.acquire() as conn:
        last_daily = await conn.fetchrow(
            """SELECT created_at FROM transactions 
               WHERE user_id = $1 AND type = 'reward' AND description = 'Ежедневный бонус'
               ORDER BY created_at DESC LIMIT 1""",
            user_id
        )
        
        if last_daily:
            last_date = last_daily['created_at']
            if last_date.date() == datetime.now().date():
                await message.answer("🎁 Вы уже получали ежедневный бонус сегодня!")
                return
    
    daily_amount = 100
    new_balance = await update_balance(
        user_id, daily_amount, "reward", "Ежедневный бонус"
    )
    
    text = f"""
🎁 <b>Ежедневный бонус получен!</b>

💰 +{daily_amount} 💎 добавлено на баланс
📈 <b>Новый баланс:</b> {new_balance} 💎

🕐 Следующий бонус через 24 часа!
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)
    print(f"📤 Начислен ежедневный бонус пользователю {user_id}")

@router.message(Command("help"))
async def cmd_help(message: Message):
    """Справка по командам"""
    print(f"📥 Получена команда /help от пользователя {message.from_user.id}")
    
    text = """
⛏️ <b>Minecraft Case Bot - Помощь</b>

<b>Основные команды:</b>
/start - Запустить бота и открыть меню
/help - Показать эту справку
/balance - Показать баланс и статистику
/daily - Получить ежедневный бонус (100 💎)
/inventory - Посмотреть инвентарь
/cases - Посмотреть доступные кейсы

<b>Для админов:</b>
/admin - Админ панель

<b>Как играть:</b>
1. Нажмите кнопку "Открыть Minecraft Кейсы"
2. Выберите кейс в веб-приложении
3. Откройте кейс и получите предмет
4. Собирайте коллекцию и повышайте уровень!

<b>Редкости предметов:</b>
⚪ Обычный - 70% шанс
🟢 Необычный - 20% шанс
🔵 Редкий - 7% шанс
🟣 Эпический - 2.5% шанс
🟡 Легендарный - 0.5% шанс
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("inventory"))
async def cmd_inventory(message: Message):
    """Просмотр инвентаря"""
    print(f"📥 Получена команда /inventory от пользователя {message.from_user.id}")
    
    user = await get_user(message.from_user.id)
    inventory = await get_inventory(user["user_id"])
    
    if not inventory:
        await message.answer("🎒 <b>Ваш инвентарь пуст!</b>\n\nОткройте кейсы, чтобы получить предметы! ⛏️", parse_mode=ParseMode.HTML)
        return
    
    items_by_rarity = {}
    for item in inventory:
        rarity = item['rarity']
        if rarity not in items_by_rarity:
            items_by_rarity[rarity] = []
        items_by_rarity[rarity].append(item)
    
    text = f"""
🎒 <b>Ваш инвентарь</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
📦 <b>Всего предметов:</b> {len(inventory)}
💰 <b>Общая стоимость:</b> {sum(item['price'] * item['quantity'] for item in inventory)} 💎
"""
    
    rarity_names = {
        'legendary': '🟡 Легендарные',
        'epic': '🟣 Эпические',
        'rare': '🔵 Редкие',
        'uncommon': '🟢 Необычные',
        'common': '⚪ Обычные'
    }
    
    for rarity in ['legendary', 'epic', 'rare', 'uncommon', 'common']:
        if rarity in items_by_rarity:
            text += f"\n{rarity_names[rarity]} ({len(items_by_rarity[rarity])}):\n"
            for i, item in enumerate(items_by_rarity[rarity][:5], 1):
                text += f"{i}. {item['icon']} {item['name']} - {item['price']} 💎\n"
            if len(items_by_rarity[rarity]) > 5:
                text += f"... и еще {len(items_by_rarity[rarity]) - 5} предметов\n"
    
    text += "\n📱 <b>Для детального просмотра используйте веб-приложение!</b>"
    
    await message.answer(text, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлен инвентарь пользователю {message.from_user.id}")

@router.message(Command("cases"))
async def cmd_cases(message: Message):
    """Просмотр доступных кейсов"""
    print(f"📥 Получена команда /cases от пользователя {message.from_user.id}")
    
    cases = await get_cases()
    
    text = """
📦 <b>Доступные кейсы</b>

"""
    
    for case in cases:
        rarity_weights = case['rarity_weights']
        text += f"""
{case['icon']} <b>{case['name']}</b> - {case['price']} 💎
{case['description']}
Шансы: Обычные {rarity_weights.get('common', 0)}% | Необычные {rarity_weights.get('uncommon', 0)}% | Редкие {rarity_weights.get('rare', 0)}% | Эпические {rarity_weights.get('epic', 0)}% | Легендарные {rarity_weights.get('legendary', 0)}%
"""
    
    text += """\n📱 <b>Для открытия кейсов используйте веб-приложение!</b>"""
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ панель"""
    print(f"📥 Получена команда /admin от пользователя {message.from_user.id}")
    
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ У вас нет прав администратора!")
        return
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")],
            [InlineKeyboardButton(text="👥 Пользователи", callback_data="admin_users")],
            [InlineKeyboardButton(text="🎁 Добавить предмет", callback_data="admin_add_item")],
            [InlineKeyboardButton(text="📦 Добавить кейс", callback_data="admin_add_case")],
            [InlineKeyboardButton(text="💰 Изменить баланс", callback_data="admin_balance")]
        ]
    )
    
    await message.answer("👑 <b>Админ панель</b>", reply_markup=keyboard, parse_mode=ParseMode.HTML)

@router.callback_query(F.data == "profile")
async def show_profile(callback: CallbackQuery):
    """Показать профиль"""
    user = await get_user(callback.from_user.id)
    
    async with db_pool.acquire() as conn:
        cases_opened = await conn.fetchval(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = $1",
            user["user_id"]
        )
    
    text = f"""
👤 <b>Профиль игрока</b>

📛 <b>Имя:</b> {user['first_name']} {user['last_name'] or ''}
👤 <b>Юзернейм:</b> @{user['username'] or 'Не указан'}
🆔 <b>ID:</b> <code>{user['user_id']}</code>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📊 <b>Открыто кейсов:</b> {cases_opened}
📅 <b>Дата регистрации:</b> {datetime.now().strftime('%d.%m.%Y')}
    """
    
    await callback.message.edit_text(text, parse_mode=ParseMode.HTML)
    await callback.answer()

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App"""
    try:
        print(f"🌐 Получены данные из Web App от пользователя {message.from_user.id}")
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        action = data.get('action')
        
        if action == 'init':
            user = await get_user(user_id)
            inventory = await get_inventory(user_id)
            cases = await get_cases()
            
            response = {
                'success': True,
                'user': user,
                'inventory': inventory,
                'cases': cases,
                'config': {
                    'min_bet': 10,
                    'max_bet': 10000,
                    'daily_bonus': 100,
                    'version': '1.0.0'
                }
            }
            
            await message.answer(json.dumps(response, default=str))
            print(f"📤 Отправлены данные инициализации пользователю {user_id}")
            
        elif action == 'open_case':
            case_id = data.get('case_id')
            print(f"🎰 Пользователь {user_id} открывает кейс {case_id}")
            
            result = await open_case(user_id, case_id)
            
            if 'error' in result:
                print(f"❌ Ошибка при открытии кейса: {result['error']}")
                await message.answer(json.dumps({'error': result['error']}))
                return
            
            if result['item']['rarity'] in ['epic', 'legendary']:
                notification = f"""
🎉 <b>УДАЧА В КЕЙСАХ!</b>

{message.from_user.first_name} получил предмет <b>{result['item']['rarity']}</b> редкости:

🏆 <b>{result['item']['name']}</b> {result['item']['icon']}
💰 <b>Стоимость:</b> {result['item']['price']} 💎

Поздравляем! 🎊
                """
                await message.answer(notification, parse_mode=ParseMode.HTML)
                print(f"🎉 Пользователь {user_id} получил редкий предмет: {result['item']['name']}")
            
            await message.answer(json.dumps(result, default=str))
            print(f"📤 Отправлен результат открытия кейса пользователю {user_id}")
            
        elif action == 'sync_balance':
            balance = data.get('balance')
            print(f"💰 Синхронизация баланса для пользователя {user_id}: {balance}")
            
            success = await sync_balance(user_id, balance)
            
            if success:
                response = {'success': True, 'message': 'Баланс синхронизирован'}
            else:
                response = {'success': False, 'message': 'Ошибка синхронизации'}
            
            await message.answer(json.dumps(response))
            print(f"✅ Баланс синхронизирован для пользователя {user_id}")
            
        elif action == 'get_balance':
            user = await get_user(user_id)
            response = {'success': True, 'balance': user['balance']}
            await message.answer(json.dumps(response))
            print(f"💰 Отправлен баланс пользователю {user_id}: {user['balance']}")
            
    except Exception as e:
        print(f"❌ Ошибка обработки Web App данных: {e}")
        error_msg = str(e) if DEBUG else "Произошла ошибка. Пожалуйста, попробуйте позже."
        await message.answer(json.dumps({'error': error_msg}))

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    print(f"❓ Получено неизвестное сообщение от {message.from_user.id}: {message.text}")
    await message.answer("🤔 Не понимаю вашу команду. Используйте /help для списка команд.")

async def main():
    """Основная функция запуска бота"""
    await init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"🤖 Токен: {'*' * len(BOT_TOKEN[:10])}...")
    print(f"👑 Админ ID: {ADMIN_ID}")
    print(f"🐛 Режим отладки: {DEBUG}")
    print(f"🗄️ База данных: PostgreSQL на Railway")
    print("=" * 50)
    print("✅ Бот успешно запущен!")
    print("⛏️ Ожидание команд...")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")
        raise
    finally:
        if db_pool:
            await db_pool.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")