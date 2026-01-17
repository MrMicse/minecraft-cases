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
from aiogram.utils.keyboard import InlineKeyboardBuilder
from aiogram.methods import EditMessageText

# Загрузка переменных окружения из .env файла
load_dotenv()

# Получение конфигурации из переменных окружения
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DB_PATH = os.getenv('DATABASE_URL', 'minecraft_cases.db')

# Проверка наличия обязательных переменных
if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

# Хранилище для состояний пользователей (упрощенная версия)
user_states = {}

def init_db():
    """Инициализация базы данных"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Таблица пользователей - ОБНОВЛЕНА для синхронизации с Web App
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        balance INTEGER DEFAULT 10000,  -- Кристаллы пользователя
        experience INTEGER DEFAULT 0,    -- Опыт пользователя
        level INTEGER DEFAULT 1,         -- Уровень пользователя
        diamonds INTEGER DEFAULT 10000,  -- Отдельное поле для алмазов/кристаллов
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        webapp_data TEXT DEFAULT '{}'    -- JSON для хранения данных из Web App
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
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward', 'webapp_spend')),
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
        """SELECT user_id, username, first_name, last_name, balance, experience, level, diamonds 
           FROM users WHERE user_id = ?""",
        (user_id,)
    )
    
    user_data = cursor.fetchone()
    if not user_data:
        cursor.execute(
            """INSERT INTO users (user_id, balance, experience, level, diamonds, last_login) 
               VALUES (?, 10000, 0, 1, 10000, CURRENT_TIMESTAMP)""",
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
            """SELECT user_id, username, first_name, last_name, balance, experience, level, diamonds 
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
        "balance": user_data[4],  # Общий баланс
        "experience": user_data[5],
        "level": user_data[6],
        "diamonds": user_data[7]  # Алмазы/кристаллы
    }

def update_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> Dict:
    """Обновление баланса пользователя - возвращает обновленные данные"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Обновляем баланс (для совместимости со старым кодом)
    cursor.execute(
        "UPDATE users SET balance = balance + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    # Также обновляем diamonds для синхронизации с Web App
    cursor.execute(
        "UPDATE users SET diamonds = diamonds + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, ?, ?, ?)""",
        (user_id, transaction_type, amount, description)
    )
    
    # Получаем обновленные данные
    cursor.execute(
        """SELECT balance, diamonds FROM users WHERE user_id = ?""",
        (user_id,)
    )
    new_balance, new_diamonds = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return {
        "balance": new_balance,
        "diamonds": new_diamonds
    }

def update_diamonds(user_id: int, amount: int, transaction_type: str, description: str = "") -> Dict:
    """Обновление алмазов пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Обновляем diamonds
    cursor.execute(
        "UPDATE users SET diamonds = diamonds + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    # Также синхронизируем balance
    cursor.execute(
        "UPDATE users SET balance = balance + ? WHERE user_id = ?",
        (amount, user_id)
    )
    
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, ?, ?, ?)""",
        (user_id, transaction_type, amount, description)
    )
    
    # Получаем обновленные данные
    cursor.execute(
        """SELECT balance, diamonds FROM users WHERE user_id = ?""",
        (user_id,)
    )
    new_balance, new_diamonds = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return {
        "balance": new_balance,
        "diamonds": new_diamonds
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
    
    # Проверяем баланс (используем diamonds для Web App)
    cursor.execute("SELECT diamonds FROM users WHERE user_id = ?", (user_id,))
    diamonds_result = cursor.fetchone()
    if not diamonds_result:
        conn.close()
        return {"error": "Пользователь не найден"}
    
    diamonds = diamonds_result[0]
    
    if diamonds < case_price:
        conn.close()
        return {"error": "Недостаточно алмазов"}
    
    # Списание алмазов
    cursor.execute(
        "UPDATE users SET diamonds = diamonds - ? WHERE user_id = ?",
        (case_price, user_id)
    )
    
    # Также обновляем balance для совместимости
    cursor.execute(
        "UPDATE users SET balance = balance - ? WHERE user_id = ?",
        (case_price, user_id)
    )
    
    cursor.execute(
        """INSERT INTO transactions (user_id, type, amount, description) 
           VALUES (?, 'webapp_spend', ?, ?)""",
        (user_id, -case_price, f"Открытие кейса в Web App: {case_name}")
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
        "SELECT balance, diamonds, experience, level FROM users WHERE user_id = ?",
        (user_id,)
    )
    updated_user = cursor.fetchone()
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "item": item,
        "diamonds": updated_user[1],  # Обновленные алмазы
        "new_balance": updated_user[1],  # Для совместимости с Web App
        "experience_gained": experience_gained,
        "case_price": case_price,
        "inventory_id": inventory_id,
        "experience": updated_user[2],
        "level": updated_user[3]
    }

