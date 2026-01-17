import os
import asyncio
import json
import sqlite3
from datetime import datetime
from typing import Dict, List
import random
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
DB_PATH = os.getenv('DATABASE_URL', 'sqlite:///minecraft_cases.db').replace('sqlite:///', '')

# Проверка наличия обязательных переменных
if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

def init_db():
    """Инициализация базы данных"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Таблица пользователей
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        balance INTEGER DEFAULT 10000,
        experience INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица предметов Minecraft
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventory (
        inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_favorite BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE
    )
    ''')
    
    # Таблица кейсов
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS cases (
        case_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        icon TEXT NOT NULL,
        description TEXT,
        rarity_weights TEXT NOT NULL, -- JSON с весами редкостей
        texture_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица истории открытий
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS opening_history (
        history_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        case_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (case_id) REFERENCES cases(case_id),
        FOREIGN KEY (item_id) REFERENCES items(item_id)
    )
    ''')
    
    # Таблица транзакций
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward')),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')
    
    conn.commit()
    
    # Добавляем тестовые данные только если таблицы пустые
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        add_initial_data(cursor)
    
    conn.commit()
    conn.close()
    print(f"✅ База данных инициализирована: {DB_PATH}")

def add_initial_data(cursor):
    """Добавление начальных данных в БД"""
    print("📦 Добавление начальных данных...")
    
    # Minecraft предметы
    minecraft_items = [
        # Common - Еда
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает 2 единицы голода", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Восстанавливает 5 единиц голода", "bread.png"),
        ("Мясо", "🍖", "common", "food", 50, 25, "Восстанавливает 8 единиц голода", "meat.png"),
        ("Тыквенный пирог", "🥧", "common", "food", 60, 30, "Восстанавливает 8 единицы голода", "pie.png"),
        ("Золотое яблоко", "🍏", "uncommon", "food", 400, 200, "Даёт регенерацию здоровья", "golden_apple.png"),
        
        # Common - Ресурсы
        ("Уголь", "⚫", "common", "resources", 30, 15, "Топливо и краситель", "coal.png"),
        ("Железный слиток", "⛓️", "common", "resources", 50, 25, "Базовый ресурс для крафта", "iron.png"),
        ("Золотой слиток", "🟨", "common", "resources", 80, 40, "Редкий ресурс", "gold.png"),
        ("Красная пыль", "🔴", "common", "resources", 40, 20, "Для механизмов и зелий", "redstone.png"),
        
        # Uncommon
        ("Алмаз", "💎", "uncommon", "resources", 150, 75, "Ценный минерал", "diamond.png"),
        ("Изумруд", "🟩", "uncommon", "resources", 200, 100, "Торговая валюта", "emerald.png"),
        ("Лазурит", "🔵", "uncommon", "resources", 100, 50, "Для зачарования", "lapis.png"),
        
        # Uncommon - Оружие
        ("Железный меч", "⚔️", "uncommon", "weapons", 180, 90, "Базовое оружие", "iron_sword.png"),
        ("Лук", "🏹", "uncommon", "weapons", 120, 60, "Дальнобойное оружие", "bow.png"),
        ("Щит", "🛡️", "uncommon", "weapons", 150, 75, "Защита от атак", "shield.png"),
        
        # Rare
        ("Алмазный меч", "⚔️💎", "rare", "weapons", 250, 125, "Мощное оружие", "diamond_sword.png"),
        ("Алмазная кирка", "⛏️💎", "rare", "tools", 300, 150, "Быстрая добыча", "diamond_pickaxe.png"),
        ("Незеритовый слиток", "🔱", "rare", "resources", 500, 250, "Элитный материал", "netherite.png"),
        ("Элитра", "🧥", "rare", "special", 800, 400, "Позволяет летать", "elytra.png"),
        
        # Epic
        ("Тотем бессмертия", "🐦", "epic", "special", 1000, 500, "Спасение от смерти", "totem.png"),
        ("Сердце моря", "💙", "epic", "resources", 1200, 600, "Редкая реликвия", "heart.png"),
        ("Голова дракона", "🐲", "epic", "special", 1500, 750, "Трофей дракона", "dragon_head.png"),
        
        # Legendary
        ("Командный блок", "🟪", "legendary", "special", 5000, 2500, "Божественный предмет", "command_block.png"),
        ("Меч незера", "🗡️", "legendary", "weapons", 3000, 1500, "Легендарное оружие", "netherite_sword.png"),
        ("Корона власти", "👑", "legendary", "special", 10000, 5000, "Знак абсолютной власти", "crown.png"),
        ("Броня незера", "🛡️🔥", "legendary", "weapons", 4000, 2000, "Неуязвимая защита", "netherite_armor.png"),
    ]
    
    cursor.executemany(
        """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        minecraft_items
    )
    
    # Кейсы
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
    
    cursor.executemany(
        """INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        cases
    )
    
    print(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

def get_user(user_id: int) -> Dict:
    """Получение или создание пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT user_id, username, first_name, last_name, balance, experience, level 
           FROM users WHERE user_id = ?""",
        (user_id,)
    )
    
    user_data = cursor.fetchone()
    if not user_data:
        cursor.execute(
            """INSERT INTO users (user_id, balance, experience, level, last_login) 
               VALUES (?, 10000, 0, 1, CURRENT_TIMESTAMP)""",
            (user_id,)
        )
        conn.commit()
        
        # Создаем начальную транзакцию
        cursor.execute(
            """INSERT INTO transactions (user_id, type, amount, description) 
               VALUES (?, 'reward', 10000, 'Стартовый бонус')""",
            (user_id,)
        )
        conn.commit()
        
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance, experience, level 
               FROM users WHERE user_id = ?""",
            (user_id,)
        )
        user_data = cursor.fetchone()
    
    conn.close()
    
    return {
        "user_id": user_data[0],
        "username": user_data[1],
        "first_name": user_data[2],
        "last_name": user_data[3],
        "balance": user_data[4],
        "experience": user_data[5],
        "level": user_data[6]
    }

