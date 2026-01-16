import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from aiogram import Router, F
from aiogram.types import (
    Message, InlineKeyboardMarkup, InlineKeyboardButton,
    CallbackQuery
)
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

# Состояния для FSM
class AdminStates(StatesGroup):
    waiting_for_user_id = State()
    waiting_for_amount = State()
    waiting_for_reason = State()
    waiting_for_item_name = State()
    waiting_for_item_price = State()

# Создаем роутер
admin_router = Router()

# Проверка прав администратора
def is_admin(user_id: int, admin_id: int) -> bool:
    return user_id == admin_id

# Функции для работы с базой данных
def get_user_by_id(user_id: int, db_path: str) -> Optional[Dict]:
    """Получить пользователя по ID"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT user_id, username, first_name, last_name, balance, 
               experience, level, created_at
        FROM users 
        WHERE user_id = ?
    ''', (user_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return None
    
    return {
        'user_id': row[0],
        'username': row[1] or 'Без юзернейма',
        'first_name': row[2] or 'Без имени',
        'last_name': row[3] or '',
        'balance': row[4],
        'experience': row[5],
        'level': row[6],
        'created_at': row[7]
    }

def search_users(search_query: str, db_path: str, limit: int = 10) -> List[Dict]:
    """Поиск пользователей по ID, имени или юзернейму"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Пробуем поиск по ID
        user_id = int(search_query)
        cursor.execute('''
            SELECT user_id, username, first_name, last_name, balance
            FROM users 
            WHERE user_id = ?
            LIMIT ?
        ''', (user_id, limit))
    except ValueError:
        # Поиск по тексту
        search_pattern = f"%{search_query}%"
        cursor.execute('''
            SELECT user_id, username, first_name, last_name, balance
            FROM users 
            WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ?
            ORDER BY balance DESC
            LIMIT ?
        ''', (search_pattern, search_pattern, search_pattern, limit))
    
    users = []
    for row in cursor.fetchall():
        users.append({
            'user_id': row[0],
            'username': row[1] or 'Без юзернейма',
            'first_name': row[2] or 'Без имени',
            'last_name': row[3] or '',
            'balance': row[4]
        })
    
    conn.close()
    return users

def update_user_balance(user_id: int, amount: int, reason: str, db_path: str) -> Dict:
    """Обновить баланс пользователя"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Проверяем существование пользователя
        cursor.execute("SELECT balance FROM users WHERE user_id = ?", (user_id,))
        result = cursor.fetchone()
        
        if not result:
            conn.close()
            return {'success': False, 'error': 'Пользователь не найден'}
        
        old_balance = result[0]
        new_balance = old_balance + amount
        
        # Обновляем баланс
        cursor.execute(
            "UPDATE users SET balance = ? WHERE user_id = ?",
            (new_balance, user_id)
        )
        
        # Добавляем транзакцию
        cursor.execute('''
            INSERT INTO transactions (user_id, type, amount, description)
            VALUES (?, 'admin_deposit', ?, ?)
        ''', (user_id, amount, reason))
        
        conn.commit()
        
        # Получаем обновленные данные пользователя
        user = get_user_by_id(user_id, db_path)
        
        return {
            'success': True,
            'old_balance': old_balance,
            'new_balance': new_balance,
            'user': user,
            'transaction_id': cursor.lastrowid
        }
        
    except Exception as e:
        conn.rollback()
        return {'success': False, 'error': str(e)}
    finally:
        conn.close()

def get_system_stats(db_path: str) -> Dict:
    """Получить системную статистику"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Общая статистика
    cursor.execute("SELECT COUNT(*) FROM users")
    total_users = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(balance) FROM users")
    total_balance = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT COUNT(*) FROM opening_history")
    total_openings = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM inventory")
    total_items = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(amount) FROM transactions WHERE amount > 0 AND type != 'purchase'")
    total_deposited = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT SUM(amount) FROM transactions WHERE type = 'purchase'")
    total_spent = cursor.fetchone()[0] or 0
    
    # Статистика за последние 7 дней
    week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    cursor.execute("SELECT COUNT(*) FROM users WHERE created_at >= ?", (week_ago,))
    new_users_week = cursor.fetchone()[0]
    
    cursor.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM users 
        WHERE created_at >= ? 
        GROUP BY DATE(created_at)
    """, (week_ago,))
    daily_registrations = cursor.fetchall()
    
    conn.close()
    
    return {
        'total_users': total_users,
        'total_balance': total_balance,
        'total_openings': total_openings,
        'total_items': total_items,
        'total_deposited': total_deposited,
        'total_spent': total_spent,
        'new_users_week': new_users_week,
        'daily_registrations': daily_registrations
    }

# Команда админ-панели
@admin_router.message(Command("admin"))
async def cmd_admin(message: Message, state: FSMContext):
    """Главное меню админ-панели"""
    # Проверка прав (админ ID должен быть в конфиге)
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        await message.answer("⛔ У вас нет прав администратора!")
        return
    
    await state.clear()
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💰 Выдать кристаллы", callback_data="admin_deposit"),
                InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")
            ],
            [
                InlineKeyboardButton(text="👥 Поиск пользователей", callback_data="admin_search"),
                InlineKeyboardButton(text="📈 Активность", callback_data="admin_activity")
            ],
            [
                InlineKeyboardButton(text="🎁 Управление предметами", callback_data="admin_items"),
                InlineKeyboardButton(text="📦 Управление кейсами", callback_data="admin_cases")
            ],
            [
                InlineKeyboardButton(text="⚙️ Настройки", callback_data="admin_settings"),
                InlineKeyboardButton(text="❌ Закрыть", callback_data="admin_close")
            ]
        ]
    )
    
    text = """
