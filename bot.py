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
from aiogram.filters import Command, CommandObject
from aiogram.enums import ParseMode

# Загрузка переменных окружения
load_dotenv()

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
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward', 'admin')),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')
    
    conn.commit()
    
    # Сброс баланса всех пользователей до 10000
    cursor.execute("UPDATE users SET balance = 10000 WHERE balance != 10000")
    
    # Добавляем начальные данные
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        add_initial_data(cursor)
    
    conn.commit()
    conn.close()
    print(f"✅ База данных инициализирована: {DB_PATH}")
    print(f"💰 Баланс всех пользователей установлен на 10000")

def add_initial_data(cursor):
    """Добавление начальных данных"""
    print("📦 Добавление начальных данных...")
    
    # Предметы Minecraft
    minecraft_items = [
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает 2 единицы голода", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Восстанавливает 5 единиц голода", "bread.png"),
        ("Мясо", "🍖", "common", "food", 50, 25, "Восстанавливает 8 единиц голода", "meat.png"),
        ("Уголь", "⚫", "common", "resources", 30, 15, "Топливо и краситель", "coal.png"),
        ("Железный слиток", "⛓️", "common", "resources", 50, 25, "Базовый ресурс для крафта", "iron.png"),
        ("Золотой слиток", "🟨", "common", "resources", 80, 40, "Редкий ресурс", "gold.png"),
        ("Алмаз", "💎", "uncommon", "resources", 150, 75, "Ценный минерал", "diamond.png"),
        ("Изумруд", "🟩", "uncommon", "resources", 200, 100, "Торговая валюта", "emerald.png"),
        ("Железный меч", "⚔️", "uncommon", "weapons", 180, 90, "Базовое оружие", "iron_sword.png"),
        ("Лук", "🏹", "uncommon", "weapons", 120, 60, "Дальнобойное оружие", "bow.png"),
        ("Алмазный меч", "⚔️💎", "rare", "weapons", 250, 125, "Мощное оружие", "diamond_sword.png"),
        ("Алмазная кирка", "⛏️💎", "rare", "tools", 300, 150, "Быстрая добыча", "diamond_pickaxe.png"),
        ("Незеритовый слиток", "🔱", "rare", "resources", 500, 250, "Элитный материал", "netherite.png"),
        ("Элитра", "🧥", "rare", "special", 800, 400, "Позволяет летать", "elytra.png"),
        ("Тотем бессмертия", "🐦", "epic", "special", 1000, 500, "Спасение от смерти", "totem.png"),
        ("Сердце моря", "💙", "epic", "resources", 1200, 600, "Редкая реликвия", "heart.png"),
        ("Командный блок", "🟪", "legendary", "special", 5000, 2500, "Божественный предмет", "command_block.png"),
        ("Меч незера", "🗡️", "legendary", "weapons", 3000, 1500, "Легендарное оружие", "netherite_sword.png"),
        ("Корона власти", "👑", "legendary", "special", 10000, 5000, "Знак абсолютной власти", "crown.png"),
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
        "SELECT price, rarity_weights FROM cases WHERE case_id = ?",
        (case_id,)
    )
    case_data = cursor.fetchone()
    
    if not case_data:
        conn.close()
        return {"error": "Кейс не найден"}
    
    case_price, rarity_weights_json = case_data
    rarity_weights = json.loads(rarity_weights_json)
    
    # Выбираем редкость
    total_weight = sum(rarity_weights.values())
    random_value = random.uniform(0, total_weight)
    
    selected_rarity = None
    cumulative_weight = 0
    for rarity, weight in rarity_weights.items():
        cumulative_weight += weight
        if random_value <= cumulative_weight:
            selected_rarity = rarity
            break
    
    # Выбираем случайный предмет
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
        "item_id": item_data[0],
        "name": item_data[1],
        "icon": item_data[2],
        "rarity": item_data[3],
        "price": item_data[4],
        "description": item_data[5],
        "texture_url": item_data[6]
    }
    
    # Проверяем баланс
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    balance = cursor.fetchone()[0]
    
    if balance < case_price:
        conn.close()
        return {"error": "Недостаточно средств"}
    
    # Списание средств
    new_balance = update_balance(
        user_id, -case_price, "purchase", 
        f"Покупка кейса: {case_id}"
    )
    
    # Добавляем предмет в инвентарь
    cursor.execute(
        """INSERT INTO inventory (user_id, item_id) 
           VALUES (?, ?)""",
        (user_id, item["item_id"])
    )
    
    # Добавляем в историю
    cursor.execute(
        """INSERT INTO opening_history (user_id, case_id, item_id) 
           VALUES (?, ?, ?)""",
        (user_id, case_id, item["item_id"])
    )
    
    # Начисляем опыт
    experience_gained = case_price // 10
    cursor.execute(
        "UPDATE users SET experience = experience + ? WHERE user_id = ?",
        (experience_gained, user_id)
    )
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "item": item,
        "new_balance": new_balance,
        "experience_gained": experience_gained,
        "case_price": case_price
    }

