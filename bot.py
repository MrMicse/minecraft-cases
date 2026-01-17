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

# Загрузка переменных окружения
load_dotenv()

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DB_PATH = os.getenv('DATABASE_URL', 'sqlite:///minecraft_cases.db').replace('sqlite:///', '')

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
    
    # Таблица предметов - исправленные категории
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        rarity TEXT NOT NULL CHECK(rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
        category TEXT NOT NULL CHECK(category IN ('food', 'resources', 'armor', 'weapon', 'tool', 'special')),
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
        rarity_weights TEXT NOT NULL,
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
    
    conn.commit()
    
    # Добавляем начальные данные
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        add_initial_data(cursor)
    
    conn.commit()
    conn.close()
    print(f"✅ База данных инициализирована: {DB_PATH}")

def add_initial_data(cursor):
    """Добавление начальных данных в БД"""
    print("📦 Добавление начальных данных...")
    
    # Предметы для кейсов с правильными категориями
    minecraft_items = [
        # Common - Еда
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает голод", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Хорошая еда", "bread.png"),
        ("Золотое Яблоко", "🍏", "common", "food", 160, 80, "Мощное лечение", "golden_apple.png"),
        
        # Common - Ресурсы
        ("Железный Слиток", "⛓️", "common", "resources", 50, 25, "Базовый ресурс для крафта", "iron.png"),
        ("Уголь", "⚫", "common", "resources", 30, 15, "Топливо и краситель", "coal.png"),
        ("Золотой Слиток", "🟨", "common", "resources", 80, 40, "Редкий ресурс", "gold.png"),
        ("Дубовые Доски", "🪵", "common", "resources", 20, 10, "Строительный материал", "wood.png"),
        ("Камень", "🪨", "common", "resources", 25, 12, "Прочный блок", "stone.png"),
        ("Палка", "〰️", "common", "resources", 10, 5, "Для крафта инструментов", "stick.png"),
        
        # Uncommon - Ресурсы
        ("Алмаз", "💎", "uncommon", "resources", 150, 75, "Ценный минерал", "diamond.png"),
        ("Изумруд", "🟩", "uncommon", "resources", 200, 100, "Торговая валюта", "emerald.png"),
        ("Око Эндера", "👁️", "uncommon", "resources", 300, 150, "Для поиска крепости", "ender_eye.png"),
        
        # Uncommon - Оружие
        ("Алмазный Меч", "⚔️", "uncommon", "weapon", 250, 125, "Мощное оружие", "diamond_sword.png"),
        ("Лук", "🏹", "uncommon", "weapon", 120, 60, "Дальнобойное оружие", "bow.png"),
        
        # Uncommon - Броня
        ("Железная Кираса", "🛡️", "uncommon", "armor", 180, 90, "Защита от урона", "iron_chestplate.png"),
        
        # Uncommon - Инструменты
        ("Алмазная Кирка", "⛏️", "uncommon", "tool", 220, 110, "Быстрая добыча", "diamond_pickaxe.png"),
        
        # Rare - Ресурсы
        ("Незеритовый Слиток", "🔱", "rare", "resources", 500, 250, "Элитный материал", "netherite.png"),
        
        # Rare - Особые предметы
        ("Кирокрыло", "🪶", "rare", "special", 600, 300, "Мгновенное перемещение", "chorus_fruit.png"),
        ("Элитра", "🧥", "rare", "special", 800, 400, "Полеты в мире", "elytra.png"),
        ("Зачарованная Книга", "📚", "rare", "special", 350, 175, "Мощные чары", "enchanted_book.png"),
        ("Плащ Невидимости", "👻", "rare", "armor", 700, 350, "Стать невидимым", "invisibility_cloak.png"),
        
        # Rare - Оружие
        ("Бесконечный Лук", "🏹", "rare", "weapon", 450, 225, "Не требует стрел", "infinity_bow.png"),
        
        # Epic - Особые предметы
        ("Тотем Бессмертия", "🐦", "epic", "special", 1000, 500, "Спасение от смерти", "totem.png"),
        ("Сердце Моря", "💙", "epic", "special", 1200, 600, "Редкая реликвия", "heart_of_the_sea.png"),
        ("Голова Дракона", "🐲", "epic", "special", 1500, 750, "Трофей дракона", "dragon_head.png"),
        ("Кристалл Энда", "💎", "epic", "special", 900, 450, "Восстанавливает дракона", "end_crystal.png"),
        ("Драконье Яйцо", "🥚", "epic", "special", 2000, 1000, "Уникальный трофей", "dragon_egg.png"),
        
        # Epic - Оружие
        ("Зачарованный Золотой Меч", "🗡️", "epic", "weapon", 1100, 550, "Легендарное оружие", "enchanted_golden_sword.png"),
        
        # Legendary - Особые предметы
        ("Командный Блок", "🟪", "legendary", "special", 5000, 2500, "Божественный предмет", "command_block.png"),
        ("Меч Незера", "🗡️", "legendary", "weapon", 3000, 1500, "Легендарное оружие", "netherite_sword.png"),
        ("Корона Власти", "👑", "legendary", "special", 10000, 5000, "Знак абсолютной власти", "crown.png"),
        ("Артефакт Создателя", "⭐", "legendary", "special", 7500, 3750, "Сила творения", "creator_artifact.png"),
        ("Сфера Бессмертия", "🔮", "legendary", "special", 6000, 3000, "Вечная жизнь", "immortality_sphere.png"),
    ]
    
    cursor.executemany(
        """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        minecraft_items
    )
    
    # Кейсы
    cases = [
        ("🍎 Кейс с Едой", 100, "🍎", "Содержит разнообразную еду и напитки", 
         '{"common": 60, "uncommon": 40}', "case_food.png"),
        ("⛏️ Ресурсный Кейс", 250, "⛏️", "Руды, минералы и базовые ресурсы", 
         '{"common": 40, "uncommon": 50, "rare": 10}', "case_resources.png"),
        ("⚔️ Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
         '{"uncommon": 30, "rare": 50, "epic": 20}', "case_weapons.png"),
        ("🌟 Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
         '{"rare": 20, "epic": 50, "legendary": 30}', "case_legendary.png"),
        ("👑 Доступный Кейс", 5000, "👑", "Эксклюзивные донат предметы", 
         '{"epic": 30, "legendary": 70}', "case_donate.png"),
        ("🧰 Случайный Кейс", 750, "🧰", "Микс из всех категорий", 
         '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}', "case_random.png"),
    ]
    
    cursor.executemany(
        """INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        cases
    )
    
    print(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

def get_or_create_user(user_id: int, username: str = None, first_name: str = None, last_name: str = None) -> Dict:
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
        # Создаем нового пользователя
        cursor.execute(
            """INSERT INTO users (user_id, username, first_name, last_name, balance, experience, level, last_login) 
               VALUES (?, ?, ?, ?, 10000, 0, 1, CURRENT_TIMESTAMP)""",
            (user_id, username, first_name, last_name)
        )
        conn.commit()
        print(f"✅ Создан новый пользователь: {user_id}")
        
        # Получаем созданного пользователя
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance, experience, level 
               FROM users WHERE user_id = ?""",
            (user_id,)
        )
        user_data = cursor.fetchone()
    else:
        # Обновляем время последнего входа
        cursor.execute(
            "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
            (user_id,)
        )
        conn.commit()
    
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

def update_user_balance(user_id: int, new_balance: int) -> bool:
    """Обновление баланса пользователя"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE users SET balance = ? WHERE user_id = ?",
            (new_balance, user_id)
        )
        
        conn.commit()
        conn.close()
        
        print(f"💰 Баланс пользователя {user_id} обновлен: {new_balance}")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка обновления баланса: {e}")
        return False

