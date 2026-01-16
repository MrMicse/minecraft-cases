import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router
from aiogram.types import (
    Message, InlineKeyboardMarkup, 
    InlineKeyboardButton, CallbackQuery
)
from aiogram.filters import Command
from aiogram.enums import ParseMode

load_dotenv()

class AdminPanel:
    """Класс для работы с админ-панелью"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.router = Router()
        self.setup_handlers()
    
    def get_connection(self):
        """Получение соединения с БД"""
        return sqlite3.connect(self.db_path)
    
    def setup_handlers(self):
        """Настройка обработчиков для админ-панели"""
        
        @self.router.message(Command("admin_panel"))
        async def cmd_admin_panel(message: Message):
            """Главное меню админ-панели"""
            user_id = message.from_user.id
            admin_id = int(os.getenv('ADMIN_ID', 0))
            
            if user_id != admin_id:
                await message.answer("⛔ У вас нет доступа к админ-панели!")
                return
            
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="💰 Управление кристаллами", callback_data="admin_crystals")
                    ],
                    [
                        InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats"),
                        InlineKeyboardButton(text="👥 Пользователи", callback_data="admin_users")
                    ],
                    [
                        InlineKeyboardButton(text="📦 Управление кейсами", callback_data="admin_cases"),
                        InlineKeyboardButton(text="🎁 Управление предметами", callback_data="admin_items")
                    ],
                    [
                        InlineKeyboardButton(text="🔙 Главное меню", callback_data="admin_back")
                    ]
                ]
            )
            
            await message.answer(
                "👑 <b>Админ Панель</b>\n\n"
                "Выберите раздел для управления:",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
        
        @self.router.callback_query(lambda c: c.data == "admin_back")
        async def admin_back(callback: CallbackQuery):
            """Возврат в главное меню админ-панели"""
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="💰 Управление кристаллами", callback_data="admin_crystals")
                    ],
                    [
                        InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats"),
                        InlineKeyboardButton(text="👥 Пользователи", callback_data="admin_users")
                    ],
                    [
                        InlineKeyboardButton(text="📦 Управление кейсами", callback_data="admin_cases"),
                        InlineKeyboardButton(text="🎁 Управление предметами", callback_data="admin_items")
                    ]
                ]
            )
            
            await callback.message.edit_text(
                "👑 <b>Админ Панель</b>\n\n"
                "Выберите раздел для управления:",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
            await callback.answer()
        
        @self.router.callback_query(lambda c: c.data == "admin_crystals")
        async def admin_crystals_menu(callback: CallbackQuery):
            """Меню управления кристаллами"""
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="➕ Выдать кристаллы", callback_data="crystal_give"),
                        InlineKeyboardButton(text="➖ Снять кристаллы", callback_data="crystal_take")
                    ],
                    [
                        InlineKeyboardButton(text="⚡ Быстрая выдача", callback_data="crystal_quick"),
                        InlineKeyboardButton(text="📝 Ручной ввод", callback_data="crystal_manual")
                    ],
                    [
                        InlineKeyboardButton(text="📊 Балансы пользователей", callback_data="crystal_balances"),
                        InlineKeyboardButton(text="💰 Топ по балансу", callback_data="crystal_top")
                    ],
                    [
                        InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")
                    ]
                ]
            )
            
            await callback.message.edit_text(
                "💰 <b>Управление кристаллами</b>\n\n"
                "Выберите действие для управления балансами пользователей:",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
            await callback.answer()
        
        @self.router.callback_query(lambda c: c.data == "crystal_quick")
        async def crystal_quick_menu(callback: CallbackQuery):
            """Быстрая выдача кристаллов"""
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="➕ 100 💎", callback_data="quick_add_100"),
                        InlineKeyboardButton(text="➕ 500 💎", callback_data="quick_add_500")
                    ],
                    [
                        InlineKeyboardButton(text="➕ 1,000 💎", callback_data="quick_add_1000"),
                        InlineKeyboardButton(text="➕ 5,000 💎", callback_data="quick_add_5000")
                    ],
                    [
                        InlineKeyboardButton(text="➕ 10,000 💎", callback_data="quick_add_10000"),
                        InlineKeyboardButton(text="➕ 50,000 💎", callback_data="quick_add_50000")
                    ],
                    [
                        InlineKeyboardButton(text="🎁 Стартовый набор", callback_data="quick_starter"),
                        InlineKeyboardButton(text="🎯 VIP набор", callback_data="quick_vip")
                    ],
                    [
                        InlineKeyboardButton(text="🔙 Назад", callback_data="admin_crystals")
                    ]
                ]
            )
            
            await callback.message.edit_text(
                "⚡ <b>Быстрая выдача кристаллов</b>\n\n"
                "Выберите сумму для выдачи пользователю:",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
            await callback.answer()
        
        @self.router.callback_query(lambda c: c.data.startswith("quick_"))
        async def quick_crystal_action(callback: CallbackQuery):
            """Обработка быстрой выдачи кристаллов"""
            action = callback.data
            
            # Карта быстрых действий
            quick_actions = {
                "quick_add_100": ("➕ 100 💎", 100, "Быстрая выдача"),
                "quick_add_500": ("➕ 500 💎", 500, "Быстрая выдача"),
                "quick_add_1000": ("➕ 1,000 💎", 1000, "Быстрая выдача"),
                "quick_add_5000": ("➕ 5,000 💎", 5000, "Быстрая выдача"),
                "quick_add_10000": ("➕ 10,000 💎", 10000, "Быстрая выдача"),
                "quick_add_50000": ("➕ 50,000 💎", 50000, "Быстрая выдача"),
                "quick_starter": ("🎁 Стартовый набор", 5000, "Стартовый набор"),
                "quick_vip": ("🎯 VIP набор", 25000, "VIP набор")
            }
            
            if action in quick_actions:
                text, amount, description = quick_actions[action]
                
                await callback.message.edit_text(
                    f"{text}\n\n"
                    f"💰 <b>Сумма:</b> {amount} 💎\n"
                    f"📝 <b>Причина:</b> {description}\n\n"
                    f"Теперь введите ID пользователя, которому хотите выдать кристаллы.\n"
                    f"Пример: <code>123456789</code>\n\n"
                    f"Или перешлите любое сообщение от пользователя.",
                    parse_mode=ParseMode.HTML
                )
                
                # Сохраняем временные данные
                conn = self.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO admin_temp_data (admin_id, data) VALUES (?, ?)",
                    (callback.from_user.id, f"crystal_add:{amount}:{description}")
                )
                conn.commit()
                conn.close()
            
            await callback.answer()
        
        @self.router.callback_query(lambda c: c.data == "crystal_give")
        async def crystal_give_menu(callback: CallbackQuery):
            """Меню для выдачи кристаллов"""
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(text="🎁 Награда за активность", callback_data="give_reward_activity"),
                        InlineKeyboardButton(text="🎯 Награда за победу", callback_data="give_reward_win")
                    ],
                    [
                        InlineKeyboardButton(text="⭐ Бонус за игру", callback_data="give_bonus_game"),
                        InlineKeyboardButton(text="🎉 Праздничный бонус", callback_data="give_bonus_holiday")
                    ],
                    [
                        InlineKeyboardButton(text="🔙 Назад", callback_data="admin_crystals")
                    ]
                ]
            )
            
            await callback.message.edit_text(
                "➕ <b>Выдача кристаллов</b>\n\n"
                "Выберите причину выдачи или введите сумму вручную:",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
            await callback.answer()
        
        @self.router.callback_query(lambda c: c.data.startswith("give_"))
        async def give_crystal_reason(callback: CallbackQuery):
            """Выбор причины выдачи"""
            reasons = {
                "give_reward_activity": ("🎁 Награда за активность", "Награда за активность в игре"),
                "give_reward_win": ("🎯 Награда за победу", "Награда за победу в турнире"),
                "give_bonus_game": ("⭐ Бонус за игру", "Бонус за активную игру"),
                "give_bonus_holiday": ("🎉 Праздничный бонус", "Праздничный бонус")
            }
            
            if callback.data in reasons:
                title, reason = reasons[callback.data]
                
                await callback.message.edit_text(
                    f"{title}\n\n"
                    f"📝 <b>Причина:</b> {reason}\n\n"
                    f"Введите сумму кристаллов для выдачи.\n"
                    f"Пример: <code>1000</code>\n\n"
                    f"После ввода суммы введите ID пользователя.",
                    parse_mode=ParseMode.HTML
                )
                
                # Сохраняем временные данные
                conn = self.get_connection()
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO admin_temp_data (admin_id, data) VALUES (?, ?)",
                    (callback.from_user.id, f"crystal_add_reason:{reason}")
                )
                conn.commit()
                conn.close()
            
            await callback.answer()
        
        @self.router.message()
        async def handle_admin_actions(message: Message):
            """Обработка действий админа"""
            user_id = message.from_user.id
            admin_id = int(os.getenv('ADMIN_ID', 0))
            
            if user_id != admin_id:
                return
            
            # Проверяем, есть ли ожидаемый ввод от админа
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT data FROM admin_temp_data WHERE admin_id = ?",
                (user_id,)
            )
            
            temp_data = cursor.fetchone()
            
            if temp_data:
                data = temp_data[0]
                
                if data.startswith("crystal_add:"):
                    # Обработка быстрой выдачи
                    _, amount, description = data.split(":")
                    amount = int(amount)
                    
                    # Пытаемся получить ID пользователя из сообщения
                    target_user_id = self.extract_user_id(message)
                    
                    if target_user_id:
                        success = self.update_user_balance(target_user_id, amount, description)
                        
                        if success:
                            # Получаем информацию о пользователе
                            user_info = self.get_user_info(target_user_id)
                            
                            await message.answer(
                                f"✅ <b>Кристаллы успешно выданы!</b>\n\n"
                                f"👤 <b>Пользователь:</b> {user_info['first_name']}\n"
                                f"🆔 <b>ID:</b> <code>{target_user_id}</code>\n"
                                f"💰 <b>Сумма:</b> +{amount} 💎\n"
                                f"📝 <b>Причина:</b> {description}\n"
                                f"🏦 <b>Новый баланс:</b> {user_info['balance']} 💎",
                                parse_mode=ParseMode.HTML
                            )
                            
                            # Уведомляем пользователя
                            try:
                                bot = Bot(token=os.getenv('BOT_TOKEN'))
                                await bot.send_message(
                                    target_user_id,
                                    f"🎉 <b>Вам начислены кристаллы!</b>\n\n"
                                    f"💰 +{amount} 💎\n"
                                    f"📝 <b>Причина:</b> {description}\n"
                                    f"🏦 <b>Ваш баланс:</b> {user_info['balance']} 💎",
                                    parse_mode=ParseMode.HTML
                                )
                            except:
                                pass
                        else:
                            await message.answer("❌ Не удалось выдать кристаллы. Пользователь не найден.")
                        
                        # Очищаем временные данные
                        cursor.execute("DELETE FROM admin_temp_data WHERE admin_id = ?", (user_id,))
                        conn.commit()
                    else:
                        await message.answer("❌ Не удалось определить ID пользователя. Попробуйте еще раз.")
                
                elif data.startswith("crystal_add_reason:"):
                    # Обработка выдачи с причиной
                    reason = data.split(":", 1)[1]
                    
                    try:
                        amount = int(message.text)
                        
                        if amount <= 0:
                            await message.answer("❌ Сумма должна быть положительной!")
                            return
                        
                        if amount > 1000000:
                            await message.answer("❌ Слишком большая сумма! Максимум 1,000,000 💎")
                            return
                        
                        # Обновляем временные данные
                        cursor.execute(
                            "UPDATE admin_temp_data SET data = ? WHERE admin_id = ?",
                            (f"crystal_add:{amount}:{reason}", user_id)
                        )
                        conn.commit()
                        
                        await message.answer(
                            f"✅ <b>Сумма установлена:</b> {amount} 💎\n"
                            f"📝 <b>Причина:</b> {reason}\n\n"
                            f"Теперь введите ID пользователя или перешлите сообщение.",
                            parse_mode=ParseMode.HTML
                        )
                        
                    except ValueError:
                        await message.answer("❌ Пожалуйста, введите число!")
            
            conn.close()
    
    def extract_user_id(self, message: Message) -> Optional[int]:
        """Извлечение ID пользователя из сообщения"""
        # Если есть reply или forward
        if message.reply_to_message:
            return message.reply_to_message.from_user.id
        
        # Если текст - это числовой ID
        try:
            return int(message.text.strip())
        except:
            # Проверяем, есть ли ID в тексте
            import re
            match = re.search(r'\d{9,}', message.text)
            if match:
                return int(match.group())
        
        return None
    
    def update_user_balance(self, user_id: int, amount: int, description: str) -> bool:
        """Обновление баланса пользователя"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Проверяем существование пользователя
            cursor.execute("SELECT user_id FROM users WHERE user_id = ?", (user_id,))
            user_exists = cursor.fetchone()
            
            if not user_exists:
                # Создаем пользователя если не существует
                cursor.execute(
                    """INSERT INTO users (user_id, balance, experience, level, last_login) 
                       VALUES (?, ?, 0, 1, CURRENT_TIMESTAMP)""",
                    (user_id, amount)
                )
            else:
                # Обновляем баланс
                cursor.execute(
                    "UPDATE users SET balance = balance + ? WHERE user_id = ?",
                    (amount, user_id)
                )
            
            # Добавляем транзакцию
            cursor.execute(
                """INSERT INTO transactions (user_id, type, amount, description) 
                   VALUES (?, 'reward', ?, ?)""",
                (user_id, amount, f"Админ: {description}")
            )
            
            conn.commit()
            conn.close()
            return True
            
        except Exception as e:
            print(f"Error updating balance: {e}")
            return False
    
    def get_user_info(self, user_id: int) -> Dict:
        """Получение информации о пользователе"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            """SELECT user_id, username, first_name, last_name, balance 
               FROM users WHERE user_id = ?""",
            (user_id,)
        )
        
        user_data = cursor.fetchone()
        conn.close()
        
        if user_data:
            return {
                "user_id": user_data[0],
                "username": user_data[1],
                "first_name": user_data[2],
                "last_name": user_data[3],
                "balance": user_data[4]
            }
        else:
            return {
                "user_id": user_id,
                "username": "Неизвестно",
                "first_name": "Пользователь",
                "last_name": "",
                "balance": 0
            }
    
    def create_tables(self):
        """Создание необходимых таблиц для админ-панели"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Таблица для временных данных админа
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_temp_data (
            admin_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()
        conn.close()
        print("✅ Таблицы админ-панели созданы")

# Создание экземпляра админ-панели
def setup_admin_panel(db_path: str, dp: Dispatcher):
    """Настройка админ-панели в боте"""
    admin_panel = AdminPanel(db_path)
    admin_panel.create_tables()
    dp.include_router(admin_panel.router)
    print("✅ Админ-панель настроена")