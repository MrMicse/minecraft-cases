// Инициализация Telegram Web App
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.expand();
    tg.BackButton?.hide();
}

// Глобальные переменные
let userData = {
    balance: 0,
    inventory: [],
    stats: {}
};

let casesData = [];
let currentCase = null;
let currentItem = null;
let isOpening = false;
let isRouletteActive = false;

// DOM элементы
const elements = {
    balance: document.getElementById('user-balance'),
    casesGrid: document.getElementById('cases-grid'),
    itemsTrack: document.getElementById('items-track'),
    inventoryGrid: document.getElementById('inventory-grid'),
    
    // Модальные окна
    caseModal: document.getElementById('case-modal'),
    inventoryModal: document.getElementById('inventory-modal'),
    resultModal: document.getElementById('result-modal'),
    loadingOverlay: document.getElementById('loading'),
    
    // Кнопки
    inventoryBtn: document.getElementById('inventory-btn'),
    closeModal: document.getElementById('close-modal'),
    closeInventory: document.getElementById('close-inventory'),
    closeResult: document.getElementById('close-result'),
    openCaseBtn: document.getElementById('open-case-btn'),
    
    // Текстовые элементы
    caseName: document.getElementById('case-name'),
    casePriceValue: document.getElementById('case-price-value'),
    caseDescription: document.getElementById('case-description'),
    openPrice: document.getElementById('open-price'),
    resultItemName: document.getElementById('result-item-name'),
    resultItemRarity: document.getElementById('result-item-rarity'),
    resultItemPrice: document.getElementById('result-item-price'),
    resultItemIcon: document.getElementById('result-icon'),
    newBalance: document.getElementById('new-balance'),
};

// Функция отправки данных в бота
async function sendToBot(data) {
    try {
        if (tg) {
            return await tg.sendData(JSON.stringify(data));
        } else {
            // Для локальной разработки
            console.log('Отправка в бот:', data);
            
            // Имитация ответа бота
            if (data.action === 'init') {
                return {
                    user: {
                        balance: 1000,
                        inventory: [],
                        stats: { cases_opened: 0, total_items: 0 }
                    },
                    cases: getMockCases(),
                    config: {
                        min_bet: 10,
                        max_bet: 10000,
                        daily_bonus: 100,
                        version: '2.0.0'
                    }
                };
            } else if (data.action === 'open_case') {
                const item = getMockItem();
                return {
                    success: true,
                    item: item,
                    new_balance: userData.balance - currentCase.price,
                    experience_gained: 10,
                    case_price: currentCase.price
                };
            }
        }
    } catch (error) {
        console.error('Ошибка отправки в бот:', error);
        return { error: 'Ошибка связи с ботом' };
    }
}

// Мок-данные для разработки
function getMockCases() {
    return [
        {
            id: 1,
            name: '🍎 Кейс с Едой',
            price: 100,
            icon: '🍎',
            description: 'Содержит разнообразную еду',
            rarity_weights: { common: 70, uncommon: 30 }
        },
        {
            id: 2,
            name: '⛏️ Ресурсный Кейс',
            price: 250,
            icon: '⛏️',
            description: 'Руды, минералы и ресурсы',
            rarity_weights: { common: 50, uncommon: 40, rare: 10 }
        }
    ];
}

function getMockItem() {
    const items = [
        { name: "Алмаз", icon: "💎", rarity: "uncommon", price: 150, description: "Ценный минерал" },
        { name: "Яблоко", icon: "🍎", rarity: "common", price: 40, description: "Восстанавливает голод" },
        { name: "Железный меч", icon: "⚔️", rarity: "uncommon", price: 180, description: "Базовое оружие" }
    ];
    return items[Math.floor(Math.random() * items.length)];
}

