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
    MenuButtonWebApp
)
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.utils.keyboard import InlineKeyboardBuilder

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
        '{"common": 70, "uncommon": 30}', "assets/textures/cases/case_food.png"),
        ("Ресурсный Кейс", 250, "⛏️", "Руды, минералы и базовые ресурсы", 
        '{"common": 50, "uncommon": 40, "rare": 10}', "assets/textures/cases/case_resources.png"),
        ("Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
        '{"uncommon": 40, "rare": 50, "epic": 10}', "assets/textures/cases/case_weapons.png"),
        ("Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
        '{"rare": 30, "epic": 50, "legendary": 20}', "assets/textures/cases/case_legendary.png"),
        ("Донат Кейс", 5000, "👑", "Эксклюзивные донат предметы", 
        '{"epic": 40, "legendary": 60}', "assets/textures/cases/case_donate.png"),
        ("Случайный Кейс", 750, "🧰", "Микс из всех категорий", 
        '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}', "assets/textures/cases/case_random.png"),
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
    cursor.execute(
        "UPDATE users SET balance = balance - ? WHERE user_id = ?",
        (case_price, user_id)
    )
    
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
        "inventory_id": inventory_id,
        "experience": updated_user[1],
        "level": updated_user[2]
    }

def get_user_data_for_webapp(user_id: int) -> Dict:
    """Получение данных пользователя для веб-приложения"""
    user = get_user(user_id)
    inventory = get_inventory(user_id)
    cases = get_cases()
    
    return {
        "user": {
            "balance": user["balance"],
            "experience": user["experience"],
            "level": user["level"]
        },
        "inventory": inventory,
        "cases": cases
    }

# Обработчики команд
@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 Получена команда /start от пользователя {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    cases_opened = get_cases_opened_count(user["user_id"])
    
    # Обновляем время последнего входа
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
        (user["user_id"],)
    )
    conn.commit()
    conn.close()
    
    keyboard = build_main_menu_keyboard()
    
    await bot.set_chat_menu_button(
        chat_id=message.chat.id,
        menu_button=MenuButtonWebApp(
            text="⛏️ Minecraft Кейсы",
            web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
        )
    )
    
    text = build_main_menu_text(message.from_user.first_name, user, cases_opened)
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    print(f"📤 Отправлен ответ пользователю {message.from_user.id}")


def get_cases_opened_count(user_id: int) -> int:
    """Получаем статистику открытий кейсов для пользователя."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user_id,)
    )
    cases_opened = cursor.fetchone()[0]
    conn.close()
    return cases_opened


def build_main_menu_text(first_name: str, user: Dict, cases_opened: int) -> str:
    """Формирование текста главного меню."""
    return f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
🏆 <b>Открыто кейсов:</b> {cases_opened} (/stats)

<code>Открывайте веб-приложение через кнопку под строкой ввода.</code>
    """


def build_main_menu_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура главного меню."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
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


def build_back_keyboard() -> InlineKeyboardMarkup:
    """Клавиатура с кнопкой возврата."""
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="↩️ Вернуться назад", callback_data="back_to_menu")]
        ]
    )


@router.callback_query(F.data == "profile")
async def handle_profile(callback: CallbackQuery):
    """Показ профиля пользователя."""
    user = get_user(callback.from_user.id)
    inventory = get_inventory(user["user_id"])
    cases_opened = get_cases_opened_count(user["user_id"])

    text = f"""
👤 <b>Профиль игрока</b>

Имя: {callback.from_user.first_name}
Баланс: {user['balance']} 💎
Уровень: {user['level']}
Опыт: {user['experience']} XP
Открыто кейсов: {cases_opened}
Предметов в инвентаре: {len(inventory)}
    """

    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "inventory")
async def handle_inventory(callback: CallbackQuery):
    """Показ инвентаря пользователя."""
    user = get_user(callback.from_user.id)
    inventory = get_inventory(user["user_id"])

    if inventory:
        items_preview = "\n".join(
            f"• {item['icon']} {item['name']} — {item['rarity'].capitalize()} ({item['price']} 💎)"
            for item in inventory[:8]
        )
        more_text = "\n\n…и другие предметы." if len(inventory) > 8 else ""
    else:
        items_preview = "Инвентарь пуст. Откройте кейс, чтобы получить предметы!"
        more_text = ""

    text = f"""
🎒 <b>Инвентарь</b>

{items_preview}{more_text}
    """

    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "deposit")
async def handle_deposit(callback: CallbackQuery):
    """Показ информации о пополнении."""
    text = """
💰 <b>Пополнение баланса</b>

В ближайшее время здесь появятся удобные способы пополнения.
Следите за обновлениями!
    """

    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "trade")
async def handle_trade(callback: CallbackQuery):
    """Показ информации об обмене."""
    text = """
🔄 <b>Обмен предметов</b>

Скоро вы сможете обменивать предметы и получать бонусы.
Пока что возвращайтесь в меню!
    """

    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "back_to_menu")
async def handle_back_to_menu(callback: CallbackQuery):
    """Возврат к главному меню."""
    user = get_user(callback.from_user.id)
    cases_opened = get_cases_opened_count(user["user_id"])
    text = build_main_menu_text(callback.from_user.first_name, user, cases_opened)

    await callback.message.edit_text(text, reply_markup=build_main_menu_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()

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

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App - БЫСТРЫЙ ОТВЕТ БЕЗ ЗАДЕРЖЕК"""
    try:
        print(f"🌐 Получены данные из Web App от пользователя {message.from_user.id}")
        
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        action = data.get('action')
        
        print(f"📋 Действие: {action}")
        
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
            print(f"📤 Отправлен ответ на {action}")
            
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
            print(f"📤 Отправлен результат открытия кейса")
            
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
            
            # Добавляем деньги
            sell_price, item_name = item_data
            cursor.execute(
                "UPDATE users SET balance = balance + ? WHERE user_id = ?",
                (sell_price, user_id)
            )
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (?, 'reward', ?, ?)""",
                (user_id, sell_price, f"Продажа предмета: {item_name}")
            )
            
            # Получаем новый баланс
            cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
            new_balance = cursor.fetchone()[0]
            
            # Получаем обновленные данные
            webapp_data = get_user_data_for_webapp(user_id)
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': new_balance
            }
            response.update(webapp_data)
            
            await message.answer(json.dumps(response), parse_mode=None)
            conn.commit()
            conn.close()
            
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