# Основные команды
@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 /start от {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    
    # Обновляем время входа
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
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
<code>Начни открывать кейсы и собери свою коллекцию!</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

@router.message(Command("daily"))
async def cmd_daily(message: Message):
    """Ежедневный бонус"""
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

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
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

# Админ команды
@router.message(Command("setbalance"))
async def cmd_set_balance(message: Message, command: CommandObject):
    """Установка баланса"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ Нет прав!")
        return
    
    if not command.args:
        await message.answer("❌ Использование: /setbalance <user_id> <amount>")
        return
    
    try:
        args = command.args.split()
        if len(args) != 2:
            await message.answer("❌ Использование: /setbalance <user_id> <amount>")
            return
        
        user_id = int(args[0])
        amount = int(args[1])
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
        if not cursor.fetchone():
            conn.close()
            await message.answer("❌ Пользователь не найден!")
            return
        
        cursor.execute("UPDATE users SET balance = ? WHERE user_id = ?", (amount, user_id))
        
        cursor.execute(
            """INSERT INTO transactions (user_id, type, amount, description) 
               VALUES (?, 'admin', ?, ?)""",
            (user_id, amount, f"Админская установка баланса")
        )
        
        conn.commit()
        conn.close()
        
        await message.answer(f"✅ Баланс пользователя ID: {user_id} установлен на {amount} 💎")
        
    except ValueError:
        await message.answer("❌ Неверный формат!")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")

@router.message(Command("addbalance"))
async def cmd_add_balance(message: Message, command: CommandObject):
    """Добавление баланса"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ Нет прав!")
        return
    
    if not command.args:
        await message.answer("❌ Использование: /addbalance <user_id> <amount>")
        return
    
    try:
        args = command.args.split()
        if len(args) != 2:
            await message.answer("❌ Использование: /addbalance <user_id> <amount>")
            return
        
        user_id = int(args[0])
        amount = int(args[1])
        
        new_balance = update_balance(
            user_id, amount, "admin", 
            f"Админское пополнение"
        )
        
        await message.answer(f"✅ Пользователю ID: {user_id} добавлено {amount} 💎\nНовый баланс: {new_balance} 💎")
        
    except ValueError:
        await message.answer("❌ Неверный формат!")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")

@router.message(Command("resetbalance"))
async def cmd_reset_balance(message: Message, command: CommandObject = None):
    """Сброс баланса"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ Нет прав!")
        return
    
    try:
        if command and command.args:
            # Сброс конкретному пользователю
            user_id = int(command.args)
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
            current_balance = cursor.fetchone()
            
            if not current_balance:
                conn.close()
                await message.answer("❌ Пользователь не найден!")
                return
            
            cursor.execute("UPDATE users SET balance = 10000 WHERE user_id = ?", (user_id,))
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (?, 'admin', ?, ?)""",
                (user_id, 10000 - current_balance[0], "Сброс баланса")
            )
            
            conn.commit()
            conn.close()
            
            await message.answer(f"✅ Баланс пользователя ID: {user_id} сброшен до 10000 💎")
            
        else:
            # Сброс всем пользователям
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            
            cursor.execute("UPDATE users SET balance = 10000")
            
            cursor.execute("SELECT user_id FROM users")
            user_ids = cursor.fetchall()
            
            for user_id in user_ids:
                cursor.execute(
                    """INSERT INTO transactions (user_id, type, amount, description) 
                       VALUES (?, 'admin', ?, ?)""",
                    (user_id[0], 10000, "Массовый сброс баланса")
                )
            
            conn.commit()
            conn.close()
            
            await message.answer(f"✅ Баланс всех {user_count} пользователей сброшен до 10000 💎")
            
    except ValueError:
        await message.answer("❌ Неверный формат!")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ панель"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ Нет прав!")
        return
    
    text = """
👑 <b>Админ панель</b>

<b>Команды для управления балансом:</b>
/setbalance <user_id> <amount> - Установить точный баланс
/addbalance <user_id> <amount> - Добавить к балансу
/resetbalance [user_id] - Сбросить баланс до 10000

<b>Примеры:</b>
<code>/setbalance 123456789 50000</code>
<code>/addbalance 123456789 1000</code>
<code>/resetbalance 123456789</code>
<code>/resetbalance</code> - сбросить всем
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

# Обработка данных из Web App
@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из мини-приложения"""
    try:
        print(f"🌐 Данные от {message.from_user.id}")
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        if data.get('action') == 'init':
            # Инициализация
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            cases = get_cases()
            
            response = {
                'success': True,
                'user': user,
                'inventory': inventory,
                'cases': cases
            }
            
            await message.answer(json.dumps(response))
            
        elif data.get('action') == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            print(f"🎰 {user_id} открывает кейс {case_id}")
            
            result = open_case(user_id, case_id)
            
            if 'error' in result:
                await message.answer(json.dumps({'error': result['error']}))
                return
            
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
            
        elif data.get('action') == 'save_data':
            # Сохранение данных
            balance = data.get('balance', 10000)
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET balance = ? WHERE user_id = ?", (balance, user_id))
            conn.commit()
            conn.close()
            
            await message.answer(json.dumps({'success': True}))
            
        elif data.get('action') == 'sync_balance':
            # Синхронизация баланса
            user = get_user(user_id)
            await message.answer(json.dumps({'balance': user['balance']}))
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        await message.answer(json.dumps({'error': 'Ошибка сервера'}))

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    await message.answer("🤔 Не понимаю. Используйте /help")

async def main():
    """Запуск бота"""
    init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"💰 Начальный баланс: 10000 💎")
    print("✅ Бот запущен!")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    asyncio.run(main())