import asyncio
import json
import os
from typing import Any, Dict

from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)

from db import (
    create_pool,
    get_cases,
    get_cases_opened_count,
    get_inventory,
    init_db,
    open_case as db_open_case,
    reset_all_user_data,
    sell_item as db_sell_item,
    upsert_user,
)


load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_ID = int(os.getenv("ADMIN_ID", "0") or 0)
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
WEB_APP_URL = os.getenv("WEB_APP_URL", "https://mrmicse.github.io/minecraft-cases/")

if not BOT_TOKEN:
    raise ValueError("❌ BOT_TOKEN не найден в .env файле!")

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

DB_POOL = None


def build_main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="👤 Профиль", callback_data="profile"),
                InlineKeyboardButton(text="🎒 Инвентарь", callback_data="inventory"),
            ],
            [
                InlineKeyboardButton(text="💰 Пополнить баланс", callback_data="deposit"),
                InlineKeyboardButton(text="🔄 Обменять предметы", callback_data="trade"),
            ],
        ]
    )


def build_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="↩️ Вернуться назад", callback_data="back_to_menu")]]
    )


def build_main_menu_text(first_name: str, user: Dict[str, Any], cases_opened: int) -> str:
    return f"""
⛏️ <b>Добро пожаловать в Minecraft Case Opening, {first_name}!</b>

💰 <b>Баланс:</b> {user['balance']} 💎
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} XP

🎁 <b>Ежедневный бонус:</b> 100 💎 (/daily)
🏆 <b>Открыто кейсов:</b> {cases_opened} (/stats)

<code>Открывайте веб-приложение через кнопку под строкой ввода.</code>
"""


async def get_user_data_for_webapp(user_id: int) -> Dict[str, Any]:
    assert DB_POOL is not None
    # гарантируем наличие пользователя
    user = await upsert_user(DB_POOL, user_id, None, None, None)
    inventory = await get_inventory(DB_POOL, user_id)
    cases = await get_cases(DB_POOL)
    return {
        "user": {"balance": user["balance"], "experience": user["experience"], "level": user["level"]},
        "inventory": inventory,
        "cases": cases,
    }


@router.message(Command("start"))
async def cmd_start(message: Message):
    assert DB_POOL is not None

    u = message.from_user
    user = await upsert_user(
        DB_POOL,
        u.id,
        u.username,
        u.first_name,
        u.last_name,
    )
    cases_opened = await get_cases_opened_count(DB_POOL, u.id)

    await bot.set_chat_menu_button(
        chat_id=message.chat.id,
        menu_button=MenuButtonWebApp(text="⛏️ Minecraft Кейсы", web_app=WebAppInfo(url=WEB_APP_URL)),
    )

    await message.answer(
        build_main_menu_text(u.first_name or "Игрок", user, cases_opened),
        reply_markup=build_main_menu_keyboard(),
        parse_mode=ParseMode.HTML,
    )


@router.message(Command("resetall"))
async def cmd_reset_all(message: Message):
    """Админ-команда: полный сброс данных пользователей (баланс/инвентарь/история/транзакции).

    ❗ items и cases НЕ трогаем.
    """
    assert DB_POOL is not None
    if message.from_user is None or message.from_user.id != ADMIN_ID:
        return await message.answer("⛔ Недостаточно прав.")

    await reset_all_user_data(DB_POOL)
    await message.answer("✅ Готово. Все данные пользователей сброшены. Перезапустите WebApp.")

@router.message(Command("sync"))
async def cmd_sync(message: Message):
    """Команда для принудительной синхронизации данных WebApp с сервером."""
    assert DB_POOL is not None
    u = message.from_user
    
    # Принудительно обновляем данные пользователя
    user = await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    
    # Получаем актуальные данные
    inventory = await get_inventory(DB_POOL, u.id)
    cases = await get_cases(DB_POOL)
    cases_opened = await get_cases_opened_count(DB_POOL, u.id)
    
    text = f"""
🔄 <b>Принудительная синхронизация</b>

✅ Данные синхронизированы с сервером:
💰 Баланс: {user['balance']} 💎
🎮 Уровень: {user['level']}
⭐ Опыт: {user['experience']}
📦 Предметов: {len(inventory)}
🎁 Кейсов открыто: {cases_opened}

Чтобы обновить данные в WebApp:
1. Закройте WebApp
2. Нажмите кнопку "⛏️ Minecraft Кейсы" внизу
3. Или перезагрузите страницу в WebApp
"""
    await message.answer(text, parse_mode=ParseMode.HTML)