// Инициализация приложения
async function initApp() {
    console.log('Инициализация приложения...');
    showLoading();
    
    try {
        // Запрашиваем данные у бота
        const response = await sendToBot({ action: 'init' });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        // Обновляем данные
        userData = response.user;
        casesData = response.cases;
        
        // Обновляем интерфейс
        updateUI();
        
        console.log('Данные загружены:', userData);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        
        // Используем мок-данные
        userData = {
            balance: 1000,
            inventory: [],
            stats: { cases_opened: 0, total_items: 0 }
        };
        casesData = getMockCases();
        
        updateUI();
        alert('Используются локальные данные. Для полной функциональности откройте через Telegram бота.');
    }
    
    setTimeout(() => {
        hideLoading();
        console.log('Приложение загружено!');
    }, 500);
}

// Обновление интерфейса
function updateUI() {
    // Обновляем баланс
    elements.balance.textContent = userData.balance.toLocaleString();
    
    // Отрисовываем кейсы
    renderCases();
    
    // Отрисовываем инвентарь если модальное окно открыто
    if (elements.inventoryModal.classList.contains('active')) {
        renderInventory();
    }
}

// Отрисовка кейсов
function renderCases() {
    console.log('Отрисовка кейсов...');
    elements.casesGrid.innerHTML = '';
    
    casesData.forEach((caseItem, index) => {
        const caseCard = document.createElement('div');
        caseCard.className = 'case-card';
        caseCard.dataset.id = caseItem.id;
        
        // Создаем превью предметов
        const previewItems = getPreviewItems(caseItem);
        
        caseCard.innerHTML = `
            <div class="case-image">
                <div class="case-icon">${caseItem.icon}</div>
                <div class="case-items-preview">
                    ${previewItems.map(item => `<span>${item.icon}</span>`).join('')}
                </div>
            </div>
            <div class="case-info">
                <h3 class="case-name">${caseItem.name}</h3>
                <p class="case-price">${caseItem.price} 💎</p>
                <p class="case-description">${caseItem.description}</p>
            </div>
        `;
        
        caseCard.addEventListener('click', () => openCaseModal(caseItem));
        elements.casesGrid.appendChild(caseCard);
    });
}

// Получение предметов для превью
function getPreviewItems(caseItem) {
    const previewItems = [];
    const allItems = [];
    
    // Создаем предметы на основе редкостей
    const itemTemplates = {
        common: [{icon: "🍎", name: "Еда"}, {icon: "⛓️", name: "Ресурс"}],
        uncommon: [{icon: "💎", name: "Алмаз"}, {icon: "⚔️", name: "Оружие"}],
        rare: [{icon: "🔱", name: "Незерит"}, {icon: "🧥", name: "Элитра"}],
        epic: [{icon: "🐦", name: "Тотем"}, {icon: "💙", name: "Сердце моря"}],
        legendary: [{icon: "🟪", name: "Командный блок"}, {icon: "👑", name: "Корона"}]
    };
    
    // Добавляем предметы по редкостям
    for (const [rarity, weight] of Object.entries(caseItem.rarity_weights || {})) {
        if (weight > 0 && itemTemplates[rarity]) {
            allItems.push(...itemTemplates[rarity]);
        }
    }
    
    // Выбираем 3-4 предмета для превью
    const count = Math.min(4, allItems.length);
    const shuffledItems = [...allItems].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < count; i++) {
        if (shuffledItems[i]) {
            previewItems.push(shuffledItems[i]);
        }
    }
    
    return previewItems;
}