def update_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> int:
    """Обновление баланса пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE users SET balance = balance + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, ?, ?, ?)""",
        (user_id, transaction_type, amount, description)
    )
    
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    new_balance = cursor.fetchone()[0]
    
    conn.commit()
    conn.close()
    
    return new_balance

def get_inventory(user_id: int) -> List[Dict]:
    """Получение инвентаря пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price, 
           i.description, i.texture_url, inv.quantity, inv.obtained_at, inv.is_favorite
    FROM inventory inv
    JOIN items i ON inv.item_id = i.item_id
    WHERE inv.user_id = ?
    ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
    ''', (user_id,))
    
    inventory = []
    for row in cursor.fetchall():
        inventory.append({
            "id": row[0],
            "name": row[1],
            "icon": row[2],
            "rarity": row[3],
            "category": row[4],
            "price": row[5],
            "sell_price": row[6],
            "description": row[7],
            "texture_url": row[8],
            "quantity": row[9],
            "obtained_at": row[10],
            "is_favorite": bool(row[11])
        })
    
    conn.close()
    return inventory

def get_cases() -> List[Dict]:
    """Получение списка кейсов"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT case_id, name, price, icon, description, rarity_weights, texture_url FROM cases WHERE is_active = TRUE"
    )
    
    cases = []
    for row in cursor.fetchall():
        cases.append({
            "id": row[0],
            "name": row[1],
            "price": row[2],
            "icon": row[3],
            "description": row[4],
            "rarity_weights": json.loads(row[5]),
            "texture_url": row[6]
        })
    
    conn.close()
    return cases