@router.message(Command("admin"))
async def cmd_admin(message: Message):
    """Админ-панель с командами."""
    assert DB_POOL is not None
    if message.from_user is None or message.from_user.id != ADMIN_ID:
        return await message.answer("⛔ Недостаточно прав.")
    
    # Статистика базы данных
    async with DB_POOL.acquire() as conn:
        users_count = await conn.fetchval("SELECT COUNT(*) FROM users")
        items_count = await conn.fetchval("SELECT COUNT(*) FROM items")
        inventory_count = await conn.fetchval("SELECT COUNT(*) FROM inventory")
        cases_count = await conn.fetchval("SELECT COUNT(*) FROM cases")
        openings_count = await conn.fetchval("SELECT COUNT(*) FROM opening_history")
        total_balance = await conn.fetchval("SELECT SUM(balance) FROM users")
    
    text = f"""
🛠️ <b>Админ-панель</b>

📊 <b>Статистика базы данных:</b>
👥 Пользователей: {users_count}
🎁 Предметов: {items_count}
📦 Записей инвентаря: {inventory_count}
🎰 Кейсов: {cases_count}
🎮 Открытий: {openings_count}
💰 Общий баланс: {total_balance or 0} 💎

⚙️ <b>Доступные команды:</b>
/resetall - Полный сброс данных пользователей
/sync - Принудительная синхронизация
/balance - Проверить баланс
/stats - Статистика

⚠️ <b>Внимание:</b> После /resetall пользователям нужно перезапустить WebApp!
"""
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🔄 Синхронизировать", callback_data="admin_sync"),
            InlineKeyboardButton(text="🗑️ Сбросить всё", callback_data="admin_reset_confirm")
        ],
        [InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats")]
    ])
    
    await message.answer(text, reply_markup=keyboard, parse_mode=ParseMode.HTML)

@router.callback_query(F.data == "admin_reset_confirm")
async def handle_admin_reset_confirm(callback: CallbackQuery):
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("⛔ Недостаточно прав.")
        return
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Да, сбросить", callback_data="admin_reset_yes"),
            InlineKeyboardButton(text="❌ Отмена", callback_data="admin_cancel")
        ]
    ])
    
    await callback.message.edit_text(
        "⚠️ <b>Вы уверены, что хотите сбросить ВСЕ данные пользователей?</b>\n\n"
        "Это удалит:\n"
        "• Всех пользователей\n"
        "• Весь инвентарь\n"
        "• Историю открытий\n"
        "• Транзакции\n\n"
        "❗ <b>Внимание:</b> Предметы и кейсы останутся в базе.\n"
        "❗ После сброса пользователям нужно перезапустить WebApp!",
        reply_markup=keyboard,
        parse_mode=ParseMode.HTML
    )
    await callback.answer()

@router.callback_query(F.data == "admin_reset_yes")
async def handle_admin_reset_yes(callback: CallbackQuery):
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("⛔ Недостаточно прав.")
        return
    
    await reset_all_user_data(DB_POOL)
    
    await callback.message.edit_text(
        "✅ <b>Готово!</b> Все данные пользователей сброшены.\n\n"
        "Сообщите пользователям о необходимости перезапустить WebApp.",
        parse_mode=ParseMode.HTML
    )
    await callback.answer("Данные сброшены!")

@router.callback_query(F.data == "admin_sync")
async def handle_admin_sync(callback: CallbackQuery):
    if callback.from_user.id != ADMIN_ID:
        await callback.answer("⛔ Недостаточно прав.")
        return
    
    # Статистика
    async with DB_POOL.acquire() as conn:
        users_count = await conn.fetchval("SELECT COUNT(*) FROM users")
        total_balance = await conn.fetchval("SELECT SUM(balance) FROM users")
    
    await callback.message.edit_text(
        f"🔄 <b>Синхронизация выполнена</b>\n\n"
        f"👥 Пользователей: {users_count}\n"
        f"💰 Общий баланс: {total_balance or 0} 💎\n\n"
        f"Для принудительной синхронизации отдельного пользователя используйте /sync",
        parse_mode=ParseMode.HTML
    )
    await callback.answer("Синхронизировано")

@router.callback_query(F.data == "admin_cancel")
async def handle_admin_cancel(callback: CallbackQuery):
    await callback.message.edit_text("❌ Действие отменено.")
    await callback.answer()

@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Показать статистику."""
    assert DB_POOL is not None
    u = message.from_user
    
    user = await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    inventory = await get_inventory(DB_POOL, u.id)
    cases_opened = await get_cases_opened_count(DB_POOL, u.id)
    
    # Суммарная стоимость инвентаря
    total_value = sum(item.get('price', 0) for item in inventory)
    
    text = f"""
📊 <b>Ваша статистика</b>

👤 Игрок: {u.first_name}
💰 Баланс: {user['balance']} 💎
🎮 Уровень: {user['level']}
⭐ Опыт: {user['experience']} / {user['level'] * 1000}
📦 Предметов в инвентаре: {len(inventory)}
📈 Стоимость инвентаря: {total_value} 💎
🎁 Открыто кейсов: {cases_opened}

<b>До следующего уровня:</b> {user['level'] * 1000 - user['experience']} XP
"""
    await message.answer(text, parse_mode=ParseMode.HTML)


@router.callback_query(F.data == "profile")
async def handle_profile(callback: CallbackQuery):
    assert DB_POOL is not None
    u = callback.from_user

    user = await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    inventory = await get_inventory(DB_POOL, u.id)
    cases_opened = await get_cases_opened_count(DB_POOL, u.id)

    text = f"""
👤 <b>Профиль игрока</b>