def get_user_data_for_webapp(user_id: int) -> Dict:
    """Получение данных пользователя для веб-приложения"""
    user = get_user(user_id)
    inventory = get_inventory(user_id)
    cases = get_cases()
    
    return {
        "user": {
            "balance": user["diamonds"],  # Используем diamonds для Web App
            "experience": user["experience"],
            "level": user["level"]
        },
        "inventory": inventory,
        "cases": cases
    }

async def show_main_menu(chat_id, message_id=None):
    """Отображение главного меню"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚀 Запустить игру",
                    web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
                )
            ],
            [
                InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
                InlineKeyboardButton(text="📦 Инвентарь", callback_data="inventory")
            ],
            [
                InlineKeyboardButton(text="💰 Баланс", callback_data="balance_menu"),
                InlineKeyboardButton(text="❓ Помощь", callback_data="help")
            ]
        ]
    )
    
    text = """
<b>Minecraft Case Opening</b>

Добро пожаловать в игру открытия кейсов в стиле Minecraft! Открывайте кейсы, собирайте редкие предметы и улучшайте свою коллекцию.

Нажмите <b>«Запустить игру»</b> чтобы начать.
    """
    
    if message_id:
        await bot.edit_message_text(
            chat_id=chat_id,
            message_id=message_id,
            text=text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML
        )
    else:
        await bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup=keyboard,
            parse_mode=ParseMode.HTML
        )

async def show_profile(chat_id, message_id, user_id):
    """Отображение профиля"""
    user = get_user(user_id)
    inventory = get_inventory(user_id)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💎 Пополнить баланс", callback_data="add_diamonds"),
                InlineKeyboardButton(text="💰 Транзакции", callback_data="transactions")
            ],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )
    
    text = f"""
<b>👤 Профиль игрока</b>

<b>ID:</b> {user['user_id']}
<b>Алмазы (Кристаллы):</b> {user['diamonds']} 💎
<b>Общий баланс:</b> {user['balance']} 💰
<b>Уровень:</b> {user['level']}
<b>Опыт:</b> {user['experience']} XP

<b>📦 Инвентарь:</b> {len(inventory)} предметов
<b>📊 Общая стоимость:</b> {sum(item['price'] for item in inventory)} 💎
    """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

async def show_balance_menu(chat_id, message_id, user_id):
    """Меню управления балансом"""
    user = get_user(user_id)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💎 +100", callback_data="add_100"),
                InlineKeyboardButton(text="💎 +500", callback_data="add_500")
            ],
            [
                InlineKeyboardButton(text="💎 +1000", callback_data="add_1000"),
                InlineKeyboardButton(text="💎 +5000", callback_data="add_5000")
            ],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )
    
    text = f"""
<b>💰 Управление балансом</b>

Текущий баланс: {user['diamonds']} 💎

Выберите количество алмазов для пополнения:

<code>💎 100  алмазов</code>
<code>💎 500  алмазов</code>  
<code>💎 1000 алмазов</code>
<code>💎 5000 алмазов</code>

<i>Примечание: Алмазы синхронизируются с игровым приложением.</i>
    """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

async def show_transactions(chat_id, message_id, user_id):
    """История транзакций"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT type, amount, description, created_at 
           FROM transactions 
           WHERE user_id = ? 
           ORDER BY created_at DESC 
           LIMIT 10""",
        (user_id,)
    )
    
    transactions = cursor.fetchall()
    conn.close()
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="profile")]
        ]
    )
    
    if not transactions:
        text = """
<b>📊 История транзакций</b>

У вас еще нет транзакций.
        """
    else:
        transaction_text = ""
        for trans in transactions:
            trans_type, amount, description, created_at = trans
            
            # Форматируем дату
            created_date = datetime.strptime(created_at, "%Y-%m-%d %H:%M:%S")
            formatted_date = created_date.strftime("%d.%m.%Y %H:%M")
            
            # Определяем символ для типа транзакции
            if amount > 0:
                symbol = "📈"
            else:
                symbol = "📉"
                amount = abs(amount)
            
            transaction_text += f"\n{symbol} <b>{amount} 💎</b> - {description}"
            transaction_text += f"\n<code>{formatted_date}</code>\n"
        
        text = f"""
