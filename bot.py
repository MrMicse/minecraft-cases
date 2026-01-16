import os
import asyncio
import json
import random
import sqlite3
from datetime import datetime
from typing import Dict, List
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

BOT_TOKEN = os.getenv('BOT_TOKEN')
ADMIN_ID = int(os.getenv('ADMIN_ID', 0))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
DATABASE_URL = os.getenv('DATABASE_URL')
WEB_APP_URL = os.getenv('WEB_APP_URL', 'https://mrmicse.github.io/minecraft-cases/')

if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

# Проверяем тип базы данных
USE_POSTGRES = False
DB_PATH = 'minecraft_cases.db'

if DATABASE_URL and DATABASE_URL.startswith('postgresql://'):
    USE_POSTGRES = True
    print("🔗 Используется PostgreSQL")
else:
    print("💾 Используется SQLite (локальная база)")

# ==================== БАЗА ДАННЫХ ====================

def init_db():
    """Инициализация базы данных"""
    if USE_POSTGRES:
        return init_postgres_db()
    else:
        return init_sqlite_db()

def init_sqlite_db():
    """Инициализация SQLite базы данных"""
    print(f"💾 Инициализация SQLite базы: {DB_PATH}")
    
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
        FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
        UNIQUE(user_id, item_id)
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
        add_initial_data_sqlite(cursor, conn)
    
    conn.commit()
    conn.close()
    print(f"✅ SQLite база данных инициализирована: {DB_PATH}")

def init_postgres_db():
    """Инициализация PostgreSQL базы данных"""
    print("🔗 Попытка подключения к PostgreSQL...")
    
    try:
        import psycopg2
        import urllib.parse as urlparse
        
        result = urlparse.urlparse(DATABASE_URL)
        
        # Синхронное подключение для инициализации
        conn = psycopg2.connect(
            dbname=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port
        )
        
        cursor = conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
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
        
        # Таблица предметов
        cursor.execute('''
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
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            inventory_id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            item_id INTEGER NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
            quantity INTEGER DEFAULT 1,
            obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_favorite BOOLEAN DEFAULT FALSE,
            UNIQUE(user_id, item_id)
        )
        ''')
        
        # Таблица кейсов
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS cases (
            case_id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            icon TEXT NOT NULL,
            description TEXT,
            rarity_weights JSONB NOT NULL,
            texture_url TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Таблица истории открытий
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS opening_history (
            history_id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(user_id),
            case_id INTEGER NOT NULL REFERENCES cases(case_id),
            item_id INTEGER NOT NULL REFERENCES items(item_id),
            opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Таблица транзакций
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(user_id),
            type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'purchase', 'reward')),
            amount INTEGER NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()
        
        # Проверяем, есть ли данные
        cursor.execute("SELECT COUNT(*) FROM items")
        if cursor.fetchone()[0] == 0:
            add_initial_data_postgres(cursor, conn)
        
        conn.commit()
        conn.close()
        print(f"✅ PostgreSQL база данных инициализирована")
        
    except ImportError:
        print("⚠️ psycopg2 не установлен, используем SQLite")
        global USE_POSTGRES
        USE_POSTGRES = False
        init_sqlite_db()
    except Exception as e:
        print(f"❌ Ошибка подключения к PostgreSQL: {e}")
        print("⚠️ Используем SQLite как запасной вариант")
        USE_POSTGRES = False
        init_sqlite_db()

