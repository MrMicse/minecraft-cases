import os
import asyncio
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import random
from dotenv import load_dotenv
import logging

from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message, InlineKeyboardMarkup, 
    InlineKeyboardButton, WebAppInfo, CallbackQuery,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove
)
from aiogram.filters import Command, CommandObject
from aiogram.enums import ParseMode
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.client.default import DefaultBotProperties

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DB_PATH = os.getenv('DATABASE_URL', 'sqlite:///minecraft_cases.db').replace('sqlite:///', '')

# Проверка обязательных переменных
if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

# Инициализация бота с новым синтаксисом
bot = Bot(
    token=BOT_TOKEN,
    default=DefaultBotProperties(parse_mode=ParseMode.HTML)
)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)
router = Router()
dp.include_router(router)

# Состояния для админ панели
class AdminStates(StatesGroup):
    waiting_for_user_id = State()
    waiting_for_amount = State()
    waiting_for_item_name = State()
    waiting_for_item_rarity = State()
    waiting_for_item_price = State()
    waiting_for_case_name = State()
    waiting_for_case_price = State()

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
        balance INTEGER DEFAULT 1000,
        experience INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        daily_bonus_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица предметов
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
    
    # Таблица транзакций
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transactions (
        transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward', 'admin_add', 'admin_remove')),
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')
    
    conn.commit()
    
    # Добавляем тестовые данные если таблицы пустые
    cursor.execute("SELECT COUNT(*) FROM items")
    if cursor.fetchone()[0] == 0:
        add_initial_data(cursor)
    
    conn.commit()
    conn.close()
    logger.info(f"✅ База данных инициализирована: {DB_PATH}")

def add_initial_data(cursor):
    """Добавление начальных данных"""
    logger.info("📦 Добавление начальных данных...")
    
    # Предметы Minecraft
    minecraft_items = [
        # Common
        ("Яблоко", "🍎", "common", "food", 40, 20, "Восстанавливает 2 единицы голода", "apple.png"),
        ("Хлеб", "🍞", "common", "food", 45, 22, "Восстанавливает 5 единиц голода", "bread.png"),
        ("Мясо", "🍖", "common", "food", 50, 25, "Восстанавливает 8 единиц голода", "meat.png"),
        ("Уголь", "⚫", "common", "resources", 30, 15, "Топливо и краситель", "coal.png"),
        ("Железный слиток", "⛓️", "common", "resources", 50, 25, "Базовый ресурс для крафта", "iron.png"),
        ("Золотой слиток", "🟨", "common", "resources", 80, 40, "Редкий ресурс", "gold.png"),
        
        # Uncommon
        ("Алмаз", "💎", "uncommon", "resources", 150, 75, "Ценный минерал", "diamond.png"),
        ("Изумруд", "🟩", "uncommon", "resources", 200, 100, "Торговая валюта", "emerald.png"),
        ("Железный меч", "⚔️", "uncommon", "weapons", 180, 90, "Базовое оружие", "iron_sword.png"),
        ("Лук", "🏹", "uncommon", "weapons", 120, 60, "Дальнобойное оружие", "bow.png"),
        
        # Rare
        ("Алмазный меч", "⚔️💎", "rare", "weapons", 250, 125, "Мощное оружие", "diamond_sword.png"),
        ("Алмазная кирка", "⛏️💎", "rare", "tools", 300, 150, "Быстрая добыча", "diamond_pickaxe.png"),
        ("Незеритовый слиток", "🔱", "rare", "resources", 500, 250, "Элитный материал", "netherite.png"),
        
        # Epic
        ("Тотем бессмертия", "🐦", "epic", "special", 1000, 500, "Спасение от смерти", "totem.png"),
        ("Сердце моря", "💙", "epic", "resources", 1200, 600, "Редкая реликвия", "heart.png"),
        
        # Legendary
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
        ("Кейс с Едой", 100, "🍎", "Содержит разнообразную еду", 
         '{"common": 70, "uncommon": 30}', "case_food.png"),
        ("Ресурсный Кейс", 250, "⛏️", "Руды, минералы и ресурсы", 
         '{"common": 50, "uncommon": 40, "rare": 10}', "case_resources.png"),
        ("Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
         '{"uncommon": 40, "rare": 50, "epic": 10}', "case_weapons.png"),
        ("Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
         '{"rare": 30, "epic": 50, "legendary": 20}', "case_legendary.png"),
    ]
    
    cursor.executemany(
        """INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        cases
    )
    
    logger.info(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

# ======================= ФУНКЦИИ БАЗЫ ДАННЫХ =======================

def get_user(user_id: int) -> Dict:
    """Получение или создание пользователя"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT user_id, username, first_name, last_name, balance, experience, level, daily_bonus_date 
           FROM users WHERE user_id = ?""",
        (user_id,)
    )
    
    user_data = cursor.fetchone()
    if not user_data:
        # Создаем нового пользователя
        cursor.execute(
            """INSERT INTO users (user_id, balance, experience, level) 
               VALUES (?, 1000, 0, 1)""",
            (user_id,)
        )
        conn.commit()
        
        # Создаем стартовую транзакцию
        cursor.execute(
            """INSERT INTO transactions (user_id, type, amount, description) 
               VALUES (?, 'reward', 1000, 'Стартовый бонус')""",
            (user_id,)
        )
        conn.commit()
        
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance, experience, level, daily_bonus_date 
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
        "daily_bonus_date": user_data[7]
    }

def update_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> Dict:
    """Обновление баланса пользователя с синхронизацией"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
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
        
        # Получаем новый баланс
        cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
        new_balance = cursor.fetchone()[0]
        
        conn.commit()
        
        return {
            "success": True,
            "new_balance": new_balance,
            "amount": amount,
            "type": transaction_type
        }
        
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Ошибка обновления баланса: {e}")
        return {
            "success": False,
            "error": str(e)
        }
        
    finally:
        conn.close()

def get_user_for_webapp(user_id: int) -> Dict:
    """Получение данных пользователя для веб-приложения"""
    user = get_user(user_id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем инвентарь
    cursor.execute('''
    SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price, 
           i.description, inv.quantity, inv.obtained_at
    FROM inventory inv
    JOIN items i ON inv.item_id = i.item_id
    WHERE inv.user_id = ?
    ORDER BY inv.obtained_at DESC
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
            "quantity": row[8],
            "obtained_at": row[9]
        })
    
    # Получаем статистику
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user_id,)
    )
    cases_opened = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        **user,
        "inventory": inventory,
        "stats": {
            "cases_opened": cases_opened,
            "total_items": len(inventory)
        }
    }

def get_cases_for_webapp() -> List[Dict]:
    """Получение кейсов для веб-приложения"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT case_id, name, price, icon, description, rarity_weights FROM cases WHERE is_active = TRUE"
    )
    
    cases = []
    for row in cursor.fetchall():
        cases.append({
            "id": row[0],
            "name": row[1],
            "price": row[2],
            "icon": row[3],
            "description": row[4],
            "rarity_weights": json.loads(row[5])
        })
    
    conn.close()
    return cases

# ======================= ОБРАБОТЧИКИ КОМАНД =======================

@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    logger.info(f"📥 /start от {message.from_user.id}")
    
    user = get_user(message.from_user.id)
    
    # Обновляем время последнего входа
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?",
        (user["user_id"],)
    )
    
    # Обновляем имя пользователя если изменилось
    if message.from_user.username != user["username"] or message.from_user.first_name != user["first_name"]:
        cursor.execute(
            "UPDATE users SET username = ?, first_name = ? WHERE user_id = ?",
            (message.from_user.username, message.from_user.first_name, user["user_id"])
        )
    
    conn.commit()
    conn.close()
    
    # Клавиатура с веб-приложением
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🎮 Открыть Minecraft Кейсы",
                    web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
                )
            ],
            [
                InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
                InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory")
            ],
            [
                InlineKeyboardButton(text="💰 Пополнить", callback_data="deposit"),
                InlineKeyboardButton(text="📊 Статистика", callback_data="stats")
            ]
        ]
    )
    
    welcome_text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening!</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> /daily
📊 <b>Статистика:</b> /stats

<i>Начни открывать кейсы прямо сейчас!</i>
    """
    
    await message.answer(welcome_text, reply_markup=keyboard)
    logger.info(f"📤 Отправлен welcome сообщение для {message.from_user.id}")

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    user = get_user(message.from_user.id)
    
    text = f"""
💰 <b>Баланс и статистика</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']}
📅 <b>Последний вход:</b> {datetime.now().strftime('%d.%m.%Y %H:%M')}
    """
    
    await message.answer(text)

@router.message(Command("daily"))
async def cmd_daily(message: Message):
    """Ежедневный бонус"""
    user_id = message.from_user.id
    user = get_user(user_id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    today = datetime.now().date()
    
    if user["daily_bonus_date"]:
        last_daily = datetime.strptime(user["daily_bonus_date"], "%Y-%m-%d").date()
        if last_daily == today:
            await message.answer("🎁 Вы уже получали ежедневный бонус сегодня!")
            conn.close()
            return
    
    # Начисляем бонус
    daily_amount = 100
    result = update_balance(
        user_id, daily_amount, "reward", "Ежедневный бонус"
    )
    
    if result["success"]:
        # Обновляем дату получения бонуса
        cursor.execute(
            "UPDATE users SET daily_bonus_date = ? WHERE user_id = ?",
            (today, user_id)
        )
        conn.commit()
        
        text = f"""
🎁 <b>Ежедневный бонус получен!</b>

💰 +{daily_amount} 💎 добавлено на баланс
📈 <b>Новый баланс:</b> {result['new_balance']} 💎

🕐 Следующий бонус через 24 часа!
        """
        await message.answer(text)
        logger.info(f"🎁 Начислен ежедневный бонус пользователю {user_id}")
    else:
        await message.answer("❌ Произошла ошибка при начислении бонуса")
    
    conn.close()

@router.message(Command("inventory"))
async def cmd_inventory(message: Message):
    """Просмотр инвентаря"""
    user = get_user(message.from_user.id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT i.name, i.icon, i.rarity, i.price, COUNT(*) as quantity
    FROM inventory inv
    JOIN items i ON inv.item_id = i.item_id
    WHERE inv.user_id = ?
    GROUP BY i.item_id
    ORDER BY i.rarity DESC, i.price DESC
    LIMIT 20
    ''', (user["user_id"],))
    
    items = cursor.fetchall()
    conn.close()
    
    if not items:
        await message.answer("🎒 <b>Ваш инвентарь пуст!</b>\n\nОткройте кейсы, чтобы получить предметы! ⛏️")
        return
    
    # Группируем по редкости
    items_by_rarity = {}
    total_value = 0
    
    for name, icon, rarity, price, quantity in items:
        total_value += price * quantity
        if rarity not in items_by_rarity:
            items_by_rarity[rarity] = []
        items_by_rarity[rarity].append(f"{icon} {name} ×{quantity} - {price * quantity}💎")
    
    text = f"""
🎒 <b>Ваш инвентарь</b>

📦 <b>Всего предметов:</b> {sum(item[4] for item in items)}
💰 <b>Общая стоимость:</b> {total_value} 💎

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
            text += f"\n{rarity_names[rarity]}:\n"
            for item_text in items_by_rarity[rarity][:5]:
                text += f"• {item_text}\n"
            if len(items_by_rarity[rarity]) > 5:
                text += f"... и еще {len(items_by_rarity[rarity]) - 5}\n"
    
    text += "\n📱 <b>Для детального просмотра используйте веб-приложение!</b>"
    
    await message.answer(text)

@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Статистика пользователя"""
    user = get_user(message.from_user.id)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Получаем статистику
    cursor.execute(
        "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
        (user["user_id"],)
    )
    cases_opened = cursor.fetchone()[0]
    
    cursor.execute(
        "SELECT COUNT(DISTINCT item_id) FROM inventory WHERE user_id = ?",
        (user["user_id"],)
    )
    unique_items = cursor.fetchone()[0]
    
    cursor.execute(
        """SELECT i.rarity, COUNT(*) 
           FROM inventory inv 
           JOIN items i ON inv.item_id = i.item_id 
           WHERE inv.user_id = ? 
           GROUP BY i.rarity""",
        (user["user_id"],)
    )
    
    rarity_stats = cursor.fetchall()
    conn.close()
    
    rarity_text = ""
    for rarity, count in rarity_stats:
        rarity_names = {
            'common': '⚪ Обычные',
            'uncommon': '🟢 Необычные',
            'rare': '🔵 Редкие',
            'epic': '🟣 Эпические',
            'legendary': '🟡 Легендарные'
        }
        rarity_text += f"{rarity_names.get(rarity, rarity)}: {count}\n"
    
    text = f"""
📊 <b>Статистика игрока</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']}

🎁 <b>Открыто кейсов:</b> {cases_opened}
📦 <b>Уникальных предметов:</b> {unique_items}

<b>Распределение по редкостям:</b>
{rarity_text}
    """
    
    await message.answer(text)

@router.message(Command("help"))
async def cmd_help(message: Message):
    """Справка по командам"""
    text = """
⛏️ <b>Minecraft Case Bot - Помощь</b>

<b>Основные команды:</b>
/start - Запустить бота
/help - Показать справку
/balance - Показать баланс
/daily - Ежедневный бонус (100💎)
/inventory - Просмотр инвентаря
/stats - Статистика игрока
/cases - Доступные кейсы

<b>Игровой процесс:</b>
1. Нажмите кнопку "Открыть Minecraft Кейсы"
2. Выберите кейс в веб-приложении
3. Откройте кейс и получите предмет
4. Собирайте коллекцию!

<b>Редкости предметов:</b>
⚪ Обычный - 70% шанс
🟢 Необычный - 20% шанс
🔵 Редкий - 7% шанс
🟣 Эпический - 2.5% шанс
🟡 Легендарный - 0.5% шанс
    """
    
    await message.answer(text)

# ======================= WEB APP ОБРАБОТЧИК =======================

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App"""
    try:
        logger.info(f"🌐 WebApp данные от {message.from_user.id}")
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        if data.get('action') == 'init':
            # Инициализация приложения
            user_data = get_user_for_webapp(user_id)
            cases_data = get_cases_for_webapp()
            
            response = {
                'success': True,
                'user': user_data,
                'cases': cases_data,
                'config': {
                    'min_bet': 10,
                    'max_bet': 10000,
                    'daily_bonus': 100,
                    'version': '2.0.0'
                }
            }
            
            await message.answer(json.dumps(response))
            logger.info(f"📤 Отправлены данные инициализации для {user_id}")
            
        elif data.get('action') == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            logger.info(f"🎰 {user_id} открывает кейс {case_id}")
            
            # Получаем информацию о кейсе
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT price, rarity_weights FROM cases WHERE case_id = ?",
                (case_id,)
            )
            case_data = cursor.fetchone()
            
            if not case_data:
                await message.answer(json.dumps({'error': 'Кейс не найден'}))
                conn.close()
                return
            
            case_price, rarity_weights_json = case_data
            rarity_weights = json.loads(rarity_weights_json)
            
            # Проверяем баланс
            cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
            balance = cursor.fetchone()[0]
            
            if balance < case_price:
                await message.answer(json.dumps({'error': 'Недостаточно средств'}))
                conn.close()
                return
            
            # Выбираем редкость по весам
            total_weight = sum(rarity_weights.values())
            random_value = random.uniform(0, total_weight)
            
            selected_rarity = None
            cumulative_weight = 0
            for rarity, weight in rarity_weights.items():
                cumulative_weight += weight
                if random_value <= cumulative_weight:
                    selected_rarity = rarity
                    break
            
            # Выбираем случайный предмет выбранной редкости
            cursor.execute(
                """SELECT item_id, name, icon, rarity, price, description 
                   FROM items WHERE rarity = ? ORDER BY RANDOM() LIMIT 1""",
                (selected_rarity,)
            )
            
            item_data = cursor.fetchone()
            if not item_data:
                await message.answer(json.dumps({'error': 'Не удалось выбрать предмет'}))
                conn.close()
                return
            
            item = {
                "item_id": item_data[0],
                "name": item_data[1],
                "icon": item_data[2],
                "rarity": item_data[3],
                "price": item_data[4],
                "description": item_data[5]
            }
            
            # Списание средств
            result = update_balance(
                user_id, -case_price, "purchase", 
                f"Покупка кейса: {case_id}"
            )
            
            if not result["success"]:
                await message.answer(json.dumps({'error': 'Ошибка списания средств'}))
                conn.close()
                return
            
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
            
            response = {
                'success': True,
                'item': item,
                'new_balance': result['new_balance'],
                'experience_gained': experience_gained,
                'case_price': case_price
            }
            
            # Уведомление для редких предметов
            if item['rarity'] in ['epic', 'legendary']:
                notification = f"""
🎉 <b>УДАЧА В КЕЙСАХ!</b>

{message.from_user.first_name} получил предмет <b>{item['rarity']}</b> редкости:

🏆 <b>{item['name']}</b> {item['icon']}
💰 <b>Стоимость:</b> {item['price']} 💎

Поздравляем! 🎊
                """
                await message.answer(notification)
            
            await message.answer(json.dumps(response))
            logger.info(f"📤 Результат открытия отправлен для {user_id}")
            
        elif data.get('action') == 'sell_item':
            # Продажа предмета
            item_id = data.get('item_id')
            logger.info(f"💰 {user_id} продает предмет {item_id}")
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            # Получаем цену продажи
            cursor.execute("SELECT sell_price FROM items WHERE item_id = ?", (item_id,))
            item_data = cursor.fetchone()
            
            if not item_data:
                await message.answer(json.dumps({'error': 'Предмет не найден'}))
                conn.close()
                return
            
            # Удаляем один экземпляр предмета
            cursor.execute(
                """DELETE FROM inventory 
                   WHERE rowid = (
                       SELECT rowid FROM inventory 
                       WHERE user_id = ? AND item_id = ? 
                       LIMIT 1
                   )""",
                (user_id, item_id)
            )
            
            if cursor.rowcount == 0:
                await message.answer(json.dumps({'error': 'Предмет не найден в инвентаре'}))
                conn.close()
                return
            
            # Добавляем деньги
            sell_price = item_data[0]
            result = update_balance(
                user_id, sell_price, "reward", f"Продажа предмета {item_id}"
            )
            
            if not result["success"]:
                await message.answer(json.dumps({'error': 'Ошибка начисления средств'}))
                conn.close()
                return
            
            conn.commit()
            conn.close()
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': result['new_balance']
            }
            
            await message.answer(json.dumps(response))
            
        elif data.get('action') == 'get_user_data':
            # Получение данных пользователя
            user_data = get_user_for_webapp(user_id)
            await message.answer(json.dumps({
                'success': True,
                'user': user_data
            }))
            
    except Exception as e:
        logger.error(f"❌ Ошибка WebApp: {e}")
        error_msg = str(e) if DEBUG else "Произошла ошибка"
        await message.answer(json.dumps({'error': error_msg}))

# ======================= АДМИН ПАНЕЛЬ =======================

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ панель"""
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ У вас нет прав администратора!")
        return
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💰 Выдать кристаллы", callback_data="admin_add_balance"),
                InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")
            ],
            [
                InlineKeyboardButton(text="👥 Пользователи", callback_data="admin_users"),
                InlineKeyboardButton(text="🎁 Управление предметами", callback_data="admin_items")
            ],
            [
                InlineKeyboardButton(text="📦 Управление кейсами", callback_data="admin_cases"),
                InlineKeyboardButton(text="📈 Системная информация", callback_data="admin_system")
            ]
        ]
    )
    
    await message.answer("👑 <b>Админ панель</b>", reply_markup=keyboard)