def open_case(user_id: int, case_id: int) -> Dict:
    """Открытие кейса"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем информацию о кейсе
    cursor.execute(
        "SELECT name, price, rarity_weights FROM cases WHERE case_id = ?",
        (case_id,)
    )
    case_data = cursor.fetchone()
    
    if not case_data:
        conn.close()
        return {"error": "Кейс не найден"}
    
    case_name, case_price, rarity_weights_json = case_data
    rarity_weights = json.loads(rarity_weights_json)
    
    # Получаем предметы по редкости
    total_weight = sum(rarity_weights.values())
    random_value = random.uniform(0, total_weight)
    
    selected_rarity = None
    cumulative_weight = 0
    for rarity, weight in rarity_weights.items():
        cumulative_weight += weight
        if random_value <= cumulative_weight:
            selected_rarity = rarity
            break
    
    # Получаем случайный предмет выбранной редкости
    cursor.execute(
        """SELECT item_id, name, icon, rarity, price, description, texture_url 
           FROM items WHERE rarity = ? ORDER BY RANDOM() LIMIT 1""",
        (selected_rarity,)
    )
    
    item_data = cursor.fetchone()
    if not item_data:
        conn.close()
        return {"error": "Не удалось выбрать предмет"}
    
    item = {
        "id": item_data[0],
        "name": item_data[1],
        "icon": item_data[2],
        "rarity": item_data[3],
        "price": item_data[4],
        "description": item_data[5],
        "texture_url": item_data[6]
    }
    
    # Проверяем баланс
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    balance_result = cursor.fetchone()
    if not balance_result:
        conn.close()
        return {"error": "Пользователь не найден"}
    
    balance = balance_result[0]
    
    if balance < case_price:
        conn.close()
        return {"error": "Недостаточно средств"}
    
    # Списание средств
    new_balance = update_balance(
        user_id, -case_price, "purchase", 
        f"Покупка кейса: {case_name}"
    )
    
    # Добавляем предмет в инвентарь
    cursor.execute(
        """INSERT INTO inventory (user_id, item_id) 
           VALUES (?, ?)""",
        (user_id, item["id"])
    )
    
    # Получаем ID добавленного предмета
    inventory_id = cursor.lastrowid
    
    # Добавляем в историю открытий
    cursor.execute(
        """INSERT INTO opening_history (user_id, case_id, item_id) 
           VALUES (?, ?, ?)""",
        (user_id, case_id, item["id"])
    )
    
    # Начисляем опыт
    experience_gained = case_price // 10
    cursor.execute(
        "UPDATE users SET experience = experience + ? WHERE user_id = ?",
        (experience_gained, user_id)
    )
    
    # Получаем обновленные данные пользователя
    cursor.execute(
        "SELECT balance, experience, level FROM users WHERE user_id = ?",
        (user_id,)
    )
    updated_user = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "item": item,
        "new_balance": updated_user[0],
        "experience_gained": experience_gained,
        "case_price": case_price,
        "inventory_id": inventory_id
    }

# Обработчики команд
@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 Получена команда /start от пользователя {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    
    # Обновляем время последнего входа
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
        (user["user_id"],)
    )
    conn.commit()
    conn.close()
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⛏️ Открыть Minecraft Кейсы",
                    web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
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
    
    # Получаем статистику открытий
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user["user_id"],)
    )
    cases_opened = cursor.fetchone()[0]
    conn.close()
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
🏆 <b>Открыто кейсов:</b> {cases_opened} (/stats)

<code>Нажмите кнопку ниже чтобы открыть веб-приложение!</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлен ответ пользователю {message.from_user.id}")

@router.message(Command("daily"))
async def cmd_daily(message: Message):
    """Ежедневный бонус"""
    print(f"📥 Получена команда /daily от пользователя {message.from_user.id}")
    
    user_id = message.from_user.id
    user = get_user(user_id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Проверяем, получал ли пользователь бонус сегодня
    cursor.execute(
        """SELECT created_at FROM transactions 
           WHERE user_id = ? AND type = 'reward' AND description = 'Ежедневный бонус'
           ORDER BY created_at DESC LIMIT 1""",
        (user_id,)
    )
    
    last_daily = cursor.fetchone()
    
    if last_daily:
        # SQLite возвращает строку, преобразуем в datetime
        last_date = datetime.strptime(last_daily[0], '%Y-%m-%d %H:%M:%S')
        if last_date.date() == datetime.now().date():
            await message.answer("🎁 Вы уже получали ежедневный бонус сегодня!")
            conn.close()
            return
    
    # Начисляем бонус
    daily_amount = 100
    new_balance = update_balance(
        user_id, daily_amount, "reward", "Ежедневный бонус"
    )
    
    text = f"""
🎁 <b>Ежедневный бонус получен!</b>

💰 +{daily_amount} 💎 добавлено на баланс
📈 <b>Новый баланс:</b> {new_balance} 💎