👑 <b>Minecraft Cases - Админ Панель</b>

<i>Панель управления системой открытия кейсов</i>

<b>Основные функции:</b>
• 💎 <b>Выдача кристаллов</b> - пополнение баланса пользователей
• 👥 <b>Управление пользователями</b> - поиск и редактирование
• 📊 <b>Статистика</b> - общая информация о системе
• 📈 <b>Аналитика</b> - мониторинг активности

<code>Выберите действие из меню ниже:</code>
    """
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

# Главное меню админ-панели (callback)
@admin_router.callback_query(F.data == "admin_menu")
async def admin_menu_callback(callback: CallbackQuery, state: FSMContext):
    """Вернуться в главное меню"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    await state.clear()
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="💰 Выдать кристаллы", callback_data="admin_deposit"),
                InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")
            ],
            [
                InlineKeyboardButton(text="👥 Поиск пользователей", callback_data="admin_search"),
                InlineKeyboardButton(text="📈 Активность", callback_data="admin_activity")
            ],
            [
                InlineKeyboardButton(text="🎁 Управление предметами", callback_data="admin_items"),
                InlineKeyboardButton(text="📦 Управление кейсами", callback_data="admin_cases")
            ],
            [
                InlineKeyboardButton(text="⚙️ Настройки", callback_data="admin_settings"),
                InlineKeyboardButton(text="❌ Закрыть", callback_data="admin_close")
            ]
        ]
    )
    
    text = """
👑 <b>Minecraft Cases - Админ Панель</b>

<i>Панель управления системой открытия кейсов</i>

<code>Выберите действие из меню ниже:</code>
    """
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