def get_user_inventory(user_id: int) -> List[Dict]:
    """Получение инвентаря пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT i.name, i.icon, i.rarity, i.price, i.description, 
           inv.obtained_at
    FROM inventory inv
    JOIN items i ON inv.item_id = i.item_id
    WHERE inv.user_id = ?
    ORDER BY inv.obtained_at DESC
    ''', (user_id,))
    
    inventory = []
    for row in cursor.fetchall():
        inventory.append({
            "name": row[0],
            "icon": row[1],
            "rarity": row[2],
            "price": row[3],
            "description": row[4],
            "obtained_at": row[5]
        })
    
    conn.close()
    return inventory

def add_item_to_inventory(user_id: int, item_data: Dict) -> bool:
    """Добавление предмета в инвентарь"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Находим ID предмета
        cursor.execute(
            "SELECT item_id FROM items WHERE name = ? AND rarity = ?",
            (item_data['name'], item_data['rarity'])
        )
        
        item_row = cursor.fetchone()
        
        if item_row:
            item_id = item_row[0]
        else:
            # Если предмет не найден, создаем его
            cursor.execute(
                """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    item_data['name'],
                    item_data.get('icon', '❓'),
                    item_data['rarity'],
                    'special',  # По умолчанию 'special' для кастомных предметов
                    item_data.get('price', 100),
                    item_data.get('price', 100) // 2,
                    item_data.get('description', 'Предмет из кейса'),
                    'custom_item.png'
                )
            )
            item_id = cursor.lastrowid
        
        # Добавляем в инвентарь
        cursor.execute(
            "INSERT INTO inventory (user_id, item_id, obtained_at) VALUES (?, ?, ?)",
            (user_id, item_id, item_data.get('obtained_at', datetime.now().isoformat()))
        )
        
        conn.commit()
        conn.close()
        
        print(f"🎁 Предмет добавлен в инвентарь пользователя {user_id}: {item_data['name']}")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка добавления предмета в инвентарь: {e}")
        return False

def sync_user_inventory(user_id: int, inventory_data: List[Dict]) -> bool:
    """Синхронизация инвентаря пользователя"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Удаляем старый инвентарь
        cursor.execute("DELETE FROM inventory WHERE user_id = ?", (user_id,))
        
        # Добавляем новые предметы
        for item in inventory_data:
            # Находим или создаем предмет
            cursor.execute(
                "SELECT item_id FROM items WHERE name = ? AND rarity = ?",
                (item['name'], item['rarity'])
            )
            
            item_row = cursor.fetchone()
            
            if item_row:
                item_id = item_row[0]
            else:
                # Создаем новый предмет с правильной категорией
                # Определяем категорию на основе названия
                category = 'special'  # По умолчанию
                
                # Простые эвристики для определения категории
                item_name_lower = item['name'].lower()
                if any(food in item_name_lower for food in ['яблоко', 'хлеб', 'пирог', 'мясо', 'еда']):
                    category = 'food'
                elif any(resource in item_name_lower for resource in ['слиток', 'уголь', 'доски', 'камень', 'ресурс', 'алмаз', 'изумруд']):
                    category = 'resources'
                elif any(armor in item_name_lower for armor in ['кираса', 'броня', 'плащ', 'элитра', 'щит']):
                    category = 'armor'
                elif any(weapon in item_name_lower for weapon in ['меч', 'лук', 'оружие', 'кинжал']):
                    category = 'weapon'
                elif any(tool in item_name_lower for tool in ['кирка', 'топор', 'лопата', 'мотыга', 'инструмент']):
                    category = 'tool'
                
                cursor.execute(
                    """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        item['name'],
                        item.get('icon', '❓'),
                        item['rarity'],
                        category,
                        item.get('price', 100),
                        item.get('price', 100) // 2,
                        item.get('description', 'Предмет из кейса'),
                        'custom_item.png'
                    )
                )
                item_id = cursor.lastrowid
            
            # Добавляем в инвентарь
            cursor.execute(
                "INSERT INTO inventory (user_id, item_id, obtained_at) VALUES (?, ?, ?)",
                (user_id, item_id, item.get('obtained_at', datetime.now().isoformat()))
            )
        
        conn.commit()
        conn.close()
        
        print(f"🔄 Инвентарь пользователя {user_id} синхронизирован: {len(inventory_data)} предметов")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка синхронизации инвентаря: {e}")
        return False

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

def open_case_on_server(user_id: int, case_id: int) -> Dict:
    """Открытие кейса на сервере"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Получаем информацию о кейсе
        cursor.execute(
            "SELECT price, rarity_weights FROM cases WHERE case_id = ?",
            (case_id,)
        )
        case_data = cursor.fetchone()
        
        if not case_data:
            conn.close()
            return {"success": False, "error": "Кейс не найден"}
        
        case_price, rarity_weights_json = case_data
        rarity_weights = json.loads(rarity_weights_json)
        
        # Проверяем баланс пользователя
        cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
        user_balance = cursor.fetchone()[0]
        
        if user_balance < case_price:
            conn.close()
            return {"success": False, "error": "Недостаточно средств"}
        
        # Генерируем предмет
        total_weight = sum(rarity_weights.values())
        random_value = random.uniform(0, total_weight)
        
        selected_rarity = 'common'
        cumulative_weight = 0
        for rarity, weight in rarity_weights.items():
            cumulative_weight += weight
            if random_value <= cumulative_weight:
                selected_rarity = rarity
                break
        
        # Получаем случайный предмет выбранной редкости
        cursor.execute(
            """SELECT name, icon, rarity, price, description, texture_url 
               FROM items WHERE rarity = ? ORDER BY RANDOM() LIMIT 1""",
            (selected_rarity,)
        )
        
        item_data = cursor.fetchone()
        if not item_data:
            conn.close()
            return {"success": False, "error": "Не удалось выбрать предмет"}
        
        item = {
            "name": item_data[0],
            "icon": item_data[1],
            "rarity": item_data[2],
            "price": item_data[3],
            "description": item_data[4],
            "texture_url": item_data[5]
        }
        
        # Обновляем баланс
        new_balance = user_balance - case_price
        cursor.execute(
            "UPDATE users SET balance = ? WHERE user_id = ?",
            (new_balance, user_id)
        )
        
        # Добавляем предмет в инвентарь
        cursor.execute(
            "SELECT item_id FROM items WHERE name = ? AND rarity = ?",
            (item['name'], item['rarity'])
        )
        item_id_row = cursor.fetchone()
        
        if item_id_row:
            item_id = item_id_row[0]
            cursor.execute(
                "INSERT INTO inventory (user_id, item_id) VALUES (?, ?)",
                (user_id, item_id)
            )
        
        # Добавляем в историю
        cursor.execute(
            "INSERT INTO opening_history (user_id, case_id, item_id) VALUES (?, ?, ?)",
            (user_id, case_id, item_id if 'item_id' in locals() else 1)
        )
        
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "item": item,
            "new_balance": new_balance,
            "case_price": case_price
        }
        
    except Exception as e:
        print(f"❌ Ошибка открытия кейса: {e}")
        return {"success": False, "error": str(e)}

# Обработчики команд
@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 Получена команда /start от пользователя {message.from_user.id}")
    
    user = get_or_create_user(
        message.from_user.id,
        message.from_user.username,
        message.from_user.first_name,
        message.from_user.last_name
    )
    
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
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)