@router.callback_query(F.data == "admin_add_balance")
async def admin_add_balance(callback: CallbackQuery, state: FSMContext):
    """Выдача кристаллов пользователю"""
    await callback.message.edit_text(
        "👑 <b>Выдача кристаллов</b>\n\n"
        "Введите ID пользователя и количество кристаллов в формате:\n"
        "<code>ID_пользователя количество</code>\n\n"
        "Пример: <code>123456789 1000</code>",
        parse_mode=ParseMode.HTML
    )
    await state.set_state(AdminStates.waiting_for_amount)

@router.message(AdminStates.waiting_for_amount)
async def process_admin_balance(message: Message, state: FSMContext):
    """Обработка выдачи кристаллов"""
    try:
        parts = message.text.split()
        if len(parts) != 2:
            await message.answer("❌ Неправильный формат. Используйте: ID количество")
            return
        
        user_id = int(parts[0])
        amount = int(parts[1])
        
        if amount <= 0:
            await message.answer("❌ Количество должно быть положительным числом")
            return
        
        # Проверяем существование пользователя
        user = get_user(user_id)
        
        # Выдаем кристаллы
        result = update_balance(
            user_id, amount, "admin_add", 
            f"Выдача администратором {message.from_user.id}"
        )
        
        if result["success"]:
            await message.answer(
                f"✅ <b>Кристаллы успешно выданы!</b>\n\n"
                f"👤 Пользователь: {user['first_name']} (ID: {user_id})\n"
                f"💰 Сумма: {amount} 💎\n"
                f"📈 Новый баланс: {result['new_balance']} 💎",
                parse_mode=ParseMode.HTML
            )
            logger.info(f"👑 Админ {message.from_user.id} выдал {amount}💎 пользователю {user_id}")
        else:
            await message.answer(f"❌ Ошибка: {result.get('error', 'Неизвестная ошибка')}")
            
    except ValueError:
        await message.answer("❌ Неправильный формат чисел")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {str(e)}")
    
    await state.clear()

