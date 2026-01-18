import json
import os
from typing import Any, Dict, List, Optional

import asyncpg


def _db_url() -> str:
    """Получение URL для Railway Postgres"""
    # Используем ваш Railway URL
    url = "postgresql://postgres:LmVpkEHBTwKlNoMyRMGHJCyVQquKRnKQ@shuttle.proxy.rlwy.net:16196/railway"
    
    if not url:
        raise ValueError("❌ DATABASE_URL не задан. Укажи Postgres URL в переменных окружения.")
    
    print(f"🔄 Используем Railway Postgres URL")
    return url


async def create_pool() -> asyncpg.Pool:
    url = _db_url()
    
    print(f"🔗 Подключение к: {url.split('@')[1] if '@' in url else url}")
    
    # Railway требует SSL, но через proxy может работать и без него
    # Пробуем разные варианты подключения
    connection_params = {
        'dsn': url,
        'min_size': 1,
        'max_size': 10,
        'command_timeout': 60,
        'server_settings': {
            'application_name': 'minecraft_cases_bot'
        }
    }
    
    try:
        # Пробуем с SSL
        print("🔐 Пробуем подключение с SSL...")
        return await asyncpg.create_pool(**connection_params, ssl='require')
    except Exception as e1:
        print(f"❌ SSL не работает: {e1}")
        try:
            # Пробуем без SSL
            print("🔓 Пробуем подключение без SSL...")
            return await asyncpg.create_pool(**connection_params, ssl=None)
        except Exception as e2:
            print(f"❌ Подключение не удалось: {e2}")
            raise