# Выдача кристаллов - выбор пользователя
@admin_router.callback_query(F.data == "admin_deposit")
async def admin_deposit_start(callback: CallbackQuery, state: FSMContext):
    """Начало процесса выдачи кристаллов"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
💰 <b>Выдача кристаллов пользователям</b>

<i>Вы можете пополнить баланс пользователя алмазами 💎</i>

<b>Как использовать:</b>
1. Введите ID пользователя или его юзернейм
2. Укажите количество кристаллов для пополнения
3. Добавьте комментарий (опционально)

<code>Введите ID пользователя или юзернейм:</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await state.set_state(AdminStates.waiting_for_user_id)
    await callback.answer()

# Обработка ввода пользователя
@admin_router.message(AdminStates.waiting_for_user_id)
async def process_user_id(message: Message, state: FSMContext):
    """Обработка введенного ID пользователя"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    search_query = message.text.strip()
    
    if search_query.isdigit():
        # Поиск по ID
        user_id = int(search_query)
        user = get_user_by_id(user_id, config.DATABASE_URL.replace('sqlite:///', ''))
        
        if user:
            await state.update_data(selected_user_id=user_id)
            
            text = f"""
👤 <b>Найден пользователь:</b>

<b>ID:</b> <code>{user['user_id']}</code>
<b>Имя:</b> {user['first_name']} {user['last_name']}
<b>Юзернейм:</b> @{user['username']}
<b>Баланс:</b> {user['balance']} 💎
<b>Уровень:</b> {user['level']}
<b>Дата регистрации:</b> {user['created_at'][:10]}

<code>Введите количество кристаллов для пополнения:</code>
            """
            
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Назад к поиску", callback_data="admin_deposit")]
                ]
            )
            
            await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
            await state.set_state(AdminStates.waiting_for_amount)
        else:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Назад к поиску", callback_data="admin_deposit")]
                ]
            )
            
            await message.answer(
                "❌ <b>Пользователь не найден!</b>\n\n"
                "Проверьте правильность ID и попробуйте снова.",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
    else:
        # Поиск по тексту
        users = search_users(search_query, config.DATABASE_URL.replace('sqlite:///', ''))
        
        if not users:
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [InlineKeyboardButton(text="🔙 Назад к поиску", callback_data="admin_deposit")]
                ]
            )
            
            await message.answer(
                "❌ <b>Пользователи не найдены!</b>\n\n"
                "Попробуйте ввести ID или другой запрос.",
                reply_markup=keyboard,
                parse_mode=ParseMode.HTML
            )
            return
        
        # Создаем кнопки для выбора пользователя
        keyboard_buttons = []
        for user in users[:5]:  # Ограничиваем 5 результатами
            btn_text = f"👤 {user['first_name']} (@{user['username']}) - {user['balance']} 💎"
            callback_data = f"admin_select_{user['user_id']}"
            keyboard_buttons.append([InlineKeyboardButton(text=btn_text, callback_data=callback_data)])
        
        keyboard_buttons.append([InlineKeyboardButton(text="🔙 Назад к поиску", callback_data="admin_deposit")])
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=keyboard_buttons)
        
        text = f"""
🔍 <b>Результаты поиска:</b> "{search_query}"

<i>Найдено {len(users)} пользователей</i>

<b>Выберите пользователя из списка:</b>
        """
        
        await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

# Выбор пользователя из результатов поиска
@admin_router.callback_query(F.data.startswith("admin_select_"))
async def select_user_from_search(callback: CallbackQuery, state: FSMContext):
    """Выбор пользователя из результатов поиска"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    user_id = int(callback.data.split("_")[-1])
    user = get_user_by_id(user_id, config.DATABASE_URL.replace('sqlite:///', ''))
    
    if not user:
        await callback.answer("❌ Пользователь не найден!", show_alert=True)
        return
    
    await state.update_data(selected_user_id=user_id)
    
    text = f"""
👤 <b>Выбран пользователь:</b>

<b>ID:</b> <code>{user['user_id']}</code>
<b>Имя:</b> {user['first_name']} {user['last_name']}
<b>Юзернейм:</b> @{user['username']}
<b>Баланс:</b> {user['balance']} 💎
<b>Уровень:</b> {user['level']}

<code>Введите количество кристаллов для пополнения:</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад к поиску", callback_data="admin_deposit")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await state.set_state(AdminStates.waiting_for_amount)
    await callback.answer()

# Обработка ввода количества кристаллов
@admin_router.message(AdminStates.waiting_for_amount)
async def process_amount(message: Message, state: FSMContext):
    """Обработка введенного количества кристаллов"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    try:
        amount = int(message.text.strip())
        
        if amount <= 0:
            await message.answer("❌ <b>Количество должно быть положительным!</b>", parse_mode=ParseMode.HTML)
            return
        
        if amount > 1000000:  # Лимит 1 миллион
            await message.answer("❌ <b>Слишком большое количество!</b>\nМаксимум: 1,000,000 💎", parse_mode=ParseMode.HTML)
            return
        
        await state.update_data(amount=amount)
        
        text = f"""