// Открытие модального окна кейса
function openCaseModal(caseItem) {
    console.log('Открытие модального окна:', caseItem.name);
    currentCase = caseItem;
    
    // Сбрасываем состояние
    isOpening = false;
    isRouletteActive = false;
    
    // Обновляем информацию о кейсе
    elements.caseName.textContent = caseItem.name;
    elements.casePriceValue.textContent = caseItem.price;
    elements.openPrice.textContent = caseItem.price;
    elements.caseDescription.textContent = caseItem.description;
    
    // Проверяем баланс
    if (userData.balance < caseItem.price) {
        elements.openCaseBtn.disabled = true;
        elements.openCaseBtn.innerHTML = '❌ Недостаточно 💎';
    } else {
        elements.openCaseBtn.disabled = false;
        elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${caseItem.price} 💎`;
    }
    
    // Создаем превью предметов
    createCaseItemsPreview(caseItem);
    
    // Подготавливаем рулетку
    prepareRouletteForCase(caseItem);
    
    showModal(elements.caseModal);
}

// Подготовка рулетки
function prepareRouletteForCase(caseItem) {
    console.log('Подготовка рулетки');
    
    // Генерируем предметы для рулетки
    const rouletteItems = generateRouletteItems(caseItem);
    
    // Очищаем и заполняем рулетку
    elements.itemsTrack.innerHTML = '';
    
    rouletteItems.forEach((item, index) => {
        const rouletteItem = document.createElement('div');
        rouletteItem.className = `roulette-item ${item.rarity}`;
        rouletteItem.innerHTML = `
            <div class="roulette-item-icon">${item.icon}</div>
            <div class="roulette-item-name">${item.name}</div>
            <div class="roulette-item-rarity">${getRarityText(item.rarity)}</div>
        `;
        elements.itemsTrack.appendChild(rouletteItem);
    });
    
    // Центрируем первый предмет
    setTimeout(() => {
        const containerWidth = elements.caseModal.querySelector('.roulette-container').clientWidth;
        const itemWidth = 110;
        const initialPosition = (containerWidth / 2) - (itemWidth / 2);
        
        elements.itemsTrack.style.transform = `translateX(${initialPosition}px)`;
        elements.itemsTrack.style.transition = 'none';
    }, 100);
}

// Генерация предметов для рулетки
function generateRouletteItems(caseItem) {
    const items = [];
    const itemCount = 15;
    
    // Шаблоны предметов по редкостям
    const rarityItems = {
        common: [
            {name: "Яблоко", icon: "🍎", rarity: "common"},
            {name: "Хлеб", icon: "🍞", rarity: "common"},
            {name: "Уголь", icon: "⚫", rarity: "common"},
            {name: "Железный слиток", icon: "⛓️", rarity: "common"}
        ],
        uncommon: [
            {name: "Алмаз", icon: "💎", rarity: "uncommon"},
            {name: "Изумруд", icon: "🟩", rarity: "uncommon"},
            {name: "Железный меч", icon: "⚔️", rarity: "uncommon"},
            {name: "Лук", icon: "🏹", rarity: "uncommon"}
        ],
        rare: [
            {name: "Алмазный меч", icon: "⚔️💎", rarity: "rare"},
            {name: "Алмазная кирка", icon: "⛏️💎", rarity: "rare"},
            {name: "Незеритовый слиток", icon: "🔱", rarity: "rare"}
        ],
        epic: [
            {name: "Тотем бессмертия", icon: "🐦", rarity: "epic"},
            {name: "Сердце моря", icon: "💙", rarity: "epic"}
        ],
        legendary: [
            {name: "Командный блок", icon: "🟪", rarity: "legendary"},
            {name: "Меч незера", icon: "🗡️", rarity: "legendary"}
        ]
    };
    
    // Добавляем предметы на основе весов редкостей
    for (let i = 0; i < itemCount; i++) {
        let selectedRarity = 'common';
        
        if (caseItem.rarity_weights) {
            const totalWeight = Object.values(caseItem.rarity_weights).reduce((a, b) => a + b, 0);
            let randomWeight = Math.random() * totalWeight;
            
            for (const [rarity, weight] of Object.entries(caseItem.rarity_weights)) {
                randomWeight -= weight;
                if (randomWeight <= 0) {
                    selectedRarity = rarity;
                    break;
                }
            }
        }
        
        const itemsList = rarityItems[selectedRarity] || rarityItems.common;
        const randomItem = {...itemsList[Math.floor(Math.random() * itemsList.length)]};
        items.push(randomItem);
    }
    
    return items;
}

// Открытие кейса
async function openCase() {
    if (!currentCase || isOpening) return;
    
    if (userData.balance < currentCase.price) {
        alert('❌ Недостаточно алмазов!');
        return;
    }
    
    isOpening = true;
    elements.openCaseBtn.disabled = true;
    elements.openCaseBtn.innerHTML = '⏳ Открывается...';
    
    try {
        // Отправляем запрос на открытие кейса
        const response = await sendToBot({
            action: 'open_case',
            case_id: currentCase.id
        });
        
        if (response.error) {
            throw new Error(response.error);
        }
        
        if (!response.success) {
            throw new Error('Не удалось открыть кейс');
        }
        
        // Обновляем данные
        userData.balance = response.new_balance;
        currentItem = response.item;
        
        // Добавляем предмет в инвентарь
        userData.inventory.unshift({
            ...response.item,
            obtained_at: new Date().toISOString()
        });
        
        // Запускаем анимацию рулетки
        await startRouletteAnimation(response.item);
        
        // Показываем результат
        setTimeout(() => {
            showResult(response.item);
            isOpening = false;
        }, 1500);
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        alert(`❌ Ошибка: ${error.message}`);
        
        // Восстанавливаем кнопку
        if (userData.balance >= currentCase.price) {
            elements.openCaseBtn.disabled = false;
            elements.openCaseBtn.innerHTML = `⛏️ Открыть за ${currentCase.price} 💎`;
        }
        isOpening = false;
    }
}

// Анимация рулетки
async function startRouletteAnimation(wonItem) {
    return new Promise((resolve) => {
        isRouletteActive = true;
        
        const rouletteContainer = elements.caseModal.querySelector('.roulette-container');
        const track = elements.itemsTrack;
        
        if (!rouletteContainer || !track) {
            resolve();
            return;
        }
        
        const containerWidth = rouletteContainer.clientWidth;
        const itemWidth = 110;
        const startPosition = (containerWidth / 2) - (itemWidth / 2);
        
        // Вычисляем финальную позицию (случайный предмет в середине)
        const itemCount = track.children.length;
        const randomIndex = Math.floor(Math.random() * (itemCount - 5)) + 2;
        const finalPosition = startPosition - (randomIndex * itemWidth);
        
        // Запускаем анимацию
        const duration = 3000;
        const startTime = Date.now();
        
        function animate() {
            if (!isRouletteActive) {
                resolve();
                return;
            }
            
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Плавное замедление в конце
            let easedProgress;
            if (progress < 0.8) {
                easedProgress = easeOutCubic(progress / 0.8) * 0.8;
            } else {
                easedProgress = 0.8 + easeInOutBack((progress - 0.8) / 0.2) * 0.2;
            }
            
            const currentPos = startPosition + (finalPosition - startPosition) * easedProgress;
            track.style.transform = `translateX(${currentPos}px)`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Подсвечиваем центральный предмет
                const centerX = containerWidth / 2;
                const items = track.children;
                
                for (let i = 0; i < items.length; i++) {
                    const itemRect = items[i].getBoundingClientRect();
                    const trackRect = track.getBoundingClientRect();
                    const itemCenter = itemRect.left - trackRect.left + itemWidth / 2;
                    
                    if (Math.abs(itemCenter - centerX) < itemWidth / 2) {
                        items[i].classList.add('highlighted');
                        break;
                    }
                }
                
                setTimeout(resolve, 500);
            }
        }
        
        track.style.transition = 'transform 0.1s linear';
        animate();
    });
}

// Показать результат
function showResult(item) {
    console.log('Показать результат:', item);
    
    elements.resultItemName.textContent = item.name;
    elements.resultItemRarity.textContent = getRarityText(item.rarity);
    elements.resultItemRarity.className = `item-rarity ${item.rarity}`;
    elements.resultItemPrice.textContent = item.price.toLocaleString();
    elements.resultItemIcon.textContent = item.icon;
    elements.newBalance.textContent = userData.balance.toLocaleString();
    
    // Скрываем модальное окно кейса и показываем результат
    hideModal(elements.caseModal);
    showModal(elements.resultModal);
    
    // Обновляем баланс в основном интерфейсе
    updateUI();
}

// Отрисовка инвентаря
function renderInventory() {
    console.log('Отрисовка инвентаря...');
    elements.inventoryGrid.innerHTML = '';
    
    if (!userData.inventory || userData.inventory.length === 0) {
        elements.inventoryGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <div style="font-size: 3rem; margin-bottom: 20px;">🎒</div>
                <p style="color: #888; font-size: 1.1rem;">Инвентарь пуст</p>
                <p style="color: #666; font-size: 0.9rem; margin-top: 10px;">
                    Откройте кейсы, чтобы получить предметы!
                </p>
            </div>
        `;
        return;
    }
    
    userData.inventory.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'inventory-item';
        itemElement.dataset.rarity = item.rarity;
        
        itemElement.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <h4>${item.name}</h4>
            <span class="item-rarity ${item.rarity}">${getRarityText(item.rarity)}</span>
            <p style="font-size: 0.8rem; color: gold; margin-top: 5px;">
                💎 ${item.price}
            </p>
        `;
        
        elements.inventoryGrid.appendChild(itemElement);
    });
}

// Открытие модального окна инвентаря
function openInventoryModal() {
    console.log('Открытие инвентаря');
    renderInventory();
    showModal(elements.inventoryModal);
}

// Создание превью предметов
function createCaseItemsPreview(caseItem) {
    const previewContainer = document.querySelector('.case-items-preview-modal');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
    const previewItems = getPreviewItems(caseItem);
    
    previewItems.forEach(item => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <div class="preview-item-icon">${item.icon}</div>
            <div class="preview-item-name">${item.name}</div>
        `;
        previewContainer.appendChild(previewItem);
    });
}