def add_initial_data_sqlite(cursor, conn):
    """Добавление начальных данных в SQLite"""
    print("📦 Добавление начальных данных в SQLite...")
    
    # Minecraft предметы
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
    
    cursor.executemany(
        """INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        minecraft_items
    )
    
    # Кейсы
    cases = [
        ("🍎 Кейс с Едой", 100, "🍎", "Содержит разнообразную еду и напитки", 
         '{"common": 70, "uncommon": 30}', "case_food.png"),
        ("⛏️ Ресурсный Кейс", 250, "⛏️", "Руды, минералы и базовые ресурсы", 
         '{"common": 50, "uncommon": 40, "rare": 10}', "case_resources.png"),
        ("⚔️ Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
         '{"uncommon": 40, "rare": 50, "epic": 10}', "case_weapons.png"),
        ("🌟 Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
         '{"rare": 30, "epic": 50, "legendary": 20}', "case_legendary.png"),
        ("👑 Донат Кейс", 5000, "👑", "Эксклюзивные донат предметы", 
         '{"epic": 40, "legendary": 60}', "case_donate.png"),
        ("🧰 Случайный Кейс", 750, "🧰", "Микс из всех категорий", 
         '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}', "case_random.png"),
    ]
    
    cursor.executemany(
        """INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        cases
    )
    
    conn.commit()
    print(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

def add_initial_data_postgres(cursor, conn):
    """Добавление начальных данных в PostgreSQL"""
    print("📦 Добавление начальных данных в PostgreSQL...")
    
    # Minecraft предметы
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
    
    for item in minecraft_items:
        cursor.execute('''
            INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', item)
    
    # Кейсы
    cases = [
        ("🍎 Кейс с Едой", 100, "🍎", "Содержит разнообразную еду и напитки", 
         '{"common": 70, "uncommon": 30}', "case_food.png"),
        ("⛏️ Ресурсный Кейс", 250, "⛏️", "Руды, минералы и базовые ресурсы", 
         '{"common": 50, "uncommon": 40, "rare": 10}', "case_resources.png"),
        ("⚔️ Оружейный Кейс", 500, "⚔️", "Оружие, броня и инструменты", 
         '{"uncommon": 40, "rare": 50, "epic": 10}', "case_weapons.png"),
        ("🌟 Легендарный Кейс", 1000, "🌟", "Уникальные и легендарные предметы", 
         '{"rare": 30, "epic": 50, "legendary": 20}', "case_legendary.png"),
        ("👑 Донат Кейс", 5000, "👑", "Эксклюзивные донат предметы", 
         '{"epic": 40, "legendary": 60}', "case_donate.png"),
        ("🧰 Случайный Кейс", 750, "🧰", "Микс из всех категорий", 
         '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}', "case_random.png"),
    ]
    
    for case in cases:
        cursor.execute('''
            INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s)
        ''', case)
    
    conn.commit()
    print(f"✅ Добавлено {len(minecraft_items)} предметов и {len(cases)} кейсов")

# ==================== ФУНКЦИИ РАБОТЫ С БАЗОЙ ====================

def get_db_connection():
    """Получение соединения с базой данных"""
    if USE_POSTGRES:
        try:
            import psycopg2
            import urllib.parse as urlparse
            
            result = urlparse.urlparse(DATABASE_URL)
            conn = psycopg2.connect(
                dbname=result.path[1:],
                user=result.username,
                password=result.password,
                host=result.hostname,
                port=result.port
            )
            return conn
        except Exception as e:
            print(f"❌ Ошибка подключения к PostgreSQL: {e}")
            # Fallback на SQLite
            return sqlite3.connect(DB_PATH)
    else:
        return sqlite3.connect(DB_PATH)

def get_user(user_id: int) -> Dict:
    """Получение или создание пользователя"""
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance, experience, level 
               FROM users WHERE user_id = %s""",
            (user_id,)
        )
        user_data = cursor.fetchone()
        
        if not user_data:
            cursor.execute(
                """INSERT INTO users (user_id, balance, experience, level, last_login) 
                   VALUES (%s, 1000, 0, 1, CURRENT_TIMESTAMP)""",
                (user_id,)
            )
            conn.commit()
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (%s, 'reward', 1000, 'Стартовый бонус')""",
                (user_id,)
            )
            conn.commit()
            
            cursor.execute(
                """SELECT user_id, username, first_name, last_name, balance, experience, level 
                   FROM users WHERE user_id = %s""",
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
    else:
        # SQLite
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
                   VALUES (?, 1000, 0, 1, CURRENT_TIMESTAMP)""",
                (user_id,)
            )
            conn.commit()
            
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (?, 'reward', 1000, 'Стартовый бонус')""",
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

def update_user_info(user_id: int, username: str, first_name: str, last_name: str):
    """Обновление информации о пользователе (СИНХРОННАЯ функция)"""
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE users 
               SET username = %s, first_name = %s, last_name = %s, last_login = CURRENT_TIMESTAMP 
               WHERE user_id = %s""",
            (username, first_name, last_name, user_id)
        )
    else:
        cursor = conn.cursor()
        cursor.execute(
            """UPDATE users 
               SET username = ?, first_name = ?, last_name = ?, last_login = CURRENT_TIMESTAMP 
               WHERE user_id = ?""",
            (username, first_name, last_name, user_id)
        )
    
    conn.commit()
    conn.close()

def update_balance(user_id: int, amount: int, transaction_type: str, description: str = "") -> int:
    """Обновление баланса пользователя"""
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET balance = balance + %s WHERE user_id = %s",
            (amount, user_id)
        )
        
        cursor.execute(
            """INSERT INTO transactions (user_id, type, amount, description) 
               VALUES (%s, %s, %s, %s)""",
            (user_id, transaction_type, amount, description)
        )
        
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
        new_balance = cursor.fetchone()[0]
    else:
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
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price, 
               i.description, i.texture_url, inv.quantity, inv.obtained_at, inv.is_favorite
        FROM inventory inv
        JOIN items i ON inv.item_id = i.item_id
        WHERE inv.user_id = %s
        ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
        ''', (user_id,))
    else:
        cursor = conn.cursor()
        cursor.execute('''
        SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price, 
               i.description, i.texture_url, inv.quantity, inv.obtained_at, inv.is_favorite
        FROM inventory inv
        JOIN items i ON inv.item_id = i.item_id
        WHERE inv.user_id = ?
        ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
        ''', (user_id,))
    
    rows = cursor.fetchall()
    inventory = []
    
    for row in rows:
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
            "obtained_at": row[10].isoformat() if hasattr(row[10], 'isoformat') else row[10],
            "is_favorite": bool(row[11])
        })
    
    conn.close()
    return inventory