<code>Начни открывать кейсы и собери свою коллекцию!</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    print(f"📥 Получена команда /balance от пользователя {message.from_user.id}")
    
    user = get_or_create_user(message.from_user.id)
    inventory = get_user_inventory(message.from_user.id)
    
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

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App"""
    try:
        print(f"🌐 Получены данные из Web App от пользователя {message.from_user.id}")
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        action = data.get('action')
        print(f"Действие: {action}")
        
        if action == 'get_user_data':
            # Получаем данные пользователя
            user = get_or_create_user(
                user_id,
                message.from_user.username,
                message.from_user.first_name,
                message.from_user.last_name
            )
            
            inventory = get_user_inventory(user_id)
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
                    'daily_bonus': 100,
                    'version': '1.0.0'
                }
            }
            
            await message.answer(json.dumps(response))
            print(f"📤 Отправлены данные пользователю {user_id}")
            
        elif action == 'sync_user_data':
            # Синхронизация данных пользователя
            client_data = data.get('data', {})
            client_balance = client_data.get('balance', 10000)
            client_inventory = client_data.get('inventory', [])
            
            print(f"🔄 Синхронизация данных для пользователя {user_id}")
            print(f"Баланс клиента: {client_balance}")
            print(f"Количество предметов: {len(client_inventory)}")
            
            # Обновляем баланс
            update_success = update_user_balance(user_id, client_balance)
            
            # Синхронизируем инвентарь
            inventory_success = False
            if client_inventory:
                inventory_success = sync_user_inventory(user_id, client_inventory)
            
            # Получаем обновленные данные для ответа
            user = get_or_create_user(user_id)
            updated_inventory = get_user_inventory(user_id) if inventory_success else []
            
            response = {
                'success': True,
                'message': 'Данные успешно синхронизированы',
                'user': {
                    'balance': user['balance'],
                    'experience': user['experience'],
                    'level': user['level']
                },
                'inventory': updated_inventory,
                'balance_updated': update_success,
                'inventory_updated': inventory_success
            }
            
            await message.answer(json.dumps(response))
            print(f"✅ Данные синхронизированы для пользователя {user_id}")
            
        elif action == 'open_case':
            # Открытие кейса через сервер
            case_id = data.get('case_id')
            print(f"🎰 Пользователь {user_id} открывает кейс {case_id}")
            
            result = open_case_on_server(user_id, case_id)
            
            if result['success']:
                # Получаем обновленные данные
                user = get_or_create_user(user_id)
                inventory = get_user_inventory(user_id)
                
                result['user'] = {
                    'balance': user['balance'],
                    'experience': user['experience'],
                    'level': user['level']
                }
                result['inventory'] = inventory
                
                # Уведомление для редких предметов
                if result['item']['rarity'] in ['epic', 'legendary']:
                    notification = f"""
🎉 <b>УДАЧА В КЕЙСАХ!</b>

{message.from_user.first_name} получил предмет <b>{result['item']['rarity']}</b> редкости:

🏆 <b>{result['item']['name']}</b> {result['item']['icon']}
💰 <b>Стоимость:</b> {result['item']['price']} 💎

Поздравляем! 🎊
                    """
                    await message.answer(notification, parse_mode=ParseMode.HTML)
            
            await message.answer(json.dumps(result))
            print(f"📤 Отправлен результат открытия кейса пользователю {user_id}")
            
        else:
            # Неизвестное действие
            print(f"⚠️ Неизвестное действие: {action}")
            await message.answer(json.dumps({'error': 'Неизвестное действие'}))
            
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка декодирования JSON: {e}")
        await message.answer(json.dumps({'error': 'Неверный формат данных'}))
    except Exception as e:
        print(f"❌ Ошибка обработки Web App данных: {e}")
        if DEBUG:
            error_msg = str(e)
        else:
            error_msg = "Произошла ошибка. Пожалуйста, попробуйте позже."
        
        await message.answer(json.dumps({'error': error_msg}))
# тест
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