// Утилиты
function getRarityText(rarity) {
    const rarityMap = {
        'common': 'Обычный',
        'uncommon': 'Необычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return rarityMap[rarity] || rarity;
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function easeInOutBack(t) {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    
    return t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
}

// Управление модальными окнами
function showModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = 'flex';
        setTimeout(() => {
            elements.loadingOverlay.style.opacity = '1';
        }, 10);
    }
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            elements.loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// Инициализация обработчиков событий
function initEventListeners() {
    console.log('Настройка обработчиков событий...');
    
    if (elements.inventoryBtn) {
        elements.inventoryBtn.addEventListener('click', openInventoryModal);
    }
    
    if (elements.closeModal) {
        elements.closeModal.addEventListener('click', () => {
            if (isRouletteActive && confirm('Рулетка активна. Закрыть?')) {
                isRouletteActive = false;
                hideModal(elements.caseModal);
            } else if (!isRouletteActive) {
                hideModal(elements.caseModal);
            }
        });
    }
    
    if (elements.closeInventory) {
        elements.closeInventory.addEventListener('click', () => hideModal(elements.inventoryModal));
    }
    
    if (elements.closeResult) {
        elements.closeResult.addEventListener('click', () => hideModal(elements.resultModal));
    }
    
    if (elements.openCaseBtn) {
        elements.openCaseBtn.addEventListener('click', openCase);
    }
    
    // Закрытие по клику на overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (overlay === elements.caseModal && isRouletteActive) {
                    if (confirm('Рулетка активна. Закрыть?')) {
                        isRouletteActive = false;
                        hideModal(elements.caseModal);
                    }
                } else {
                    hideModal(overlay);
                }
            }
        });
    });
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен');
    
    // Инициализация
    initApp();
    initEventListeners();
    
    console.log('Приложение запущено');
});