<b>📊 История транзакций</b>

Последние 10 операций:
{transaction_text}
        """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

async def show_inventory(chat_id, message_id, user_id):
    """Отображение инвентаря"""
    inventory = get_inventory(user_id)
    user = get_user(user_id)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )
    
    if not inventory:
        text = f"""
<b>📦 Ваш инвентарь</b>

Алмазы: {user['diamonds']} 💎

Ваш инвентарь пуст. Откройте кейсы в игре чтобы получить предметы!
        """
    else:
        # Группируем предметы по редкости
        items_by_rarity = {}
        total_value = 0
        
        for item in inventory:
            rarity = item['rarity']
            if rarity not in items_by_rarity:
                items_by_rarity[rarity] = []
            items_by_rarity[rarity].append(item)
            total_value += item['price']
        
        rarity_text = {
            'common': 'Обычные',
            'uncommon': 'Необычные',
            'rare': 'Редкие',
            'epic': 'Эпические',
            'legendary': 'Легендарные'
        }
        
        inventory_text = ""
        for rarity in ['legendary', 'epic', 'rare', 'uncommon', 'common']:
            if rarity in items_by_rarity:
                inventory_text += f"\n<b>{rarity_text[rarity]}:</b> {len(items_by_rarity[rarity])} предметов"
        
        text = f"""
<b>📦 Ваш инвентарь</b>

Алмазы: {user['diamonds']} 💎
Всего предметов: {len(inventory)}
Общая стоимость: {total_value} 💎

<b>По редкости:</b>{inventory_text}