💰 <b>Подтверждение пополнения</b>

<i>Вы собираетесь выдать:</i>
<b>Количество:</b> {amount:,} 💎

<code>Введите причину пополнения (комментарий):</code>

<i>Например: "За активность", "Промо-акция", "Исправление ошибки"</i>
        """
        
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🔙 Изменить количество", callback_data="admin_deposit")]
            ]
        )
        
        await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
        await state.set_state(AdminStates.waiting_for_reason)
        
    except ValueError:
        await message.answer("❌ <b>Некорректное число!</b>\nВведите целое число.", parse_mode=ParseMode.HTML)

# Обработка ввода причины
@admin_router.message(AdminStates.waiting_for_reason)
async def process_reason(message: Message, state: FSMContext):
    """Обработка введенной причины и выполнение пополнения"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    reason = message.text.strip()
    if not reason:
        reason = "Пополнение от администратора"
    
    data = await state.get_data()
    user_id = data.get('selected_user_id')
    amount = data.get('amount')
    
    if not user_id or not amount:
        await message.answer("❌ <b>Ошибка данных!</b> Начните заново.", parse_mode=ParseMode.HTML)
        await state.clear()
        return
    
    # Получаем информацию о пользователе перед пополнением
    user_before = get_user_by_id(user_id, config.DATABASE_URL.replace('sqlite:///', ''))
    
    # Выполняем пополнение
    result = update_user_balance(user_id, amount, reason, config.DATABASE_URL.replace('sqlite:///', ''))
    
    if result['success']:
        # Получаем обновленную информацию
        user_after = result['user']
        
        text = f"""
✅ <b>Пополнение успешно выполнено!</b>

<b>Пользователь:</b> {user_before['first_name']} (@{user_before['username']})
<b>ID:</b> <code>{user_id}</code>

<b>Старый баланс:</b> {result['old_balance']:,} 💎
<b>Выдано:</b> +{amount:,} 💎
<b>Новый баланс:</b> {result['new_balance']:,} 💎

<b>Причина:</b> {reason}
<b>Время:</b> {datetime.now().strftime('%H:%M:%S')}
<b>ID транзакции:</b> <code>{result['transaction_id']}</code>

<i>Баланс пользователя обновлен в реальном времени!</i>
        """
        
        # Отправляем уведомление пользователю (если это возможно)
        try:
            from bot import bot
            notification = f"""
🎉 <b>Ваш баланс пополнен!</b>

💰 <b>Получено:</b> +{amount:,} 💎
📈 <b>Новый баланс:</b> {result['new_balance']:,} 💎
📝 <b>Причина:</b> {reason}

<i>Спасибо за участие! 🎮</i>
            """
            await bot.send_message(user_id, notification, parse_mode=ParseMode.HTML)
        except Exception as e:
            print(f"Не удалось отправить уведомление пользователю {user_id}: {e}")
        
    else:
        text = f"""
❌ <b>Ошибка при пополнении!</b>

<b>Ошибка:</b> {result['error']}

<i>Попробуйте снова или обратитесь к разработчику.</i>
        """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="💰 Выдать еще", callback_data="admin_deposit")],
            [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")],
            [InlineKeyboardButton(text="👑 В меню", callback_data="admin_menu")]
        ]
    )
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await state.clear()

# Статистика системы
@admin_router.callback_query(F.data == "admin_stats")
async def show_admin_stats(callback: CallbackQuery):
    """Показать статистику системы"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    stats = get_system_stats(config.DATABASE_URL.replace('sqlite:///', ''))
    
    # Форматируем даты регистраций
    reg_chart = ""
    for date_str, count in stats['daily_registrations'][-7:]:  # Последние 7 дней
        reg_chart += f"📅 {date_str}: {count} чел.\n"
    
    text = f"""