def get_cases() -> List[Dict]:
    """Получение списка кейсов"""
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT case_id, name, price, icon, description, rarity_weights, texture_url FROM cases WHERE is_active = TRUE"
        )
    else:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT case_id, name, price, icon, description, rarity_weights, texture_url FROM cases WHERE is_active = TRUE"
        )
    
    rows = cursor.fetchall()
    cases = []
    
    for row in rows:
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
    conn = get_db_connection()
    
    if USE_POSTGRES:
        cursor = conn.cursor()
        # Получаем информацию о кейсе
        cursor.execute(
            "SELECT case_id, name, price, rarity_weights FROM cases WHERE case_id = %s",
            (case_id,)
        )
    else:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT case_id, name, price, rarity_weights FROM cases WHERE case_id = ?",
            (case_id,)
        )
    
    case_data = cursor.fetchone()
    
    if not case_data:
        conn.close()
        return {"error": "Кейс не найден"}
    
    case_name = case_data[1]
    case_price = case_data[2]
    rarity_weights = json.loads(case_data[3])
    
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
    
    # Получаем случайный предмет выбранной редкости
    if USE_POSTGRES:
        cursor.execute(
            """SELECT item_id, name, icon, rarity, price, description, texture_url 
               FROM items WHERE rarity = %s ORDER BY RANDOM() LIMIT 1""",
            (selected_rarity,)
        )
    else:
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
    if USE_POSTGRES:
        cursor.execute("SELECT balance FROM users WHERE user_id = %s", (user_id,))
    else:
        cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    
    balance = cursor.fetchone()[0]
    
    if balance < case_price:
        conn.close()
        return {"error": "Недостаточно средств"}
    
    # Списание средств
    new_balance = update_balance(
        user_id, -case_price, "purchase", 
        f"Покупка кейса: {case_name}"
    )
    
    # Добавляем предмет в инвентарь
    try:
        if USE_POSTGRES:
            cursor.execute('''
                INSERT INTO inventory (user_id, item_id, quantity)
                VALUES (%s, %s, 1)
                ON CONFLICT (user_id, item_id) 
                DO UPDATE SET quantity = inventory.quantity + 1
            ''', (user_id, item["item_id"]))
        else:
            # SQLite не поддерживает ON CONFLICT UPDATE напрямую для нашего случая
            cursor.execute(
                "SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?",
                (user_id, item["item_id"])
            )
            existing = cursor.fetchone()
            
            if existing:
                cursor.execute(
                    "UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?",
                    (user_id, item["item_id"])
                )
            else:
                cursor.execute(
                    "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, 1)",
                    (user_id, item["item_id"])
                )
    except Exception as e:
        print(f"❌ Ошибка добавления в инвентарь: {e}")
        if USE_POSTGRES:
            cursor.execute(
                "INSERT INTO inventory (user_id, item_id, quantity) VALUES (%s, %s, 1)",
                (user_id, item["item_id"])
            )
        else:
            cursor.execute(
                "INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, 1)",
                (user_id, item["item_id"])
            )
    
    # Добавляем в историю открытий
    if USE_POSTGRES:
        cursor.execute(
            """INSERT INTO opening_history (user_id, case_id, item_id) 
               VALUES (%s, %s, %s)""",
            (user_id, case_id, item["item_id"])
        )
    else:
        cursor.execute(
            """INSERT INTO opening_history (user_id, case_id, item_id) 
               VALUES (?, ?, ?)""",
            (user_id, case_id, item["item_id"])
        )
    
    # Начисляем опыт
    experience_gained = case_price // 10
    if USE_POSTGRES:
        cursor.execute(
            "UPDATE users SET experience = experience + %s WHERE user_id = %s",
            (experience_gained, user_id)
        )
    else:
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

