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
    InlineKeyboardButton, WebAppInfo, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton
)
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder

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

# Хранилище для сообщений пользователей
user_messages = {}

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
        cases_opened INTEGER DEFAULT 0,
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
        """SELECT user_id, username, first_name, last_name, balance, experience, level, cases_opened 
           FROM users WHERE user_id = ?""",
        (user_id,)
    )
    
    user_data = cursor.fetchone()
    if not user_data:
        cursor.execute(
            """INSERT INTO users (user_id, balance, experience, level, cases_opened, last_login) 
               VALUES (?, 10000, 0, 1, 0, CURRENT_TIMESTAMP)""",
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
            """SELECT user_id, username, first_name, last_name, balance, experience, level, cases_opened 
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
        "level": user_data[6],
        "cases_opened": user_data[7]
    }

def update_user_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> Dict:
    """Обновление баланса пользователя и возврат полных данных"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Обновляем баланс
    cursor.execute(
        "UPDATE users SET balance = balance + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    # Добавляем транзакцию
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, ?, ?, ?)""",
        (user_id, transaction_type, amount, description)
    )
    
    # Получаем обновленные данные пользователя
    cursor.execute(
        """SELECT balance, experience, level, cases_opened 
           FROM users WHERE user_id = ?""",
        (user_id,)
    )
    updated_data = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return {
        "balance": updated_data[0],
        "experience": updated_data[1],
        "level": updated_data[2],
        "cases_opened": updated_data[3]
    }

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
    
    # Списание средств и обновление счетчика кейсов
    cursor.execute(
        """UPDATE users 
           SET balance = balance - ?, 
               cases_opened = cases_opened + 1 
           WHERE user_id = ?""",
        (case_price, user_id)
    )
    
    # Добавляем транзакцию
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, 'purchase', ?, ?)""",
        (user_id, -case_price, f"Покупка кейса: {case_name}")
    )
    
    # Добавляем предмет в инвентарь
    cursor.execute(
        """INSERT INTO inventory (user_id, item_id) 
           VALUES (?, ?)""",
        (user_id, item["id"])
    )
    
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
    
    # Проверяем повышение уровня
    cursor.execute(
        "SELECT experience, level FROM users WHERE user_id = ?",
        (user_id,)
    )
    user_exp, user_level = cursor.fetchone()
    
    # Проверяем нужно ли повысить уровень (1000 опыта за уровень)
    new_level = user_level
    while user_exp >= new_level * 1000:
        new_level += 1
    
    if new_level > user_level:
        cursor.execute(
            "UPDATE users SET level = ? WHERE user_id = ?",
            (new_level, user_id)
        )
    
    # Получаем обновленные данные пользователя
    cursor.execute(
        "SELECT balance, experience, level, cases_opened FROM users WHERE user_id = ?",
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
        "experience": updated_user[1],
        "level": updated_user[2],
        "cases_opened": updated_user[3]
    }
}

def get_user_full_data(user_id: int) -> Dict:
    """Получение полных данных пользователя для веб-приложения"""
    user = get_user(user_id)
    inventory = get_inventory(user_id)
    cases = get_cases()
    
    return {
        "user": {
            "balance": user["balance"],
            "experience": user["experience"],
            "level": user["level"],
            "cases_opened": user["cases_opened"]
        },
        "inventory": inventory,
        "cases": cases
    }
}

# Создаем клавиатуру для основного меню с кнопкой веб-приложения
def create_main_keyboard():
    """Создание основной клавиатуры с кнопкой веб-приложения"""
    builder = ReplyKeyboardBuilder()
    builder.add(
        KeyboardButton(
            text="⛏️ Открыть веб-приложение", 
            web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
        )
    )
    builder.adjust(1)
    return builder.as_markup(resize_keyboard=True, one_time_keyboard=False)