📊 <b>Системная статистика</b>

<b>👥 Пользователи:</b>
• Всего пользователей: {stats['total_users']:,}
• Новых за неделю: {stats['new_users_week']:,}

<b>💰 Экономика:</b>
• Общий баланс: {stats['total_balance']:,} 💎
• Всего выдано: {stats['total_deposited']:,} 💎
• Всего потрачено: {stats['total_spent']:,} 💎

<b>🎮 Активность:</b>
• Всего открытий: {stats['total_openings']:,}
• Всего предметов: {stats['total_items']:,}

<b>📈 Регистрации (последние 7 дней):</b>
{reg_chart}

<i>Обновлено: {datetime.now().strftime('%H:%M:%S')}</i>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="🔄 Обновить", callback_data="admin_stats"),
                InlineKeyboardButton(text="💰 Выдать кристаллы", callback_data="admin_deposit")
            ],
            [
                InlineKeyboardButton(text="📈 Подробная статистика", callback_data="admin_stats_detailed"),
                InlineKeyboardButton(text="👑 В меню", callback_data="admin_menu")
            ]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

# Поиск пользователей
@admin_router.callback_query(F.data == "admin_search")
async def admin_search_users(callback: CallbackQuery):
    """Поиск пользователей"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
🔍 <b>Поиск пользователей</b>

<i>Поиск по ID, имени или юзернейму</i>

<code>Отправьте мне ID пользователя или его имя для поиска:</code>

<b>Примеры:</b>
• <code>123456789</code> - поиск по ID
• <code>@username</code> - поиск по юзернейму
• <code>Иван</code> - поиск по имени
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

# Закрытие админ-панели
@admin_router.callback_query(F.data == "admin_close")
async def admin_close(callback: CallbackQuery, state: FSMContext):
    """Закрытие админ-панели"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    await state.clear()
    await callback.message.delete()
    await callback.answer("👑 Админ-панель закрыта")

# Быстрая выдача кристаллов через команду
@admin_router.message(Command("addbalance"))
async def quick_add_balance(message: Message):
    """Быстрая выдача кристаллов через команду"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    # Проверяем формат команды: /addbalance user_id amount [reason]
    parts = message.text.split()
    
    if len(parts) < 3:
        await message.answer(
            "❌ <b>Неправильный формат команды!</b>\n\n"
            "<b>Использование:</b>\n"
            "<code>/addbalance user_id amount [reason]</code>\n\n"
            "<b>Пример:</b>\n"
            "<code>/addbalance 123456789 1000 За активность</code>",
            parse_mode=ParseMode.HTML
        )
        return
    
    try:
        user_id = int(parts[1])
        amount = int(parts[2])
        reason = " ".join(parts[3:]) if len(parts) > 3 else "Пополнение через команду"
        
        if amount <= 0:
            await message.answer("❌ Количество должно быть положительным!")
            return
        
        # Выполняем пополнение
        result = update_user_balance(
            user_id, amount, reason, 
            config.DATABASE_URL.replace('sqlite:///', '')
        )
        
        if result['success']:
            response = f"""
✅ <b>Баланс успешно пополнен!</b>