async def init_db(pool: asyncpg.Pool) -> None:
    print("🗄️ Инициализация базы данных...")
    
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    user_id BIGINT PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    balance BIGINT NOT NULL DEFAULT 10000,
                    experience BIGINT NOT NULL DEFAULT 0,
                    level INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    last_login TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS items (
                    item_id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    icon TEXT NOT NULL,
                    rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
                    category TEXT NOT NULL CHECK (category IN ('food','resources','weapons','tools','special')),
                    price INT NOT NULL,
                    sell_price INT NOT NULL,
                    description TEXT,
                    texture_url TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS inventory (
                    inventory_id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    item_id INT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
                    quantity INT NOT NULL DEFAULT 1,
                    obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    is_favorite BOOLEAN NOT NULL DEFAULT FALSE
                );

                CREATE TABLE IF NOT EXISTS cases (
                    case_id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    price INT NOT NULL,
                    icon TEXT NOT NULL,
                    description TEXT,
                    rarity_weights JSONB NOT NULL,
                    texture_url TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS opening_history (
                    history_id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    case_id INT NOT NULL REFERENCES cases(case_id) ON DELETE SET NULL,
                    item_id INT NOT NULL REFERENCES items(item_id) ON DELETE SET NULL,
                    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS transactions (
                    transaction_id SERIAL PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    type TEXT NOT NULL CHECK (type IN ('deposit','withdraw','purchase','reward')),
                    amount BIGINT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            print("✅ Таблицы созданы/проверены")
        except Exception as e:
            print(f"❌ Ошибка создания таблиц: {e}")
            raise

    await seed_initial_data(pool)


async def seed_initial_data(pool: asyncpg.Pool) -> None:
    print("🌱 Заполнение начальными данными...")
    
    async with pool.acquire() as conn:
        # Проверяем, есть ли уже данные
        items_count = await conn.fetchval("SELECT COUNT(*) FROM items")
        cases_count = await conn.fetchval("SELECT COUNT(*) FROM cases")
        
        print(f"📊 В базе: {items_count} предметов, {cases_count} кейсов")
        
        if items_count and int(items_count) > 0 and cases_count and int(cases_count) > 0:
            print("✅ Данные уже есть, пропускаем заполнение")
            return

        # Предметы
        print("📝 Добавляем предметы...")
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
            try:
                await conn.execute(
                    """
                    INSERT INTO items (name, icon, rarity, category, price, sell_price, description, texture_url)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                    ON CONFLICT (name) DO NOTHING
                    """,
                    item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7]
                )
            except Exception as e:
                print(f"⚠️ Ошибка добавления предмета {item[0]}: {e}")

        print("✅ Предметы добавлены")

        # Кейсы
        print("🎁 Добавляем кейсы...")
        cases = [
            (
                "🍎 Кейс с Едой",
                100,
                "🍎",
                "Содержит разнообразную еду",
                {"common": 70, "uncommon": 30},
                "assets/textures/cases/case_food.png",
            ),
            (
                "⛏️ Ресурсный Кейс",
                250,
                "⛏️",
                "Руды, минералы и базовые ресурсы",
                {"common": 50, "uncommon": 40, "rare": 10},
                "assets/textures/cases/case_resources.png",
            ),
            (
                "⚔️ Оружейный Кейс",
                500,
                "⚔️",
                "Оружие, броня и инструменты",
                {"uncommon": 40, "rare": 50, "epic": 10},
                "assets/textures/cases/case_weapons.png",
            ),
            (
                "🌟 Легендарный Кейс",
                1000,
                "🌟",
                "Уникальные предметы",
                {"rare": 30, "epic": 50, "legendary": 20},
                "assets/textures/cases/case_legendary.png",
            ),
            (
                "👑 Донат Кейс",
                5000,
                "👑",
                "Эксклюзивные донат предметы",
                {"epic": 40, "legendary": 60},
                "assets/textures/cases/case_donate.png",
            ),
            (
                "🧰 Случайный Кейс",
                750,
                "🧰",
                "Микс из всех категорий",
                {"common": 30, "uncommon": 40, "rare": 20, "epic": 10},
                "assets/textures/cases/case_random.png",
            ),
        ]

        for c in cases:
            try:
                await conn.execute(
                    """
                    INSERT INTO cases (name, price, icon, description, rarity_weights, texture_url)
                    VALUES ($1,$2,$3,$4,$5::jsonb,$6)
                    ON CONFLICT (name) DO NOTHING
                    """,
                    c[0],
                    c[1],
                    c[2],
                    c[3],
                    json.dumps(c[4]),
                    c[5],
                )
            except Exception as e:
                print(f"⚠️ Ошибка добавления кейса {c[0]}: {e}")

        print("✅ Кейсы добавлены")
        print("🎉 Начальные данные успешно загружены!")


async def upsert_user(
    pool: asyncpg.Pool,
    user_id: int,
    username: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    starting_balance: int = 10000,
) -> Dict[str, Any]:
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO users (user_id, username, first_name, last_name, balance, experience, level, last_login)
                VALUES ($1,$2,$3,$4,$5,0,1,NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    username = EXCLUDED.username,
                    first_name = EXCLUDED.first_name,
                    last_name = EXCLUDED.last_name,
                    last_login = NOW()
                RETURNING user_id, username, first_name, last_name, balance, experience, level;
                """,
                user_id,
                username,
                first_name,
                last_name,
                starting_balance,
            )

            # Проверяем, есть ли стартовая транзакция
            exists = await conn.fetchval(
                """SELECT EXISTS(
                       SELECT 1 FROM transactions
                       WHERE user_id=$1 AND type='reward' AND description='Стартовый бонус'
                   )""",
                user_id,
            )
            if not exists:
                await conn.execute(
                    """
                    INSERT INTO transactions (user_id, type, amount, description)
                    VALUES ($1,'reward',$2,'Стартовый бонус')
                    """,
                    user_id,
                    starting_balance,
                )

            return {
                "user_id": row["user_id"],
                "username": row["username"],
                "first_name": row["first_name"],
                "last_name": row["last_name"],
                "balance": int(row["balance"]),
                "experience": int(row["experience"]),
                "level": int(row["level"]),
            }
        except Exception as e:
            print(f"❌ Ошибка upsert_user для {user_id}: {e}")
            raise


async def get_inventory(pool: asyncpg.Pool, user_id: int) -> List[Dict[str, Any]]:
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT i.item_id, i.name, i.icon, i.rarity, i.category, i.price, i.sell_price,
                       i.description, i.texture_url, inv.quantity, inv.obtained_at, inv.is_favorite
                FROM inventory inv
                JOIN items i ON inv.item_id = i.item_id
                WHERE inv.user_id = $1
                ORDER BY inv.is_favorite DESC, inv.obtained_at DESC
                """,
                user_id,
            )
            
            out: List[Dict[str, Any]] = []
            for r in rows:
                out.append(
                    {
                        "id": int(r["item_id"]),
                        "name": r["name"],
                        "icon": r["icon"],
                        "rarity": r["rarity"],
                        "category": r["category"],
                        "price": int(r["price"]),
                        "sell_price": int(r["sell_price"]),
                        "description": r["description"],
                        "texture_url": r["texture_url"],
                        "quantity": int(r["quantity"]),
                        "obtained_at": r["obtained_at"].isoformat() if r["obtained_at"] else None,
                        "is_favorite": bool(r["is_favorite"]),
                    }
                )
            return out
        except Exception as e:
            print(f"❌ Ошибка get_inventory для {user_id}: {e}")
            return []


async def get_cases(pool: asyncpg.Pool) -> List[Dict[str, Any]]:
    async with pool.acquire() as conn:
        try:
            rows = await conn.fetch(
                """
                SELECT case_id, name, price, icon, description, rarity_weights, texture_url
                FROM cases
                WHERE is_active = TRUE
                ORDER BY case_id ASC
                """
            )
            
            cases: List[Dict[str, Any]] = []
            for r in rows:
                cases.append(
                    {
                        "id": int(r["case_id"]),
                        "name": r["name"],
                        "price": int(r["price"]),
                        "icon": r["icon"],
                        "description": r["description"],
                        "rarityWeights": dict(r["rarity_weights"]),
                        "texture_url": r["texture_url"],
                    }
                )
            return cases
        except Exception as e:
            print(f"❌ Ошибка get_cases: {e}")
            return []


async def get_cases_opened_count(pool: asyncpg.Pool, user_id: int) -> int:
    async with pool.acquire() as conn:
        try:
            count = await conn.fetchval(
                "SELECT COUNT(*) FROM opening_history WHERE user_id=$1",
                user_id,
            )
            return int(count) if count else 0
        except Exception as e:
            print(f"❌ Ошибка get_cases_opened_count для {user_id}: {e}")
            return 0


async def open_case(pool: asyncpg.Pool, user_id: int, case_id: int) -> Dict[str, Any]:
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                # Получаем кейс
                case_row = await conn.fetchrow(
                    "SELECT case_id, name, price, rarity_weights FROM cases WHERE case_id=$1 AND is_active=TRUE",
                    case_id,
                )
                if not case_row:
                    return {"error": "Кейс не найден"}

                case_price = int(case_row["price"])
                case_name = case_row["name"]
                rarity_weights = dict(case_row["rarity_weights"])

                # Проверяем баланс пользователя
                user_balance = await conn.fetchval(
                    "SELECT balance FROM users WHERE user_id=$1 FOR UPDATE",
                    user_id,
                )
                if user_balance is None:
                    return {"error": "Пользователь не найден"}
                if int(user_balance) < case_price:
                    return {"error": "Недостаточно средств"}

                # Выбираем редкость по весам
                total = sum(int(v) for v in rarity_weights.values())
                import random
                rnd = random.uniform(0, total)
                
                selected = "common"
                cum = 0
                for rarity, w in rarity_weights.items():
                    cum += int(w)
                    if rnd <= cum:
                        selected = rarity
                        break

                # Выбираем случайный предмет выбранной редкости
                item_row = await conn.fetchrow(
                    """
                    SELECT item_id, name, icon, rarity, price, description, texture_url
                    FROM items
                    WHERE rarity=$1
                    ORDER BY RANDOM()
                    LIMIT 1
                    """,
                    selected,
                )
                if not item_row:
                    return {"error": "Не удалось выбрать предмет"}

                item = {
                    "id": int(item_row["item_id"]),
                    "name": item_row["name"],
                    "icon": item_row["icon"],
                    "rarity": item_row["rarity"],
                    "price": int(item_row["price"]),
                    "description": item_row["description"],
                    "texture_url": item_row["texture_url"],
                }

                # Списываем баланс
                await conn.execute(
                    "UPDATE users SET balance = balance - $1 WHERE user_id=$2",
                    case_price,
                    user_id,
                )
                
                # Добавляем транзакцию
                await conn.execute(
                    """
                    INSERT INTO transactions (user_id, type, amount, description)
                    VALUES ($1,'purchase',$2,$3)
                    """,
                    user_id,
                    -case_price,
                    f"Покупка кейса: {case_name}",
                )

                # Добавляем предмет в инвентарь
                await conn.execute(
                    "INSERT INTO inventory (user_id, item_id) VALUES ($1,$2)",
                    user_id,
                    item["id"],
                )

                # Записываем в историю
                await conn.execute(
                    "INSERT INTO opening_history (user_id, case_id, item_id) VALUES ($1,$2,$3)",
                    user_id,
                    case_id,
                    item["id"],
                )

                # Начисляем опыт
                exp_gained = case_price // 10
                await conn.execute(
                    "UPDATE users SET experience = experience + $1 WHERE user_id=$2",
                    exp_gained,
                    user_id,
                )
                
                # Проверяем повышение уровня
                exp, lvl = await conn.fetchrow(
                    "SELECT experience, level FROM users WHERE user_id=$1",
                    user_id,
                )
                exp = int(exp)
                lvl = int(lvl)
                new_lvl = lvl
                
                while exp >= new_lvl * 1000:
                    new_lvl += 1
                    
                if new_lvl > lvl:
                    await conn.execute(
                        "UPDATE users SET level=$1 WHERE user_id=$2",
                        new_lvl,
                        user_id,
                    )

                # Получаем обновленные данные пользователя
                updated = await conn.fetchrow(
                    "SELECT balance, experience, level FROM users WHERE user_id=$1",
                    user_id,
                )

                print(f"✅ Кейс открыт: user_id={user_id}, item={item['name']}, balance={updated['balance']}")

                return {
                    "success": True,
                    "item": item,
                    "new_balance": int(updated["balance"]),
                    "experience_gained": exp_gained,
                    "case_price": case_price,
                    "experience": int(updated["experience"]),
                    "level": int(updated["level"]),
                }
                
        except Exception as e:
            print(f"❌ Ошибка open_case для user_id={user_id}, case_id={case_id}: {e}")
            return {"error": f"Внутренняя ошибка сервера: {str(e)}"}


async def sell_item(pool: asyncpg.Pool, user_id: int, item_id: int) -> Dict[str, Any]:
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                # Получаем информацию о предмете
                item = await conn.fetchrow(
                    "SELECT sell_price, name FROM items WHERE item_id=$1",
                    item_id,
                )
                if not item:
                    return {"error": "Предмет не найден"}

                # Удаляем один экземпляр предмета из инвентаря
                deleted = await conn.execute(
                    """
                    DELETE FROM inventory
                    WHERE ctid IN (
                        SELECT ctid FROM inventory
                        WHERE user_id=$1 AND item_id=$2
                        ORDER BY obtained_at DESC
                        LIMIT 1
                    )
                    """,
                    user_id,
                    item_id,
                )
                if deleted.endswith("0"):
                    return {"error": "Предмет не найден в инвентаре"}

                sell_price = int(item["sell_price"])
                item_name = item["name"]

                # Начисляем деньги
                await conn.execute(
                    "UPDATE users SET balance = balance + $1 WHERE user_id=$2",
                    sell_price,
                    user_id,
                )
                
                # Добавляем транзакцию
                await conn.execute(
                    """
                    INSERT INTO transactions (user_id, type, amount, description)
                    VALUES ($1,'reward',$2,$3)
                    """,
                    user_id,
                    sell_price,
                    f"Продажа предмета: {item_name}",
                )

                # Получаем новый баланс
                new_balance = await conn.fetchval(
                    "SELECT balance FROM users WHERE user_id=$1",
                    user_id,
                )
                
                print(f"✅ Предмет продан: user_id={user_id}, item={item_name}, price={sell_price}")

                return {
                    "success": True,
                    "sell_price": sell_price,
                    "new_balance": int(new_balance) if new_balance else 0,
                }
                
        except Exception as e:
            print(f"❌ Ошибка sell_item для user_id={user_id}, item_id={item_id}: {e}")
            return {"error": f"Внутренняя ошибка сервера: {str(e)}"}


async def reset_all_user_data(pool: asyncpg.Pool) -> None:
    """Полный сброс всех данных пользователей"""
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                print("🧹 Начинаем сброс данных пользователей...")
                
                # Сначала получаем статистику
                users_count = await conn.fetchval("SELECT COUNT(*) FROM users")
                inventory_count = await conn.fetchval("SELECT COUNT(*) FROM inventory")
                openings_count = await conn.fetchval("SELECT COUNT(*) FROM opening_history")
                transactions_count = await conn.fetchval("SELECT COUNT(*) FROM transactions")
                
                print(f"📊 Перед сбросом: {users_count} пользователей, {inventory_count} предметов в инвентаре")
                
                # Сбрасываем данные
                await conn.execute("TRUNCATE TABLE inventory RESTART IDENTITY CASCADE")
                await conn.execute("TRUNCATE TABLE opening_history RESTART IDENTITY CASCADE")
                await conn.execute("TRUNCATE TABLE transactions RESTART IDENTITY CASCADE")
                
                # Сбрасываем пользователей (но сохраняем записи с начальным балансом)
                await conn.execute("UPDATE users SET balance = 10000, experience = 0, level = 1")
                
                # Проверяем после сброса
                users_after = await conn.fetchval("SELECT COUNT(*) FROM users")
                inventory_after = await conn.fetchval("SELECT COUNT(*) FROM inventory")
                
                print(f"✅ После сброса: {users_after} пользователей, {inventory_after} предметов в инвентаре")
                print("🎉 Сброс данных пользователей завершен успешно!")
                
        except Exception as e:
            print(f"❌ Ошибка при сбросе данных: {e}")
            raise