# Функции для создания inline-клавиатур
def create_main_inline_keyboard():
    """Создание основной inline-клавиатуры"""
    keyboard = [
        [
            InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
            InlineKeyboardButton(text="💰 Баланс", callback_data="balance")
        ],
        [
            InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory"),
            InlineKeyboardButton(text="📦 Кейсы", callback_data="cases")
        ],
        [
            InlineKeyboardButton(text="🎁 Ежедневный бонус", callback_data="daily"),
            InlineKeyboardButton(text="📊 Статистика", callback_data="stats")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def create_back_keyboard(back_to: str = "main"):
    """Создание клавиатуры с кнопкой Назад"""
    keyboard = [
        [InlineKeyboardButton(text="🔙 Назад", callback_data=f"back_{back_to}")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def create_profile_keyboard():
    """Создание клавиатуры для профиля"""
    keyboard = [
        [
            InlineKeyboardButton(text="💰 Пополнить", callback_data="deposit"),
            InlineKeyboardButton(text="📊 Статистика", callback_data="stats")
        ],
        [
            InlineKeyboardButton(text="🎁 Ежедневный бонус", callback_data="daily"),
            InlineKeyboardButton(text="📦 Кейсы", callback_data="cases")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="back_main")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def create_balance_keyboard():
    """Создание клавиатуры для баланса"""
    keyboard = [
        [
            InlineKeyboardButton(text="💰 Пополнить", callback_data="deposit"),
            InlineKeyboardButton(text="📈 История", callback_data="transactions")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="back_main")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def create_inventory_keyboard():
    """Создание клавиатуры для инвентаря"""
    keyboard = [
        [
            InlineKeyboardButton(text="💰 Продать предметы", callback_data="sell_items"),
            InlineKeyboardButton(text="⭐ Избранное", callback_data="favorites")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="back_main")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

def create_cases_keyboard():
    """Создание клавиатуры для кейсов"""
    keyboard = [
        [
            InlineKeyboardButton(text="💰 Купить кристаллы", callback_data="buy_gems"),
            InlineKeyboardButton(text="🎁 Промокод", callback_data="promo")
        ],
        [
            InlineKeyboardButton(text="🔙 Назад", callback_data="back_main")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=keyboard)

# Сохраняем ID сообщения пользователя
def save_user_message(user_id: int, message_id: int):
    """Сохранение ID сообщения пользователя"""
    user_messages[user_id] = message_id

def get_user_message(user_id: int):
    """Получение ID сообщения пользователя"""
    return user_messages.get(user_id)

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
    
    # Получаем статистику
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM inventory WHERE user_id = ?",
        (user["user_id"],)
    )
    items_count = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT SUM(i.price * inv.quantity) FROM inventory inv JOIN items i ON inv.item_id = i.item_id WHERE inv.user_id = ?",
        (user["user_id"],)
    )
    total_value_result = cursor.fetchone()
    total_value = total_value_result[0] if total_value_result[0] else 0
    conn.close()
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

📦 <b>Предметов в инвентаре:</b> {items_count}
💼 <b>Общая стоимость:</b> {total_value} 💎
🎁 <b>Открыто кейсов:</b> {user['cases_opened']}

<b>Используйте кнопки ниже для управления аккаунтом:</b>
    """
    
    # Отправляем сообщение с inline-клавиатурой
    sent_message = await message.answer(text, reply_markup=create_main_inline_keyboard(), parse_mode=ParseMode.HTML)
    
    # Сохраняем ID сообщения
    save_user_message(message.from_user.id, sent_message.message_id)
    
    # Отправляем клавиатуру с одной кнопкой веб-приложения
    await message.answer("Нажмите кнопку ниже, чтобы открыть веб-приложение:", reply_markup=create_main_keyboard())
    
    print(f"📤 Отправлен ответ пользователю {message.from_user.id}")

# Функция для отправки/редактирования сообщения
async def send_or_edit_message(user_id: int, text: str, reply_markup=None):
    """Отправка или редактирование сообщения пользователя"""
    message_id = get_user_message(user_id)
    
    if message_id:
        try:
            # Пытаемся отредактировать существующее сообщение
            await bot.edit_message_text(
                chat_id=user_id,
                message_id=message_id,
                text=text,
                reply_markup=reply_markup,
                parse_mode=ParseMode.HTML
            )
            return
        except Exception as e:
            print(f"❌ Ошибка редактирования сообщения: {e}")
    
    # Если не удалось отредактировать, отправляем новое
    sent_message = await bot.send_message(
        chat_id=user_id,
        text=text,
        reply_markup=reply_markup,
        parse_mode=ParseMode.HTML
    )
    
    # Сохраняем ID нового сообщения
    save_user_message(user_id, sent_message.message_id)

# Обработчики callback-запросов
@router.callback_query(F.data == "profile")
async def show_profile(callback: CallbackQuery):
    """Показать профиль"""
    user = get_user(callback.from_user.id)
    
    # Получаем дополнительную статистику
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT COUNT(*) FROM inventory WHERE user_id = ?",
        (user["user_id"],)
    )
    items_count = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT SUM(i.price * inv.quantity) FROM inventory inv JOIN items i ON inv.item_id = i.item_id WHERE inv.user_id = ?",
        (user["user_id"],)
    )
    total_value_result = cursor.fetchone()
    total_value = total_value_result[0] if total_value_result[0] else 0
    
    # Получаем самый редкий предмет
    cursor.execute('''
    SELECT i.name, i.icon, i.rarity, i.price 
    FROM inventory inv 
    JOIN items i ON inv.item_id = i.item_id 
    WHERE inv.user_id = ? 
    ORDER BY 
        CASE i.rarity 
            WHEN 'legendary' THEN 1
            WHEN 'epic' THEN 2
            WHEN 'rare' THEN 3
            WHEN 'uncommon' THEN 4
            WHEN 'common' THEN 5
        END,
        i.price DESC
    LIMIT 1
    ''', (user["user_id"],))
    
    rarest_item = cursor.fetchone()
    conn.close()
    
    # Форматируем самый редкий предмет
    rarest_item_text = ""
    if rarest_item:
        name, icon, rarity, price = rarest_item
        rarity_icon = {
            'legendary': '🟡',
            'epic': '🟣',
            'rare': '🔵',
            'uncommon': '🟢',
            'common': '⚪'
        }.get(rarity, '⚪')
        
        rarest_item_text = f"{icon} {name} {rarity_icon} - {price} 💎"
    else:
        rarest_item_text = "🎒 Инвентарь пуст"
    
    text = f"""
<b>👤 ПРОФИЛЬ ИГРОКА</b>

<b>📛 Имя:</b> {user['first_name']} {user['last_name'] or ''}
<b>👤 Юзернейм:</b> @{user['username'] or 'Не указан'}
<b>🆔 ID:</b> <code>{user['user_id']}</code>

<b>💰 Баланс:</b> {user['balance']} 💎
<b>🎮 Уровень:</b> {user['level']}
<b>⭐ Опыт:</b> {user['experience']} / {user['level'] * 1000}
<b>📦 Предметов:</b> {items_count}
<b>💼 Общая стоимость:</b> {total_value} 💎
<b>🎁 Открыто кейсов:</b> {user['cases_opened']}

<b>🏆 Самый редкий предмет:</b>
{rarest_item_text}

<b>📅 Дата регистрации:</b> {datetime.now().strftime('%d.%m.%Y')}
    """
    
    await send_or_edit_message(callback.from_user.id, text, create_profile_keyboard())
    await callback.answer()

@router.callback_query(F.data == "balance")
async def show_balance(callback: CallbackQuery):
    """Показать баланс"""
    user = get_user(callback.from_user.id)
    
    # Получаем последние транзакции
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """SELECT type, amount, description, created_at 
           FROM transactions 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT 3""",
        (user["user_id"],)
    )
    
    transactions = cursor.fetchall()
    conn.close()
    
    transactions_text = ""
    if transactions:
        for trans in transactions:
            trans_type, amount, description, created_at = trans
            icon = "🟢" if amount > 0 else "🔴"
            sign = "+" if amount > 0 else ""
            date = datetime.strptime(created_at, '%Y-%m-%d %H:%M:%S').strftime('%d.%m')
            transactions_text += f"{icon} {sign}{amount} 💎 - {description} ({date})\n"
    else:
        transactions_text = "История транзакций пуста\n"
    
    text = f"""
<b>💰 БАЛАНС АККАУНТА</b>

<b>👤 Игрок:</b> {callback.from_user.first_name}
<b>💎 Текущий баланс:</b> {user['balance']} 💎

<b>📊 Последние операции:</b>
{transactions_text}

<b>💡 Совет:</b> Пополняйте баланс через веб-приложение для мгновенного зачисления!
    """
    
    await send_or_edit_message(callback.from_user.id, text, create_balance_keyboard())
    await callback.answer()

@router.callback_query(F.data == "inventory")
async def show_inventory(callback: CallbackQuery):
    """Показать инвентарь"""
    user = get_user(callback.from_user.id)
    inventory = get_inventory(user["user_id"])
    
    if not inventory:
        text = """
<b>🎒 ВАШ ИНВЕНТАРЬ</b>

Ваш инвентарь пуст! 😢

Откройте кейсы в веб-приложении, чтобы получить предметы! ⛏️
        """
        
        await send_or_edit_message(callback.from_user.id, text, create_inventory_keyboard())
        await callback.answer()
        return
    
    # Группируем предметы по редкости
    items_by_rarity = {}
    for item in inventory:
        rarity = item['rarity']
        if rarity not in items_by_rarity:
            items_by_rarity[rarity] = []
        items_by_rarity[rarity].append(item)
    
    # Считаем общую стоимость
    total_value = sum(item['price'] * item['quantity'] for item in inventory)
    
    text = f"""
<b>🎒 ВАШ ИНВЕНТАРЬ</b>

<b>👤 Игрок:</b> {callback.from_user.first_name}
<b>📦 Всего предметов:</b> {len(inventory)}
<b>💰 Общая стоимость:</b> {total_value} 💎
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
            count = len(items_by_rarity[rarity])
            total_price = sum(item['price'] * item['quantity'] for item in items_by_rarity[rarity])
            text += f"\n<b>{rarity_names[rarity]}:</b> {count} предметов на {total_price} 💎"
    
    text += "\n\n<b>📱 Для детального просмотра используйте веб-приложение!</b>"
    
    await send_or_edit_message(callback.from_user.id, text, create_inventory_keyboard())
    await callback.answer()

@router.callback_query(F.data == "cases")
async def show_cases(callback: CallbackQuery):
    """Показать кейсы"""
    cases = get_cases()
    user = get_user(callback.from_user.id)
    
    text = f"""
<b>📦 ДОСТУПНЫЕ КЕЙСЫ</b>

<b>💰 Ваш баланс:</b> {user['balance']} 💎
<b>🎮 Ваш уровень:</b> {user['level']}

"""
    
    for i, case in enumerate(cases[:3], 1):  # Показываем только 3 кейса
        rarity_weights = case['rarity_weights']
        
        # Форматируем шансы
        chances = []
        for rarity, weight in rarity_weights.items():
            percentage = (weight / sum(rarity_weights.values())) * 100
            if percentage > 0:
                rarity_icons = {
                    'common': '⚪',
                    'uncommon': '🟢',
                    'rare': '🔵',
                    'epic': '🟣',
                    'legendary': '🟡'
                }
                chances.append(f"{rarity_icons.get(rarity, '⚪')}{percentage:.0f}%")
        
        text += f"""
<b>{case['icon']} {case['name']}</b> - {case['price']} 💎
{case['description']}
Шансы: {' | '.join(chances)}
"""
    
    if len(cases) > 3:
        text += f"\n... и еще {len(cases) - 3} кейсов"
    
    text += """
<b>📱 Для открытия кейсов используйте веб-приложение!</b>
"""
    
    await send_or_edit_message(callback.from_user.id, text, create_cases_keyboard())
    await callback.answer()

@router.callback_query(F.data == "daily")
async def show_daily(callback: CallbackQuery):
    """Ежедневный бонус"""
    user_id = callback.from_user.id
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
            text = """
<b>🎁 ЕЖЕДНЕВНЫЙ БОНУС</b>

Вы уже получали ежедневный бонус сегодня! ❌

Приходите завтра за новой наградой! ⏰
            """
            await send_or_edit_message(user_id, text, create_back_keyboard("main"))
            conn.close()
            await callback.answer()
            return
    
    # Начисляем бонус
    daily_amount = 100
    updated_data = update_user_balance(
        user_id, daily_amount, "reward", "Ежедневный бонус"
    )
    
    text = f"""
<b>🎁 ЕЖЕДНЕВНЫЙ БОНУС ПОЛУЧЕН!</b>

💰 +{daily_amount} 💎 добавлено на баланс
📈 <b>Новый баланс:</b> {updated_data['balance']} 💎

⭐ +50 XP получено опыта
🎮 <b>Уровень:</b> {updated_data['level']}
📊 <b>Опыт:</b> {updated_data['experience']} / {updated_data['level'] * 1000}

🕐 <b>Следующий бонус через 24 часа!</b>
    """
    
    await send_or_edit_message(user_id, text, create_back_keyboard("main"))
    conn.close()
    await callback.answer()
    print(f"📤 Начислен ежедневный бонус пользователю {user_id}")

@router.callback_query(F.data == "stats")
async def show_stats(callback: CallbackQuery):
    """Статистика аккаунта"""
    user = get_user(callback.from_user.id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем подробную статистику
    cursor.execute(
        """SELECT COUNT(DISTINCT item_id) FROM inventory WHERE user_id = ?""",
        (user["user_id"],)
    )
    unique_items = cursor.fetchone()[0]
    
    cursor.execute(
        """SELECT COUNT(*) FROM opening_history WHERE user_id = ?""",
        (user["user_id"],)
    )
    total_openings = cursor.fetchone()[0]
    
    cursor.execute(
        """SELECT COUNT(*) FROM inventory WHERE user_id = ? AND is_favorite = 1""",
        (user["user_id"],)
    )
    favorite_items = cursor.fetchone()[0]
    
    cursor.execute(
        """SELECT SUM(amount) FROM transactions WHERE user_id = ? AND type = 'purchase'""",
        (user["user_id"],)
    )
    spent_result = cursor.fetchone()
    total_spent = abs(spent_result[0]) if spent_result[0] else 0
    
    cursor.execute(
        """SELECT SUM(amount) FROM transactions WHERE user_id = ? AND type = 'reward'""",
        (user["user_id"],)
    )
    earned_result = cursor.fetchone()
    total_earned = earned_result[0] if earned_result[0] else 0
    
    # Получаем самый редкий предмет
    cursor.execute('''
    SELECT i.name, i.icon, i.rarity, i.price 
    FROM inventory inv 
    JOIN items i ON inv.item_id = i.item_id 
    WHERE inv.user_id = ? 
    ORDER BY 
        CASE i.rarity 
            WHEN 'legendary' THEN 1
            WHEN 'epic' THEN 2
            WHEN 'rare' THEN 3
            WHEN 'uncommon' THEN 4
            WHEN 'common' THEN 5
        END,
        i.price DESC
    LIMIT 1
    ''', (user["user_id"],))
    
    rarest_item = cursor.fetchone()
    conn.close()
    
    # Форматируем самый редкий предмет
    rarest_item_text = ""
    if rarest_item:
        name, icon, rarity, price = rarest_item
        rarity_names = {
            'legendary': '🟡 Легендарный',
            'epic': '🟣 Эпический',
            'rare': '🔵 Редкий',
            'uncommon': '🟢 Необычный',
            'common': '⚪ Обычный'
        }
        rarest_item_text = f"{icon} {name} ({rarity_names.get(rarity, rarity)}) - {price} 💎"
    else:
        rarest_item_text = "Нет предметов"
    
    text = f"""
<b>📊 СТАТИСТИКА АККАУНТА</b>

<b>👤 Игрок:</b> {callback.from_user.first_name}
<b>🆔 ID:</b> <code>{user['user_id']}</code>

<b>💰 Финансы:</b>
• Баланс: {user['balance']} 💎
• Всего получено: {total_earned} 💎
• Всего потрачено: {total_spent} 💎
• Чистая прибыль: {total_earned - total_spent} 💎

<b>🎮 Прогресс:</b>
• Уровень: {user['level']}
• Опыт: {user['experience']} / {user['level'] * 1000}
• Открыто кейсов: {total_openings}
• Уникальных предметов: {unique_items}
• В избранном: {favorite_items}

<b>🏆 Самый редкий предмет:</b>
{rarest_item_text}

<b>📅 Аккаунт создан:</b> {datetime.now().strftime('%d.%m.%Y')}
<b>🕐 В сети:</b> Сейчас онлайн
    """
    
    await send_or_edit_message(callback.from_user.id, text, create_back_keyboard("main"))
    await callback.answer()

# Обработчики кнопок "Назад"
@router.callback_query(F.data.startswith("back_"))
async def handle_back(callback: CallbackQuery):
    """Обработка кнопки Назад"""
    back_to = callback.data.split("_")[1]
    
    if back_to == "main":
        user = get_user(callback.from_user.id)
        
        # Получаем статистику
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM inventory WHERE user_id = ?",
            (user["user_id"],)
        )
        items_count = cursor.fetchone()[0]
        
        cursor.execute(
            "SELECT SUM(i.price * inv.quantity) FROM inventory inv JOIN items i ON inv.item_id = i.item_id WHERE inv.user_id = ?",
            (user["user_id"],)
        )
        total_value_result = cursor.fetchone()
        total_value = total_value_result[0] if total_value_result[0] else 0
        conn.close()
        
        text = f"""
⛏️ <b>Главное меню</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

📦 <b>Предметов в инвентаре:</b> {items_count}
💼 <b>Общая стоимость:</b> {total_value} 💎
🎁 <b>Открыто кейсов:</b> {user['cases_opened']}

<b>Выберите действие:</b>
        """
        
        await send_or_edit_message(callback.from_user.id, text, create_main_inline_keyboard())
    
    await callback.answer()

# Специальная функция для обработки запросов от веб-приложения
async def handle_webapp_request(user_id: int, data: dict) -> dict:
    """Обработка запроса от веб-приложения"""
    try:
        action = data.get('action')
        print(f"🌐 Обработка запроса от веб-приложения: {action} от пользователя {user_id}")
        
        if action == 'init':
            # Инициализация данных
            webapp_data = get_user_full_data(user_id)
            webapp_data['success'] = True
            webapp_data['config'] = {
                'min_bet': 10,
                'max_bet': 10000,
                'daily_bonus': 100,
                'version': '1.0.0'
            }
            print(f"📤 Отправлены данные инициализации пользователю {user_id}")
            return webapp_data
            
        elif action == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            print(f"🎰 Пользователь {user_id} открывает кейс {case_id}")
            
            result = open_case(user_id, case_id)
            
            if 'error' in result:
                print(f"❌ Ошибка при открытии кейса: {result['error']}")
                return {'success': False, 'error': result['error']}
            
            # Добавляем дополнительные данные
            webapp_data = get_user_full_data(user_id)
            result.update(webapp_data)
            
            print(f"✅ Кейс успешно открыт пользователем {user_id}")
            return result
            
        elif action == 'sell_item':
            # Продажа предмета
            item_id = data.get('item_id')
            print(f"💰 Пользователь {user_id} продает предмет {item_id}")
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Получаем цену предмета
            cursor.execute("SELECT sell_price, name FROM items WHERE item_id = ?", (item_id,))
            item_data = cursor.fetchone()
            
            if not item_data:
                conn.close()
                return {'success': False, 'error': 'Предмет не найден'}
            
            # Удаляем предмет из инвентаря
            cursor.execute(
                "DELETE FROM inventory WHERE user_id = ? AND item_id = ? LIMIT 1",
                (user_id, item_id)
            )
            
            if cursor.rowcount == 0:
                conn.close()
                return {'success': False, 'error': 'Предмет не найден в инвентаре'}
            
            # Добавляем деньги
            sell_price, item_name = item_data
            updated_data = update_user_balance(
                user_id, sell_price, "reward", f"Продажа предмета: {item_name}"
            )
            
            # Получаем обновленные данные
            webapp_data = get_user_full_data(user_id)
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': updated_data['balance']
            }
            response.update(webapp_data)
            
            conn.commit()
            conn.close()
            print(f"✅ Предмет продан пользователем {user_id}")
            return response
            
        elif action == 'sync_data':
            # Синхронизация данных
            webapp_data = get_user_full_data(user_id)
            webapp_data['success'] = True
            print(f"📊 Синхронизированы данные пользователя {user_id}")
            return webapp_data
            
        else:
            # Неизвестное действие
            print(f"❌ Неизвестное действие от веб-приложения: {action}")
            return {'success': False, 'error': 'Неизвестное действие'}
            
    except Exception as e:
        print(f"❌ Ошибка обработки запроса от веб-приложения: {e}")
        import traceback
        traceback.print_exc()
        
        return {'success': False, 'error': 'Произошла ошибка на сервере'}

# Основной обработчик данных из веб-приложения
@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App"""
    try:
        print(f"🌐 Получены данные из Web App от пользователя {message.from_user.id}")
        
        # Проверяем, есть ли данные
        if not hasattr(message, 'web_app_data') or not message.web_app_data:
            print(f"❌ Нет данных web_app_data в сообщении")
            await message.answer(json.dumps({'success': False, 'error': 'Нет данных'}), parse_mode=None)
            return
        
        # Получаем данные
        data_str = message.web_app_data.data
        print(f"📋 Получены данные: {data_str[:100]}...")
        
        # Парсим JSON
        try:
            data = json.loads(data_str)
        except json.JSONDecodeError as e:
            print(f"❌ Ошибка парсинга JSON: {e}")
            await message.answer(json.dumps({'success': False, 'error': 'Неверный формат данных'}), parse_mode=None)
            return
        
        # Обрабатываем запрос
        response = await handle_webapp_request(message.from_user.id, data)
        
        # Отправляем ответ
        response_str = json.dumps(response)
        print(f"📤 Отправляем ответ пользователю {message.from_user.id}: {response_str[:100]}...")
        
        await message.answer(response_str, parse_mode=None)
        
        # Обновляем главное меню если была операция с балансом
        if data.get('action') in ['open_case', 'sell_item'] and response.get('success'):
            user = get_user(message.from_user.id)
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(*) FROM inventory WHERE user_id = ?",
                (user["user_id"],)
            )
            items_count = cursor.fetchone()[0]
            
            cursor.execute(
                "SELECT SUM(i.price * inv.quantity) FROM inventory inv JOIN items i ON inv.item_id = i.item_id WHERE inv.user_id = ?",
                (user["user_id"],)
            )
            total_value_result = cursor.fetchone()
            total_value = total_value_result[0] if total_value_result[0] else 0
            conn.close()
            
            text = f"""
⛏️ <b>Главное меню</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

📦 <b>Предметов в инвентаре:</b> {items_count}
💼 <b>Общая стоимость:</b> {total_value} 💎
🎁 <b>Открыто кейсов:</b> {user['cases_opened']}

<b>Выберите действие:</b>
            """
            
            # Обновляем сообщение
            message_id = get_user_message(message.from_user.id)
            if message_id:
                try:
                    await bot.edit_message_text(
                        chat_id=message.from_user.id,
                        message_id=message_id,
                        text=text,
                        reply_markup=create_main_inline_keyboard(),
                        parse_mode=ParseMode.HTML
                    )
                except Exception as e:
                    print(f"⚠️ Не удалось обновить сообщение: {e}")
        
    except Exception as e:
        print(f"❌ Критическая ошибка в обработке Web App данных: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            await message.answer(
                json.dumps({'success': False, 'error': 'Произошла ошибка на сервере'}),
                parse_mode=None
            )
        except:
            pass

# Обработка текстовых сообщений
@router.message(F.text == "⛏️ Открыть веб-приложение")
async def handle_webapp_button(message: Message):
    """Обработка кнопки веб-приложения"""
    print(f"🔄 Пользователь {message.from_user.id} нажал кнопку веб-приложения")
    # Это сообщение не должно приходить, так как кнопка открывает веб-приложение напрямую
    # Но на всякий случай оставляем обработчик
    await message.answer("Веб-приложение должно открыться автоматически. Если этого не произошло, обновите Telegram.", reply_markup=create_main_keyboard())

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    print(f"❓ Получено неизвестное сообщение от {message.from_user.id}: {message.text}")
    
    # Игнорируем сообщения от ботов
    if message.from_user.is_bot:
        return
    
    # Если сообщение похоже на JSON от веб-приложения, обрабатываем его
    if message.text and message.text.startswith('{') and message.text.endswith('}'):
        try:
            data = json.loads(message.text)
            if 'action' in data:
                print(f"🔍 Обнаружен JSON запрос в текстовом сообщении: {data.get('action')}")
                response = await handle_webapp_request(message.from_user.id, data)
                await message.answer(json.dumps(response), parse_mode=None)
                return
        except:
            pass
    
    # Отправляем подсказку для других сообщений
    text = """
🤔 <b>Не понимаю вашу команду.</b>

Нажмите /start чтобы открыть меню или используйте кнопку веб-приложения внизу экрана.
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

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