# ==================== ОБРАБОТЧИКИ КОМАНД ====================

@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    user_id = message.from_user.id
    
    # Обновляем информацию о пользователе (СИНХРОННЫЙ вызов)
    update_user_info(
        user_id,
        message.from_user.username or "",
        message.from_user.first_name or "",
        message.from_user.last_name or ""
    )
    
    user = get_user(user_id)
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⛏️ Открыть Minecraft Кейсы",
                    web_app=WebAppInfo(url=WEB_APP_URL)
                )
            ],
            [
                InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
                InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory")
            ],
            [
                InlineKeyboardButton(text="💰 Пополнить баланс", callback_data="deposit"),
                InlineKeyboardButton(text="📊 Статистика", callback_data="stats")
            ]
        ]
    )
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_POSTGRES:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = %s",
            (user_id,)
        )
    else:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
            (user_id,)
        )
    
    total_spent = cursor.fetchone()[0] or 0
    conn.close()
    
    text = f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {message.from_user.first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
🏆 <b>Открыто кейсов:</b> {total_spent}

<code>Нажмите на кнопку ниже, чтобы начать открывать кейсы!</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    print(f"📤 Ответ отправлен пользователю {user_id}")

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    user = get_user(message.from_user.id)
    inventory = get_inventory(message.from_user.id)
    
    total_value = sum(item['price'] * item['quantity'] for item in inventory)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_POSTGRES:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = %s",
            (message.from_user.id,)
        )
        cases_opened = cursor.fetchone()[0] or 0
        
        cursor.execute(
            "SELECT COUNT(DISTINCT item_id) FROM inventory WHERE user_id = %s",
            (message.from_user.id,)
        )
        unique_items = cursor.fetchone()[0] or 0
    else:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
            (message.from_user.id,)
        )
        cases_opened = cursor.fetchone()[0] or 0
        
        cursor.execute(
            "SELECT COUNT(DISTINCT item_id) FROM inventory WHERE user_id = ?",
            (message.from_user.id,)
        )
        unique_items = cursor.fetchone()[0] or 0
    
    conn.close()
    
    text = f"""
💰 <b>Статистика аккаунта</b>

👤 <b>Игрок:</b> {message.from_user.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📦 <b>Предметов в инвентаре:</b> {len(inventory)}
🔄 <b>Уникальных предметов:</b> {unique_items}
📊 <b>Общая стоимость инвентаря:</b> {total_value} 💎
🎰 <b>Открыто кейсов:</b> {cases_opened}
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("daily"))
async def cmd_daily(message: Message):
    """Ежедневный бонус"""
    user_id = message.from_user.id
    user = get_user(user_id)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Проверяем, получал ли пользователь бонус сегодня
    if USE_POSTGRES:
        cursor.execute('''
            SELECT created_at FROM transactions 
            WHERE user_id = %s AND type = 'reward' AND description = 'Ежедневный бонус'
            ORDER BY created_at DESC LIMIT 1
        ''', (user_id,))
    else:
        cursor.execute('''
            SELECT created_at FROM transactions 
            WHERE user_id = ? AND type = 'reward' AND description = 'Ежедневный бонус'
            ORDER BY created_at DESC LIMIT 1
        ''', (user_id,))
    
    last_daily = cursor.fetchone()
    
    if last_daily:
        last_date = last_daily[0]
        if isinstance(last_date, str):
            try:
                last_date = datetime.strptime(last_date, '%Y-%m-%d %H:%M:%S')
            except:
                last_date = datetime.strptime(last_date, '%Y-%m-%d %H:%M:%S.%f')
        
        if last_date.date() == datetime.now().date():
            await message.answer("🎁 Вы уже получали ежедневный бонус сегодня!")
            conn.close()
            return
    
    # Начисляем бонус
    daily_amount = 100
    new_balance = update_balance(
        user_id, daily_amount, "reward", "Ежедневный бонус"
    )
    
    # Обновляем опыт
    if USE_POSTGRES:
        cursor.execute(
            "UPDATE users SET experience = experience + 50 WHERE user_id = %s",
            (user_id,)
        )
    else:
        cursor.execute(
            "UPDATE users SET experience = experience + 50 WHERE user_id = ?",
            (user_id,)
        )
    
    conn.commit()
    conn.close()
    
    text = f"""