@router.callback_query(F.data == "admin_stats")
async def admin_stats(callback: CallbackQuery):
    """Статистика системы"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Общая статистика
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(balance) FROM users")
    total_balance = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT COUNT(*) FROM opening_history")
    total_openings = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM transactions WHERE type = 'purchase'")
    total_purchases = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inventory")
    total_items = cursor.fetchone()[0]
    
    # Топ пользователей по балансу
    cursor.execute(
        "SELECT user_id, first_name, balance FROM users ORDER BY balance DESC LIMIT 10"
    )
    top_users = cursor.fetchall()
    
    conn.close()
    
    text = f"""
📊 <b>Системная статистика</b>

👥 <b>Всего пользователей:</b> {total_users}
💰 <b>Общий баланс системы:</b> {total_balance} 💎
🎰 <b>Открыто кейсов:</b> {total_openings}
🛒 <b>Покупок:</b> {total_purchases}
📦 <b>Предметов в инвентарях:</b> {total_items}

🏆 <b>Топ-10 по балансу:</b>
"""
    
    for i, (user_id, first_name, balance) in enumerate(top_users, 1):
        text += f"{i}. {first_name} (ID: {user_id}) - {balance} 💎\n"
    
    await callback.message.edit_text(text, parse_mode=ParseMode.HTML)
    await callback.answer()

@router.callback_query(F.data == "admin_users")
async def admin_users(callback: CallbackQuery):
    """Управление пользователями"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT user_id, first_name, balance, level, created_at 
           FROM users 
           ORDER BY created_at DESC 
           LIMIT 20"""
    )
    
    users = cursor.fetchall()
    conn.close()
    
    text = "👥 <b>Последние 20 пользователей</b>\n\n"
    
    for user_id, first_name, balance, level, created_at in users:
        text += f"👤 {first_name} (ID: {user_id})\n"
        text += f"   💰 Баланс: {balance} 💎 | 🎮 Уровень: {level}\n"
        text += f"   📅 Регистрация: {created_at.split()[0]}\n\n"
    
    await callback.message.edit_text(text, parse_mode=ParseMode.HTML)
    await callback.answer()

# ======================= ОБРАБОТЧИКИ КОЛБЭКОВ =======================

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
    
    cursor.execute(
        "SELECT COUNT(*) FROM inventory WHERE user_id = ?",
        (user["user_id"],)
    )
    total_items = cursor.fetchone()[0]
    
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
📦 <b>Предметов в инвентаре:</b> {total_items}
📅 <b>Дата регистрации:</b> {datetime.now().strftime('%d.%m.%Y')}
    """
    
    await callback.message.edit_text(text, parse_mode=ParseMode.HTML)
    await callback.answer()

@router.callback_query(F.data == "inventory")
async def show_inventory(callback: CallbackQuery):
    """Показать инвентарь"""
    await cmd_inventory(callback.message)
    await callback.answer()

# ======================= ЗАПУСК БОТА =======================

async def main():
    """Основная функция запуска бота"""
    # Инициализация базы данных
    init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"🤖 Бот успешно запущен!")
    print(f"👑 Админ ID: {ADMIN_ID}")
    print(f"🗄️ База данных: {DB_PATH}")
    print("=" * 50)
    print("⛏️ Ожидание команд...")
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        logger.error(f"❌ Ошибка при запуске бота: {e}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")