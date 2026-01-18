import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    """Конфигурация бота"""
    BOT_TOKEN: str = os.getenv('BOT_TOKEN')
    ADMIN_ID: int = int(os.getenv('ADMIN_ID', 0))
    DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
    # Postgres (Railway). Пример:
    # postgresql://postgres:password@host:port/railway
    DATABASE_URL: str = os.getenv('DATABASE_URL', '')
    
    # Настройки Web App
    WEB_APP_URL: str = os.getenv('WEB_APP_URL', 'https://mrmicse.github.io/minecraft-cases/')
    
    # Настройки игры
    STARTING_BALANCE: int = 1000
    DAILY_BONUS: int = 100
    MIN_BET: int = 10
    MAX_BET: int = 10000
    
    # Проверка обязательных настроек
    def validate(self):
        if not self.BOT_TOKEN:
            raise ValueError("❌ BOT_TOKEN не найден в .env файле!")
        if not self.DATABASE_URL:
            raise ValueError("❌ DATABASE_URL не найден. Укажи Postgres URL (Railway) в .env")
        if not self.ADMIN_ID:
            print("⚠️  ADMIN_ID не указан. Админ панель будет недоступна.")
        return self

# Создаем экземпляр конфигурации
config = Config().validate()