🎁 <b>Ежедневный бонус получен!</b>

💰 +{daily_amount} 💎 добавлено на баланс
⭐ +50 XP получено
📈 <b>Новый баланс:</b> {new_balance} 💎

🕐 Следующий бонус через 24 часа!
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("inventory"))
async def cmd_inventory(message: Message):
    """Просмотр инвентаря"""
    user = get_user(message.from_user.id)
    inventory = get_inventory(message.from_user.id)
    
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
                text += f"{i}. {item['icon']} {item['name']} - {item['price']} 💎 (x{item['quantity']})\n"
            if len(items_by_rarity[rarity]) > 5:
                text += f"... и еще {len(items_by_rarity[rarity]) - 5} предметов\n"
    
    text += "\n📱 <b>Для детального просмотра используйте веб-приложение!</b>"
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("cases"))
async def cmd_cases(message: Message):
    """Просмотр доступных кейсов"""
    cases = get_cases()
    
    text = """
📦 <b>Доступные кейсы</b>

"""
    
    for case in cases:
        rarity_weights = case['rarity_weights']
        text += f"""
{case['icon']} <b>{case['name']}</b> - {case['price']} 💎
{case['description']}
Шансы: 
  • Обычные: {rarity_weights.get('common', 0)}%
  • Необычные: {rarity_weights.get('uncommon', 0)}%
  • Редкие: {rarity_weights.get('rare', 0)}%
  • Эпические: {rarity_weights.get('epic', 0)}%
  • Легендарные: {rarity_weights.get('legendary', 0)}%
"""
    
    text += """
\n📱 <b>Для открытия кейсов используйте веб-приложение!</b>
"""
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.callback_query(F.data == "profile")
async def show_profile(callback: CallbackQuery):
    """Показать профиль"""
    user = get_user(callback.from_user.id)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if USE_POSTGRES:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = %s",
            (user["user_id"],)
        )
        cases_opened = cursor.fetchone()[0] or 0
        
        cursor.execute(
            "SELECT created_at FROM users WHERE user_id = %s",
            (user["user_id"],)
        )
        registration_date = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COALESCE(SUM(ABS(amount)), 0) 
            FROM transactions 
            WHERE user_id = %s AND type = 'purchase'
        ''', (user["user_id"],))
        total_spent = cursor.fetchone()[0] or 0
        
        cursor.execute('''
            SELECT COUNT(*) FROM inventory WHERE user_id = %s
        ''', (user["user_id"],))
        total_items = cursor.fetchone()[0] or 0
    else:
        cursor.execute(
            "SELECT COUNT(*) FROM opening_history WHERE user_id = ?",
            (user["user_id"],)
        )
        cases_opened = cursor.fetchone()[0] or 0
        
        cursor.execute(
            "SELECT created_at FROM users WHERE user_id = ?",
            (user["user_id"],)
        )
        registration_date = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COALESCE(SUM(ABS(amount)), 0) 
            FROM transactions 
            WHERE user_id = ? AND type = 'purchase'
        ''', (user["user_id"],))
        total_spent = cursor.fetchone()[0] or 0
        
        cursor.execute('''
            SELECT COUNT(*) FROM inventory WHERE user_id = ?
        ''', (user["user_id"],))
        total_items = cursor.fetchone()[0] or 0
    
    conn.close()
    
    if registration_date:
        if isinstance(registration_date, str):
            try:
                reg_date = datetime.strptime(registration_date, '%Y-%m-%d %H:%M:%S')
            except:
                reg_date = datetime.strptime(registration_date, '%Y-%m-%d %H:%M:%S.%f')
        else:
            reg_date = registration_date
        reg_date_str = reg_date.strftime('%d.%m.%Y')
    else:
        reg_date_str = 'Неизвестно'
    
    text = f"""
👤 <b>Профиль игрока</b>

📛 <b>Имя:</b> {user['first_name']} {user['last_name'] or ''}
👤 <b>Юзернейм:</b> @{user['username'] or 'Не указан'}
🆔 <b>ID:</b> <code>{user['user_id']}</code>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📦 <b>Предметов в инвентаре:</b> {total_items}
🎰 <b>Открыто кейсов:</b> {cases_opened}
💸 <b>Потрачено на кейсы:</b> {total_spent} 💎
📅 <b>Дата регистрации:</b> {reg_date_str}
    """
    
    await callback.message.edit_text(text, parse_mode=ParseMode.HTML)
    await callback.answer()

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из Web App"""
    try:
        print(f"🌐 Web App данные от {message.from_user.id}")
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        
        if data.get('action') == 'init':
            # Инициализация приложения
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            cases = get_cases()
            
            response = {
                'success': True,
                'user': user,
                'inventory': inventory,
                'cases': cases,
                'config': {
                    'min_bet': 10,
                    'max_bet': 10000,
                    'daily_bonus': 100,
                    'version': '1.0.0',
                    'web_app_url': WEB_APP_URL,
                    'use_postgres': USE_POSTGRES
                }
            }
            
            await message.answer(json.dumps(response))
            
        elif data.get('action') == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            
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
            
        elif data.get('action') == 'sell_item':
            # Продажа предмета
            item_id = data.get('item_id')
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Получаем цену предмета
            if USE_POSTGRES:
                cursor.execute(
                    "SELECT sell_price, name FROM items WHERE item_id = %s",
                    (item_id,)
                )
            else:
                cursor.execute(
                    "SELECT sell_price, name FROM items WHERE item_id = ?",
                    (item_id,)
                )
            
            item_data = cursor.fetchone()
            
            if not item_data:
                await message.answer(json.dumps({'error': 'Предмет не найден'}))
                conn.close()
                return
            
            # Проверяем, есть ли предмет у пользователя
            if USE_POSTGRES:
                cursor.execute(
                    "SELECT quantity FROM inventory WHERE user_id = %s AND item_id = %s",
                    (user_id, item_id)
                )
            else:
                cursor.execute(
                    "SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?",
                    (user_id, item_id)
                )
            
            user_item = cursor.fetchone()
            
            if not user_item or user_item[0] <= 0:
                await message.answer(json.dumps({'error': 'У вас нет этого предмета'}))
                conn.close()
                return
            
            # Уменьшаем количество
            if USE_POSTGRES:
                cursor.execute('''
                    UPDATE inventory 
                    SET quantity = quantity - 1 
                    WHERE user_id = %s AND item_id = %s
                ''', (user_id, item_id))
            else:
                cursor.execute('''
                    UPDATE inventory 
                    SET quantity = quantity - 1 
                    WHERE user_id = ? AND item_id = ?
                ''', (user_id, item_id))
            
            # Удаляем если количество = 0
            if USE_POSTGRES:
                cursor.execute('''
                    DELETE FROM inventory 
                    WHERE user_id = %s AND item_id = %s AND quantity = 0
                ''', (user_id, item_id))
            else:
                cursor.execute('''
                    DELETE FROM inventory 
                    WHERE user_id = ? AND item_id = ? AND quantity = 0
                ''', (user_id, item_id))
            
            # Добавляем деньги
            sell_price = item_data[0]
            new_balance = update_balance(
                user_id, sell_price, "reward", f"Продажа предмета: {item_data[1]}"
            )
            
            response = {
                'success': True,
                'sell_price': sell_price,
                'new_balance': new_balance
            }
            
            await message.answer(json.dumps(response))
            conn.commit()
            conn.close()
            
    except json.JSONDecodeError:
        await message.answer(json.dumps({'error': 'Неверный формат данных'}))
    except Exception as e:
        print(f"❌ Ошибка обработки Web App данных: {e}")
        error_msg = str(e) if DEBUG else "Произошла ошибка. Пожалуйста, попробуйте позже."
        await message.answer(json.dumps({'error': error_msg}))

@router.message()
async def handle_unknown(message: Message):
    """Обработка неизвестных сообщений"""
    text = """
🤔 Не понимаю вашу команду.

<b>Доступные команды:</b>
/start - Запустить бота
/help - Помощь
/balance - Баланс
/daily - Ежедневный бонус
/inventory - Инвентарь
/cases - Доступные кейсы

📱 <b>Используйте кнопки в меню для взаимодействия с веб-приложением!</b>
    """
    await message.answer(text, parse_mode=ParseMode.HTML)

async def main():
    """Основная функция запуска бота"""
    # Инициализация базы данных
    init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"🌐 Web App URL: {WEB_APP_URL}")
    print(f"🗄️ Используется база: {'PostgreSQL' if USE_POSTGRES else 'SQLite'}")
    print("✅ Бот успешно запущен!")
    print("=" * 50)
    
    try:
        await dp.start_polling(bot)
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())