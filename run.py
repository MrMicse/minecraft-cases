#!/usr/bin/env python3
import subprocess
import sys
import os
from pathlib import Path

def check_requirements():
    """Проверка установленных зависимостей"""
    try:
        import aiogram
        import dotenv
        print("✅ Зависимости установлены")
        return True
    except ImportError as e:
        print(f"❌ Не установлены зависимости: {e}")
        print("📦 Устанавливаем зависимости...")
        
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            print("✅ Зависимости успешно установлены")
            return True
        except subprocess.CalledProcessError:
            print("❌ Не удалось установить зависимости")
            return False

def check_env():
    """Проверка .env файла"""
    env_file = Path(".env")
    
    if not env_file.exists():
        print("❌ Файл .env не найден")
        print("📝 Создаем шаблон .env файла...")
        
        env_template = """BOT_TOKEN=ваш_токен_бота
ADMIN_ID=ваш_id_администратора
DATABASE_URL=sqlite:///minecraft_cases.db
DEBUG=False
WEB_APP_URL=https://ваш-username.github.io/minecraft-cases/
"""
        
        with open(".env", "w") as f:
            f.write(env_template)
        
        print("✅ .env файл создан")
        print("⚠️  Отредактируйте .env файл, указав ваш токен бота")
        return False
    
    with open(".env", "r") as f:
        content = f.read()
        
    if "ваш_токен_бота" in content:
        print("⚠️  В .env файле указан пример токена!")
        print("📝 Отредактируйте файл .env перед запуском")
        return False
    
    return True

def create_directories():
    """Создание необходимых директорий"""
    directories = ["data", "logs", "assets/textures", "assets/sounds", "assets/icons"]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
    
    print("✅ Директории созданы")

def run_bot():
    """Запуск бота"""
    print("🚀 Запуск Minecraft Case Bot...")
    
    try:
        # Импортируем и запускаем основной скрипт
        from bot import main
        import asyncio
        
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Бот остановлен пользователем")
    except Exception as e:
        print(f"❌ Ошибка при запуске бота: {e}")
        sys.exit(1)

def main():
    """Основная функция"""
    print("=" * 50)
    print("🎮 Minecraft Case Opening Bot - Установщик")
    print("=" * 50)
    
    # Проверка Python версии
    if sys.version_info < (3, 9):
        print("❌ Требуется Python 3.9 или выше")
        sys.exit(1)
    
    print(f"🐍 Версия Python: {sys.version}")
    
    # Создание директорий
    create_directories()
    
    # Проверка зависимостей
    if not check_requirements():
        sys.exit(1)
    
    # Проверка .env файла
    if not check_env():
        answer = input("❓ Продолжить без настройки токена? (y/N): ")
        if answer.lower() != 'y':
            sys.exit(1)
    
    # Запуск бота
    run_bot()

if __name__ == "__main__":
    main()