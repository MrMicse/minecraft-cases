import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, List
import random
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import (
    Message, InlineKeyboardMarkup,
    InlineKeyboardButton, WebAppInfo,
    MenuButtonWebApp
)
from aiogram.filters import Command
from aiogram.enums import ParseMode
import asyncio

# Загрузка переменных окружения
load_dotenv()
BOT_TOKEN = os.getenv('BOT_TOKEN')

if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

def init_db():
    """Инициализация базы данных"""
    conn = sqlite3.connect('users.db')
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
        last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица инвентаря (упрощенная)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inventory (
        inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        item_name TEXT,
        item_rarity TEXT,
        item_price INTEGER,
        obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Таблица кейсов
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS cases (
        case_id INTEGER PRIMARY KEY,
        name TEXT,
        price INTEGER,
        icon TEXT,
        description TEXT,
        rarity_weights TEXT
    )
    ''')
    
    # Проверяем наличие демо-кейсов
    cursor.execute("SELECT COUNT(*) FROM cases")
    if cursor.fetchone()[0] == 0:
        # Добавляем демо-кейсы
        demo_cases = [
            (1, '🍎 Кейс с Едой', 100, '🍎', 'Содержит разнообразную еду', 
             '{"common": 70, "uncommon": 30}'),
            (2, '⛏️ Ресурсный Кейс', 250, '⛏️', 'Руды, минералы и базовые ресурсы',
             '{"common": 50, "uncommon": 40, "rare": 10}'),
            (3, '⚔️ Оружейный Кейс', 500, '⚔️', 'Оружие, броня и инструменты',
             '{"uncommon": 40, "rare": 50, "epic": 10}'),
            (4, '🌟 Легендарный Кейс', 1000, '🌟', 'Уникальные предметы',
             '{"rare": 30, "epic": 50, "legendary": 20}'),
            (5, '👑 Доступный Кейс', 5000, '👑', 'Эксклюзивные донат предметы',
             '{"epic": 40, "legendary": 60}'),
            (6, '🧰 Случайный Кейс', 750, '🧰', 'Микс из всех категорий',
             '{"common": 30, "uncommon": 40, "rare": 20, "epic": 10}')
        ]
        
        cursor.executemany(
            "INSERT INTO cases (case_id, name, price, icon, description, rarity_weights) VALUES (?, ?, ?, ?, ?, ?)",
            demo_cases
        )
    
    conn.commit()
    conn.close()
    print("✅ База данных инициализирована")

def get_user(user_id: int) -> Dict:
    """Получение или создание пользователя"""
    conn = sqlite3.connect('users.db')
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
            """INSERT INTO users (user_id, balance, first_name) 
               VALUES (?, 10000, ?)""",
            (user_id, "Игрок")
        )
        conn.commit()
        
        # Получаем созданного пользователя
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance, experience, level 
               FROM users WHERE user_id = ?""",
            (user_id,)
        )
        user_data = cursor.fetchone()
    
    conn.close()
    
    return {
        "user_id": user_data[0],
        "username": user_data[1] or "",
        "first_name": user_data[2] or "",
        "last_name": user_data[3] or "",
        "balance": user_data[4],
        "experience": user_data[5],
        "level": user_data[6]
    }

def update_user_balance(user_id: int, new_balance: int) -> Dict:
    """Обновление баланса пользователя"""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Обновляем баланс и время синхронизации
    cursor.execute(
        """UPDATE users 
           SET balance = ?, last_sync = CURRENT_TIMESTAMP 
           WHERE user_id = ?""",
        (new_balance, user_id)
    )
    
    conn.commit()
    conn.close()
    
    return get_user(user_id)

def get_inventory(user_id: int) -> List[Dict]:
    """Получение инвентаря пользователя"""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    cursor.execute(
        """SELECT inventory_id, item_name, item_rarity, item_price, obtained_at 
           FROM inventory WHERE user_id = ? ORDER BY obtained_at DESC""",
        (user_id,)
    )
    
    inventory = []
    for row in cursor.fetchall():
        inventory.append({
            "id": row[0],
            "name": row[1],
            "rarity": row[2],
            "price": row[3],
            "obtained_at": row[4]
        })
    
    conn.close()
    return inventory

def add_to_inventory(user_id: int, item_data: Dict) -> int:
    """Добавление предмета в инвентарь"""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    cursor.execute(
        """INSERT INTO inventory (user_id, item_name, item_rarity, item_price) 
           VALUES (?, ?, ?, ?)""",
        (user_id, item_data['name'], item_data['rarity'], item_data['price'])
    )
    
    inventory_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return inventory_id

def get_cases() -> List[Dict]:
    """Получение списка кейсов"""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT case_id, name, price, icon, description, rarity_weights FROM cases"
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

# Minecraft предметы для демо-режима
minecraft_items_demo = {
    'common': [
        {"name": "Железный Слиток", "icon": "⛓️", "price": 50, "description": "Базовый ресурс"},
        {"name": "Уголь", "icon": "⚫", "price": 30, "description": "Топливо"},
        {"name": "Яблоко", "icon": "🍎", "price": 40, "description": "Еда"},
        {"name": "Хлеб", "icon": "🍞", "price": 45, "description": "Хорошая еда"}
    ],
    'uncommon': [
        {"name": "Алмаз", "icon": "💎", "price": 150, "description": "Ценный минерал"},
        {"name": "Изумруд", "icon": "🟩", "price": 200, "description": "Торговая валюта"},
        {"name": "Железная Кираса", "icon": "🛡️", "price": 180, "description": "Защита"}
    ],
    'rare': [
        {"name": "Незеритовый Слиток", "icon": "🔱", "price": 500, "description": "Элитный материал"},
        {"name": "Кирокрыло", "icon": "🪶", "price": 600, "description": "Мгновенное перемещение"}
    ],
    'epic': [
        {"name": "Тотем Бессмертия", "icon": "🐦", "price": 1000, "description": "Спасение от смерти"},
        {"name": "Сердце Моря", "icon": "💙", "price": 1200, "description": "Редкая реликвия"}
    ],
    'legendary': [
        {"name": "Командный Блок", "icon": "🟪", "price": 5000, "description": "Божественный предмет"},
        {"name": "Меч Незера", "icon": "🗡️", "price": 3000, "description": "Легендарное оружие"}
    ]
}

def open_case_demo(user_id: int, case_id: int) -> Dict:
    """Открытие кейса в демо-режиме"""
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    
    # Получаем кейс
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
    
    # Выбираем редкость по весам
    total_weight = sum(rarity_weights.values())
    random_weight = random.random() * total_weight
    cumulative = 0
    selected_rarity = 'common'
    
    for rarity, weight in rarity_weights.items():
        cumulative += weight
        if random_weight <= cumulative:
            selected_rarity = rarity
            break
    
    # Выбираем случайный предмет выбранной редкости
    items = minecraft_items_demo.get(selected_rarity, minecraft_items_demo['common'])
    won_item = random.choice(items).copy()
    won_item['rarity'] = selected_rarity
    won_item['id'] = random.randint(1000, 9999)
    
    # Обновляем баланс
    cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
    current_balance = cursor.fetchone()[0]
    
    if current_balance < case_price:
        conn.close()
        return {"error": "Недостаточно средств"}
    
    new_balance = current_balance - case_price
    cursor.execute(
        "UPDATE users SET balance = ? WHERE user_id = ?",
        (new_balance, user_id)
    )
    
    # Добавляем в инвентарь
    cursor.execute(
        """INSERT INTO inventory (user_id, item_name, item_rarity, item_price) 
           VALUES (?, ?, ?, ?)""",
        (user_id, won_item['name'], won_item['rarity'], won_item['price'])
    )
    
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "item": won_item,
        "new_balance": new_balance,
        "experience_gained": case_price // 10,
        "case_price": case_price
    }

@router.message(Command("start"))
async def cmd_start(message: Message):
    """Команда /start"""
    print(f"📥 /start от {message.from_user.id} ({message.from_user.first_name})")
    
    user = get_user(message.from_user.id)
    
    # Устанавливаем меню с веб-приложением
    await bot.set_chat_menu_button(
        chat_id=message.chat.id,
        menu_button=MenuButtonWebApp(
            text="🎮 Открыть кейсы",
            web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
        )
    )
    
    # Клавиатура
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(
                text="🎮 Открыть веб-приложение",
                web_app=WebAppInfo(url="https://mrmicse.github.io/minecraft-cases/")
            )],
            [
                InlineKeyboardButton(text="💰 Баланс", callback_data="balance"),
                InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory")
            ]
        ]
    )
    
    text = f"""
🎮 <b>Minecraft Case Opening</b>

Привет, {message.from_user.first_name}!

💰 <b>Баланс:</b> {user['balance']} 💎
🎯 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']}

Нажми кнопку ниже, чтобы открыть веб-приложение и начать открывать кейсы!

<code>Используй /balance для проверки баланса</code>
<code>Используй /sync для принудительной синхронизации</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

@router.message(Command("balance"))
async def cmd_balance(message: Message):
    """Проверка баланса"""
    user = get_user(message.from_user.id)
    
    text = f"""
💰 <b>Ваш баланс</b>

👤 Игрок: {message.from_user.first_name}
💎 Баланс: {user['balance']} 💎
🎯 Уровень: {user['level']}
⭐ Опыт: {user['experience']}

🔄 Последняя синхронизация: {datetime.now().strftime('%H:%M:%S')}
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("sync"))
async def cmd_sync(message: Message):
    """Принудительная синхронизация"""
    user = get_user(message.from_user.id)
    
    text = f"""
🔄 <b>Синхронизация завершена</b>

✅ Данные успешно синхронизированы
💎 Баланс: {user['balance']} 💎
⏰ Время: {datetime.now().strftime('%H:%M:%S')}

Баланс обновлен и сохранен на сервере!
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Обработка данных из веб-приложения - УПРОЩЕННАЯ ВЕРСИЯ"""
    try:
        print(f"🌐 Данные от {message.from_user.id}: {message.web_app_data.data[:100]}...")
        
        data = json.loads(message.web_app_data.data)
        user_id = message.from_user.id
        action = data.get('action')
        
        if action == 'init':
            # Инициализация - отправляем все данные
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            cases = get_cases()
            
            response = {
                "success": True,
                "user": {
                    "balance": user['balance'],
                    "experience": user['experience'],
                    "level": user['level']
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
            
            await message.answer(json.dumps(response))
            
        elif action == 'open_case':
            # Открытие кейса
            case_id = data.get('case_id')
            print(f"🎰 {user_id} открывает кейс {case_id}")
            
            # Открываем кейс
            result = open_case_demo(user_id, case_id)
            
            if 'error' in result:
                await message.answer(json.dumps({"success": False, "error": result['error']}))
                return
            
            # Получаем обновленные данные
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            
            result['user'] = {
                "balance": user['balance'],
                "experience": user['experience'],
                "level": user['level']
            }
            result['inventory'] = inventory
            result['success'] = True
            
            await message.answer(json.dumps(result))
            
            # Отправляем уведомление
            item = result['item']
            await bot.send_message(
                user_id,
                f"🎉 <b>Вы открыли кейс!</b>\n\n"
                f"🎁 <b>Предмет:</b> {item['name']} {item['icon']}\n"
                f"🎯 <b>Редкость:</b> {item['rarity']}\n"
                f"💎 <b>Цена:</b> {item['price']}\n\n"
                f"💰 <b>Новый баланс:</b> {user['balance']} 💎\n"
                f"🔄 Баланс синхронизирован с веб-приложением!",
                parse_mode=ParseMode.HTML
            )
            
        elif action == 'sync_balance':
            # Синхронизация баланса
            new_balance = data.get('balance')
            old_balance = data.get('old_balance', 0)
            
            if new_balance is not None:
                user = update_user_balance(user_id, new_balance)
                
                response = {
                    "success": True,
                    "user": {
                        "balance": user['balance'],
                        "experience": user['experience'],
                        "level": user['level']
                    },
                    "message": f"Баланс обновлен: {old_balance} → {new_balance}"
                }
                
                await message.answer(json.dumps(response))
                
                # Уведомление в чат
                change = new_balance - old_balance
                change_text = f"+{change}" if change > 0 else str(change)
                
                await bot.send_message(
                    user_id,
                    f"🔄 <b>Баланс синхронизирован!</b>\n\n"
                    f"💰 Было: {old_balance} 💎\n"
                    f"💰 Стало: {new_balance} 💎\n"
                    f"📊 Изменение: {change_text} 💎\n\n"
                    f"✅ Баланс сохранен на сервере",
                    parse_mode=ParseMode.HTML
                )
            else:
                await message.answer(json.dumps({
                    "success": False,
                    "error": "Не указан новый баланс"
                }))
                
        elif action == 'get_data':
            # Получение данных
            user = get_user(user_id)
            inventory = get_inventory(user_id)
            
            response = {
                "success": True,
                "user": {
                    "balance": user['balance'],
                    "experience": user['experience'],
                    "level": user['level']
                },
                "inventory": inventory
            }
            
            await message.answer(json.dumps(response))
            
        else:
            await message.answer(json.dumps({
                "success": False,
                "error": f"Неизвестное действие: {action}"
            }))
            
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка JSON: {e}")
        await message.answer(json.dumps({
            "success": False,
            "error": "Неверный формат данных"
        }))
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        await message.answer(json.dumps({
            "success": False,
            "error": "Внутренняя ошибка сервера"
        }))

@router.callback_query(F.data == "balance")
async def handle_balance(callback):
    """Обработка кнопки баланса"""
    user = get_user(callback.from_user.id)
    
    text = f"""
💰 <b>Текущий баланс</b>

💎 Баланс: {user['balance']}
🎯 Уровень: {user['level']}
⭐ Опыт: {user['experience']}
    """
    
    await callback.message.answer(text, parse_mode=ParseMode.HTML)
    await callback.answer()

@router.callback_query(F.data == "inventory")
async def handle_inventory(callback):
    """Обработка кнопки инвентаря"""
    inventory = get_inventory(callback.from_user.id)
    
    if inventory:
        items_text = "\n".join([
            f"• {item['name']} ({item['rarity']}) - {item['price']} 💎"
            for item in inventory[:10]
        ])
        
        if len(inventory) > 10:
            items_text += f"\n\n...и ещё {len(inventory) - 10} предметов"
    else:
        items_text = "Инвентарь пуст. Откройте кейсы в веб-приложении!"
    
    text = f"""
🎒 <b>Ваш инвентарь</b>

{items_text}

Всего предметов: {len(inventory)}
    """
    
    await callback.message.answer(text, parse_mode=ParseMode.HTML)
    await callback.answer()

async def main():
    """Запуск бота"""
    # Инициализация БД
    init_db()
    
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print("✅ Бот успешно запущен!")
    print("=" * 50)
    
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен")
    except Exception as e:
        print(f"❌ Ошибка: {e}")