<b>Пользователь ID:</b> <code>{user_id}</code>
<b>Выдано:</b> +{amount:,} 💎
<b>Новый баланс:</b> {result['new_balance']:,} 💎
<b>Причина:</b> {reason}
"""
        else:
            response = f"❌ <b>Ошибка:</b> {result['error']}"
        
        await message.answer(response, parse_mode=ParseMode.HTML)
        
    except ValueError:
        await message.answer("❌ <b>Ошибка формата!</b> Убедитесь что ID и количество - числа.", parse_mode=ParseMode.HTML)
    except Exception as e:
        await message.answer(f"❌ <b>Произошла ошибка:</b> {str(e)}", parse_mode=ParseMode.HTML)

# Команда для проверки баланса пользователя
@admin_router.message(Command("checkbalance"))
async def check_user_balance(message: Message):
    """Проверить баланс пользователя"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    parts = message.text.split()
    
    if len(parts) < 2:
        await message.answer(
            "❌ <b>Неправильный формат команды!</b>\n\n"
            "<b>Использование:</b>\n"
            "<code>/checkbalance user_id</code>\n\n"
            "<b>Пример:</b>\n"
            "<code>/checkbalance 123456789</code>",
            parse_mode=ParseMode.HTML
        )
        return
    
    try:
        user_id = int(parts[1])
        user = get_user_by_id(user_id, config.DATABASE_URL.replace('sqlite:///', ''))
        
        if user:
            text = f"""
👤 <b>Информация о пользователе</b>

<b>ID:</b> <code>{user['user_id']}</code>
<b>Имя:</b> {user['first_name']} {user['last_name']}
<b>Юзернейм:</b> @{user['username']}
<b>Баланс:</b> {user['balance']:,} 💎
<b>Уровень:</b> {user['level']}
<b>Опыт:</b> {user['experience']:,}
<b>Дата регистрации:</b> {user['created_at']}
"""
        else:
            text = "❌ <b>Пользователь не найден!</b>"
        
        await message.answer(text, parse_mode=ParseMode.HTML)
        
    except ValueError:
        await message.answer("❌ <b>Некорректный ID пользователя!</b>", parse_mode=ParseMode.HTML)

# Команда для массовой выдачи
@admin_router.message(Command("massadd"))
async def mass_add_balance(message: Message):
    """Массовая выдача кристаллов"""
    from config import config
    if not is_admin(message.from_user.id, config.ADMIN_ID):
        return
    
    text = """
🎯 <b>Массовая выдача кристаллов</b>

<i>Эта функция находится в разработке.</i>

<b>Планируемые функции:</b>
• Выдача всем пользователям
• Выдача по уровню
• Выдача по дате регистрации
• Промо-акции с кодами

<code>Скоро будет доступно!</code>
    """
    
    await message.answer(text, parse_mode=ParseMode.HTML)

# Другие функции админ-панели (заглушки)
@admin_router.callback_query(F.data == "admin_activity")
async def show_activity(callback: CallbackQuery):
    """Показать активность"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
📈 <b>Активность системы</b>

<i>Эта функция находится в разработке.</i>

<b>Планируемые функции:</b>
• Графики активности
• Топ пользователей
• Статистика кейсов
• Аналитика доходов

<code>Скоро будет доступно!</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

@admin_router.callback_query(F.data == "admin_items")
async def manage_items(callback: CallbackQuery):
    """Управление предметами"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
🎁 <b>Управление предметами</b>

<i>Эта функция находится в разработке.</i>

<b>Планируемые функции:</b>
• Добавление новых предметов
• Редактирование существующих
• Настройка редкости и цен
• Импорт/экспорт предметов

<code>Скоро будет доступно!</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

@admin_router.callback_query(F.data == "admin_cases")
async def manage_cases(callback: CallbackQuery):
    """Управление кейсами"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
📦 <b>Управление кейсами</b>

<i>Эта функция находится в разработке.</i>

<b>Планируемые функции:</b>
• Создание новых кейсов
• Настройка вероятностей
• Добавление предметов в кейсы
• Активация/деактивация кейсов

<code>Скоро будет доступно!</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()

@admin_router.callback_query(F.data == "admin_settings")
async def admin_settings(callback: CallbackQuery):
    """Настройки системы"""
    from config import config
    if not is_admin(callback.from_user.id, config.ADMIN_ID):
        await callback.answer("⛔ У вас нет прав администратора!", show_alert=True)
        return
    
    text = """
⚙️ <b>Настройки системы</b>

<i>Эта функция находится в разработке.</i>

<b>Планируемые функции:</b>
• Настройка курса обмена
• Лимиты операций
• Уведомления
• Резервное копирование

<code>Скоро будет доступно!</code>
    """
    
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="🔙 Назад в меню", callback_data="admin_menu")]
        ]
    )
    
    await callback.message.edit_text(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)
    await callback.answer()