<i>Для просмотра и управления предметами используйте игровое приложение.</i>
        """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

async def show_stats(chat_id, message_id, user_id):
    """Отображение статистики"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем статистику открытий
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user_id,)
    )
    cases_opened = cursor.fetchone()[0]
    
    # Получаем сумму потраченных алмазов
    cursor.execute(
        """SELECT SUM(amount) FROM transactions 
           WHERE user_id = ? AND type IN ('purchase', 'webapp_spend')""",
        (user_id,)
    )
    spent_result = cursor.fetchone()
    diamonds_spent = abs(spent_result[0]) if spent_result[0] else 0
    
    # Получаем самый редкий предмет
    cursor.execute('''
    SELECT i.name, i.rarity, i.price, COUNT(*) as count 
    FROM inventory inv 
    JOIN items i ON inv.item_id = i.item_id 
    WHERE inv.user_id = ? 
    GROUP BY i.item_id 
    ORDER BY i.price DESC 
    LIMIT 1
    ''', (user_id,))
    
    top_item = cursor.fetchone()
    
    conn.close()
    
    user = get_user(user_id)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )
    
    rarity_text = {
        'common': 'Обычный',
        'uncommon': 'Необычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    }
    
    top_item_text = "Нет предметов"
    if top_item:
        top_item_text = f"{top_item[0]} ({rarity_text[top_item[1]]}) - {top_item[2]} 💎"
    
    text = f"""
<b>📊 Статистика игрока</b>

<b>Общая статистика:</b>
• Открыто кейсов: {cases_opened}
• Потрачено алмазов: {diamonds_spent} 💎
• Текущие алмазы: {user['diamonds']} 💎
• Уровень: {user['level']}
• Опыт: {user['experience']} XP

<b>Лучший предмет:</b>
{top_item_text}

<i>Продолжайте открывать кейсы для улучшения статистики!</i>
    """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

async def show_help(chat_id, message_id):
    """Отображение помощи"""
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )
    
    text = """
<b>❓ Помощь</b>

<b>Как играть:</b>
1. Нажмите «Запустить игру» чтобы открыть игровое приложение
2. Выберите кейс для открытия
3. Используйте алмазы для открытия кейсов
4. Полученные предметы сохраняются в инвентаре
5. Продавайте ненужные предметы или собирайте коллекцию

<b>Важно!</b> Алмазы (💎) синхронизируются между ботом и игровым приложением.

<b>Команды:</b>
/start - Главное меню
/balance - Проверить баланс
/add_diamonds - Пополнить алмазы

<b>Связь с поддержкой:</b>
Если возникли проблемы с игрой, обратитесь к администратору.

<i>Удачи в игре!</i>
    """
    
    await bot.edit_message_text(
        chat_id=chat_id,
        message_id=message_id,
        text=text,
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )

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
    
    user_states[message.from_user.id] = {
        'state': 'main_menu',
        'message_id': None
    }
    
    await show_main_menu(message.chat.id)

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    user = get_user(message.from_user.id)
    inventory = get_inventory(user["user_id"])
    
    text = f"""
<b>💰 Баланс аккаунта</b>

Алмазы: {user['diamonds']} 💎
Общий баланс: {user['balance']} 💰
Предметов в инвентаре: {len(inventory)}
Общая стоимость: {sum(item['price'] for item in inventory)} 💎

<i>Алмазы синхронизируются с игровым приложением.</i>
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("add_diamonds"))
async def cmd_add_diamonds(message: Message):
    """Пополнение алмазов"""
    await show_balance_menu(message.chat.id, None, message.from_user.id)

@router.callback_query(F.data == "back_to_main")
async def callback_back_to_main(callback: CallbackQuery):
    """Обработка кнопки назад"""
    await callback.answer()
    await show_main_menu(callback.message.chat.id, callback.message.message_id)

@router.callback_query(F.data == "profile")
async def callback_profile(callback: CallbackQuery):
    """Обработка кнопки профиля"""
    await callback.answer()
    await show_profile(callback.message.chat.id, callback.message.message_id, callback.from_user.id)

@router.callback_query(F.data == "balance_menu")
async def callback_balance_menu(callback: CallbackQuery):
    """Обработка кнопки баланса"""
    await callback.answer()
    await show_balance_menu(callback.message.chat.id, callback.message.message_id, callback.from_user.id)

@router.callback_query(F.data == "transactions")
async def callback_transactions(callback: CallbackQuery):
    """Обработка кнопки транзакций"""
    await callback.answer()
    await show_transactions(callback.message.chat.id, callback.message.message_id, callback.from_user.id)

@router.callback_query(F.data == "inventory")
async def callback_inventory(callback: CallbackQuery):
    """Обработка кнопки инвентаря"""
    await callback.answer()
    await show_inventory(callback.message.chat.id, callback.message.message_id, callback.from_user.id)

@router.callback_query(F.data == "stats")
async def callback_stats(callback: CallbackQuery):
    """Обработка кнопки статистики"""
    await callback.answer()
    await show_stats(callback.message.chat.id, callback.message.message_id, callback.from_user.id)

@router.callback_query(F.data == "help")
async def callback_help(callback: CallbackQuery):
    """Обработка кнопки помощи"""
    await callback.answer()
    await show_help(callback.message.chat.id, callback.message.message_id)

# Обработчики пополнения баланса
@router.callback_query(F.data.startswith("add_"))
async def callback_add_diamonds(callback: CallbackQuery):
    """Обработка пополнения алмазов"""
    amount_map = {
        "add_100": 100,
        "add_500": 500,
        "add_1000": 1000,
        "add_5000": 5000
    }
    
    amount = amount_map.get(callback.data)
    if not amount:
        await callback.answer("Неизвестная сумма")
        return
    
    user_id = callback.from_user.id
    
    # Пополняем алмазы
    updated_data = update_diamonds(
        user_id=user_id,
        amount=amount,
        transaction_type="reward",
        description=f"Пополнение алмазов +{amount} 💎"
    )
    
    await callback.answer(f"✅ Пополнено +{amount} алмазов!")
    
    # Показываем обновленный профиль
    await show_profile(callback.message.chat.id, callback.message.message_id, user_id)

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App - БЫСТРЫЙ ОТВЕТ БЕЗ ЗАДЕРЖЕК"""
    try:
        print(f"🌐 Получены данные из Web App от пользователя {message.from_user.id}")
        
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        action = data.get('action')
        
        print(f"📋 Действие: {action}, Данные: {data}")
        
        # БЫСТРЫЙ ОТВЕТ НА ВСЕ ЗАПРОСЫ
        if action == 'init' or action == 'sync_data':
            # Инициализация или синхронизация - МГНОВЕННЫЙ ОТВЕТ
            webapp_data = get_user_data_for_webapp(user_id)
            webapp_data['success'] = True
            webapp_data['config'] = {
                'min_bet': 10,
                'max_bet': 10000,
                'daily_bonus': 100,
                'version': '1.0.0'
            }
            
            # Отправляем ответ НЕМЕДЛЕННО
            await message.answer(
                json.dumps(webapp_data),
                parse_mode=None
            )
            print(f"📤 Отправлен ответ на {action}. Алмазы: {webapp_data['user']['balance']}")
            
        elif action == 'open_case':
            # Открытие кейса - УПРОЩЕННЫЙ ПРОЦЕСС
            case_id = data.get('case_id')
            print(f"🎰 Пользователь {user_id} открывает кейс {case_id}")
            
            # БЫСТРОЕ открытие кейса
            result = open_case(user_id, case_id)
            
            if 'error' in result:
                print(f"❌ Ошибка при открытии кейса: {result['error']}")
                response = {'success': False, 'error': result['error']}
                await message.answer(json.dumps(response), parse_mode=None)
                return
            
            # Добавляем дополнительные данные
            webapp_data = get_user_data_for_webapp(user_id)
            result.update(webapp_data)
            
            # Отправляем результат НЕМЕДЛЕННО
            await message.answer(json.dumps(result), parse_mode=None)
            print(f"📤 Отправлен результат открытия кейса. Новый баланс: {result['diamonds']} 💎")
            
        elif action == 'sell_item':
            # Продажа предмета - БЫСТРАЯ ОБРАБОТКА
            item_id = data.get('item_id')
            print(f"💰 Пользователь {user_id} продает предмет {item_id}")
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Получаем цену предмета
            cursor.execute("SELECT sell_price, name FROM items WHERE item_id = ?", (item_id,))
            item_data = cursor.fetchone()
            
            if not item_data:
                response = {'success': False, 'error': 'Предмет не найден'}
                await message.answer(json.dumps(response), parse_mode=None)
                conn.close()
                return
            
            # Удаляем предмет из инвентаря
            cursor.execute(
                "DELETE FROM inventory WHERE user_id = ? AND item_id = ? LIMIT 1",
                (user_id, item_id)
            )
            
            if cursor.rowcount == 0:
                response = {'success': False, 'error': 'Предмет не найден в инвентаре'}
                await message.answer(json.dumps(response), parse_mode=None)
                conn.close()
                return
            
            # Добавляем деньги (используем алмазы)
            sell_price, item_name = item_data
            cursor.execute(
                "UPDATE users SET diamonds = diamonds + ? WHERE user_id = ?",
                (sell_price, user_id)
            )
            
            # Также обновляем balance
            cursor.execute(
                "UPDATE users SET balance = balance + ? WHERE user_id = ?",
                (sell_price, user_id)
            )
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (?, 'reward', ?, ?)""",
                (user_id, sell_price, f"Продажа предмета в Web App: {item_name}")
            )
            
            # Получаем новые данные
            cursor.execute("SELECT diamonds FROM users WHERE user_id = ?", (user_id,))
            new_diamonds = cursor.fetchone()[0]
            
            # Получаем обновленные данные
            webapp_data = get_user_data_for_webapp(user_id)
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': new_diamonds,  # Используем diamonds как баланс
                'diamonds': new_diamonds
            }
            response.update(webapp_data)
            
            await message.answer(json.dumps(response), parse_mode=None)
            conn.commit()
            conn.close()
            print(f"📤 Предмет продан. Новые алмазы: {new_diamonds} 💎")
            
        else:
            # Неизвестное действие
            response = {'success': False, 'error': 'Неизвестное действие'}
            await message.answer(json.dumps(response), parse_mode=None)
            print(f"❌ Неизвестное действие: {action}")
            
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка декодирования JSON: {e}")
        response = {'success': False, 'error': 'Неверный формат данных'}
        await message.answer(json.dumps(response), parse_mode=None)
    except Exception as e:
        print(f"❌ Ошибка обработки Web App данных: {e}")
        import traceback
        traceback.print_exc()
        
        if DEBUG:
            error_msg = str(e)
        else:
            error_msg = "Произошла ошибка. Пожалуйста, попробуйте позже."
        
        response = {'success': False, 'error': error_msg}
        await message.answer(json.dumps(response), parse_mode=None)

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    await message.answer(
        "Для начала работы используйте команду /start",
        parse_mode=ParseMode.HTML
    )

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