🕐 Следующий бонус через 24 часа!
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)
    conn.close()
    print(f"📤 Начислен ежедневный бонус пользователю {user_id}")

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    print(f"📥 Получена команда /balance от пользователя {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    inventory = get_inventory(user["user_id"])
    
    text = f"""
💰 <b>Статистика аккаунта</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📦 <b>Предметов в инвентаре:</b> {len(inventory)}
📊 <b>Общая стоимость:</b> {sum(item['price'] for item in inventory)} 💎
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлена статистика пользователю {message.from_user.id}")

@router.message(Command("inventory"))
async def cmd_inventory(message: Message):
    """Просмотр инвентаря"""
    print(f"📥 Получена команда /inventory от пользователя {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    inventory = get_inventory(user["user_id"])
    
    if not inventory:
        await message.answer("🎒 <b>Ваш инвентарь пуст!</b>\n\nОткройте кейсы, чтобы получить предметы! ⛏️", parse_mode=ParseMode.HTML)
        return
    
    # Группируем предметы по редкости
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
    
    # Добавляем предметы по редкостям
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
    
    cases = get_cases()
    
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
    
    text += """
\n📱 <b>Для открытия кейсов используйте веб-приложение!</b>
"""
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.callback_query(F.data == "profile")
async def show_profile(callback: CallbackQuery):
    """Показать профиль"""
    user = get_user(callback.from_user.id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user["user_id"],)
    )
    cases_opened = cursor.fetchone()[0]
    conn.close()
    
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
        
        if data.get('action') == 'init':
            # Инициализация приложения
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            cases = get_cases()
            
            response = {
                'success': True,
                'user': {
                    'balance': user['balance'],
                    'experience': user['experience'],
                    'level': user['level']
                },
                'inventory': inventory,
                'cases': cases,
                'config': {
                    'min_bet': 10,
                    'max_bet': 10000,
                    'daily_bonus': 100,
                    'version': '1.0.0'
                }
            }
            
            await message.answer(json.dumps(response))
            print(f"📤 Отправлены данные инициализации пользователю {user_id}")
            
        elif data.get('action') == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            print(f"🎰 Пользователь {user_id} открывает кейс {case_id}")
            
            result = open_case(user_id, case_id)
            
            if 'error' in result:
                print(f"❌ Ошибка при открытии кейса: {result['error']}")
                await message.answer(json.dumps({'success': False, 'error': result['error']}))
                return
            
            # Отправляем уведомление для редких предметов
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
            
            # Получаем обновленный инвентарь
            inventory = get_inventory(user_id)
            result['inventory'] = inventory
            
            await message.answer(json.dumps(result))
            print(f"📤 Отправлен результат открытия кейса пользователю {user_id}")
            
        elif data.get('action') == 'sell_item':
            # Продажа предмета
            item_id = data.get('item_id')
            print(f"💰 Пользователь {user_id} продает предмет {item_id}")
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Получаем цену предмета
            cursor.execute("SELECT sell_price, name FROM items WHERE item_id = ?", (item_id,))
            item_data = cursor.fetchone()
            
            if not item_data:
                await message.answer(json.dumps({'success': False, 'error': 'Предмет не найден'}))
                conn.close()
                return
            
            # Удаляем предмет из инвентаря
            cursor.execute(
                "DELETE FROM inventory WHERE user_id = ? AND item_id = ? LIMIT 1",
                (user_id, item_id)
            )
            
            if cursor.rowcount == 0:
                await message.answer(json.dumps({'success': False, 'error': 'Предмет не найден в инвентаре'}))
                conn.close()
                return
            
            # Добавляем деньги
            sell_price, item_name = item_data
            new_balance = update_balance(
                user_id, sell_price, "reward", f"Продажа предмета: {item_name}"
            )
            
            # Получаем обновленный инвентарь
            inventory = get_inventory(user_id)
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': new_balance,
                'inventory': inventory
            }
            
            await message.answer(json.dumps(response))
            conn.commit()
            conn.close()
            print(f"💰 Пользователь {user_id} продал предмет за {sell_price} 💎")
            
        elif data.get('action') == 'sync_data':
            # Синхронизация данных
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            cases = get_cases()
            
            response = {
                'success': True,
                'user': {
                    'balance': user['balance'],
                    'experience': user['experience'],
                    'level': user['level']
                },
                'inventory': inventory,
                'cases': cases
            }
            
            await message.answer(json.dumps(response))
            print(f"🔄 Синхронизированы данные пользователя {user_id}")
            
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка декодирования JSON: {e}")
        await message.answer(json.dumps({'success': False, 'error': 'Неверный формат данных'}))
    except Exception as e:
        print(f"❌ Ошибка обработки Web App данных: {e}")
        if DEBUG:
            error_msg = str(e)
        else:
            error_msg = "Произошла ошибка. Пожалуйста, попробуйте позже."
        
        await message.answer(json.dumps({'success': False, 'error': error_msg}))

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    print(f"❓ Получено неизвестное сообщение от {message.from_user.id}: {message.text}")
    await message.answer("🤔 Не понимаю вашу команду. Используйте /help для списка команд.")

async def main():
    """Основная функция запуска бота"""
    # Инициализация базы данных
    init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"🤖 Токен: {'*' * len(BOT_TOKEN[:10])}...")
    print(f"👑 Админ ID: {ADMIN_ID}")
    print(f"🐛 Режим отладки: {DEBUG}")
    print(f"🗄️ База данных: {DB_PATH}")
    print("=" * 50)
    print("✅ Бот успешно запущен!")
    print("⛏️ Ожидание команд...")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")