Имя: {u.first_name}
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
    assert DB_POOL is not None
    u = callback.from_user

    await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    inventory = await get_inventory(DB_POOL, u.id)

    if inventory:
        items_preview = "\n".join(
            f"• {item['icon']} {item['name']} — {str(item['rarity']).capitalize()} ({item['price']} 💎)"
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
    text = """
💰 <b>Пополнение баланса</b>

В ближайшее время здесь появятся удобные способы пополнения.
Следите за обновлениями!
"""
    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "trade")
async def handle_trade(callback: CallbackQuery):
    text = """
🔄 <b>Обмен предметов</b>

Скоро вы сможете обменивать предметы и получать бонусы.
Пока что возвращайтесь в меню!
"""
    await callback.message.edit_text(text, reply_markup=build_back_keyboard(), parse_mode=ParseMode.HTML)
    await callback.answer()


@router.callback_query(F.data == "back_to_menu")
async def handle_back_to_menu(callback: CallbackQuery):
    assert DB_POOL is not None
    u = callback.from_user
    user = await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    cases_opened = await get_cases_opened_count(DB_POOL, u.id)
    await callback.message.edit_text(
        build_main_menu_text(u.first_name or "Игрок", user, cases_opened),
        reply_markup=build_main_menu_keyboard(),
        parse_mode=ParseMode.HTML,
    )
    await callback.answer()


@router.message(Command("balance"))
async def cmd_balance(message: Message):
    assert DB_POOL is not None
    u = message.from_user
    user = await upsert_user(DB_POOL, u.id, u.username, u.first_name, u.last_name)
    inventory = await get_inventory(DB_POOL, u.id)
    total_value = sum(int(i.get("price", 0)) for i in inventory)
    text = f"""
💰 <b>Статистика аккаунта</b>

👤 <b>Игрок:</b> {u.first_name}
💎 <b>Баланс:</b> {user['balance']}
🎮 <b>Уровень:</b> {user['level']}
⭐ <b>Опыт:</b> {user['experience']} / {user['level'] * 1000}
📦 <b>Предметов в инвентаре:</b> {len(inventory)}
📊 <b>Общая стоимость:</b> {total_value} 💎
"""
    await message.answer(text, parse_mode=ParseMode.HTML)


@router.message(F.web_app_data)
async def handle_web_app_data(message: Message):
    """Единый канал синхронизации.

    WebApp (github.io) не может ходить в Postgres напрямую.
    Поэтому WebApp общается с ботом через Telegram WebApp API (sendData),
    а бот уже читает/пишет Postgres.
    """
    assert DB_POOL is not None
    try:
        data = json.loads(message.web_app_data.data)
        u = message.from_user
        user_id = u.id
        action = data.get("action")

        # всегда апсертим пользователя, чтобы баланс/инвентарь были общими
        await upsert_user(DB_POOL, user_id, u.username, u.first_name, u.last_name)

        if action in ("init", "sync_data"):
            webapp_data = await get_user_data_for_webapp(user_id)
            webapp_data["success"] = True
            webapp_data["config"] = {
                "min_bet": 10,
                "max_bet": 10000,
                "daily_bonus": 100,
                "version": "1.0.0",
            }
            await message.answer(json.dumps(webapp_data), parse_mode=None)
            return

        if action == "open_case":
            case_id = int(data.get("case_id"))
            result = await db_open_case(DB_POOL, user_id, case_id)
            if "error" in result:
                await message.answer(json.dumps({"success": False, "error": result["error"]}), parse_mode=None)
                return

            webapp_data = await get_user_data_for_webapp(user_id)
            result.update(webapp_data)
            await message.answer(json.dumps(result), parse_mode=None)
            return

        if action == "sell_item":
            item_id = int(data.get("item_id"))
            result = await db_sell_item(DB_POOL, user_id, item_id)
            if "error" in result:
                await message.answer(json.dumps({"success": False, "error": result["error"]}), parse_mode=None)
                return

            webapp_data = await get_user_data_for_webapp(user_id)
            result.update(webapp_data)
            await message.answer(json.dumps(result), parse_mode=None)
            return

        await message.answer(json.dumps({"success": False, "error": "Неизвестное действие"}), parse_mode=None)

    except json.JSONDecodeError:
        await message.answer(json.dumps({"success": False, "error": "Неверный формат данных"}), parse_mode=None)
    except Exception as e:
        if DEBUG:
            err = str(e)
        else:
            err = "Произошла ошибка. Пожалуйста, попробуйте позже."
        await message.answer(json.dumps({"success": False, "error": err}), parse_mode=None)


@router.message()
async def handle_unknown(message: Message):
    await message.answer("🤔 Не понимаю вашу команду. Используйте /help для списка команд.")


async def main():
    global DB_POOL
    DB_POOL = await create_pool()
    await init_db(DB_POOL)

    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot")
    print(f"👑 Админ ID: {ADMIN_ID}")
    print(f"🐛 Режим отладки: {DEBUG}")
    print(f"🌐 WEB_APP_URL: {WEB_APP_URL}")
    print("🗄️ Postgres: OK")
    print("=" * 50)

    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
