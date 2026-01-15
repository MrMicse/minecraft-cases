// Three.js инициализация
let caseScene, caseCamera, caseRenderer, caseControls;
let resultScene, resultCamera, resultRenderer, resultControls;
let caseModel, itemModel;
let mixer, clock;
let isCaseSceneInitialized = false;
let isResultSceneInitialized = false;

// Инициализация 3D сцены для кейса
function initCaseScene() {
    if (isCaseSceneInitialized) return;
    
    const canvas = document.getElementById('case-canvas');
    if (!canvas) return;
    
    // Сцена
    caseScene = new THREE.Scene();
    caseScene.background = new THREE.Color(0x1a1a1a);
    
    // Камера
    caseCamera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );
    caseCamera.position.set(0, 0, 5);
    
    // Рендерер
    caseRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    caseRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    caseRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    caseScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    caseScene.add(directionalLight);
    
    // Эффект свечения
    const pointLight = new THREE.PointLight(0xd4af37, 2, 10);
    pointLight.position.set(0, 0, 3);
    caseScene.add(pointLight);
    
    // OrbitControls для вращения
    caseControls = new THREE.OrbitControls(caseCamera, caseRenderer.domElement);
    caseControls.enableDamping = true;
    caseControls.dampingFactor = 0.05;
    caseControls.autoRotate = true;
    caseControls.autoRotateSpeed = 1;
    
    clock = new THREE.Clock();
    isCaseSceneInitialized = true;
    
    console.log('Case scene initialized');
}

// Инициализация 3D сцены для результата
function initResultScene() {
    if (isResultSceneInitialized) return;
    
    const canvas = document.getElementById('result-canvas');
    if (!canvas) return;
    
    // Сцена
    resultScene = new THREE.Scene();
    resultScene.background = new THREE.Color(0x242424);
    
    // Камера
    resultCamera = new THREE.PerspectiveCamera(
        45,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );
    resultCamera.position.set(0, 0, 4);
    
    // Рендерер
    resultRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    resultRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    resultRenderer.setPixelRatio(window.devicePixelRatio);
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    resultScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(3, 3, 3);
    resultScene.add(directionalLight);
    
    isResultSceneInitialized = true;
    console.log('Result scene initialized');
}

// Создание простой модели кейса для модального окна
function createCaseModel() {
    if (!caseScene) return;
    
    // Очищаем предыдущую модель
    if (caseModel) {
        caseScene.remove(caseModel);
    }
    
    const group = new THREE.Group();
    
    // Основная часть кейса (сундук)
    const caseGeometry = new THREE.BoxGeometry(2, 1.5, 1);
    const caseMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x111111,
        emissiveIntensity: 0.2
    });
    
    const caseMesh = new THREE.Mesh(caseGeometry, caseMaterial);
    group.add(caseMesh);
    
    // Золотые края
    const edgesGeometry = new THREE.EdgesGeometry(caseGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ 
        color: 0xd4af37,
        linewidth: 2
    });
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    group.add(edges);
    
    // Замок на кейсе
    const lockGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16);
    const lockMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 1,
        roughness: 0.1
    });
    const lock = new THREE.Mesh(lockGeometry, lockMaterial);
    lock.position.set(0, 0.5, 0.51);
    group.add(lock);
    
    // Декоративные полосы
    const stripeGeometry = new THREE.BoxGeometry(1.8, 0.05, 0.02);
    const stripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.1
    });
    
    for (let i = -1; i <= 1; i += 2) {
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.set(0, i * 0.4, 0.51);
        group.add(stripe);
    }
    
    // Логотип CS
    const logoGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const logoMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xd4af37,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
    });
    const logo = new THREE.Mesh(logoGeometry, logoMaterial);
    logo.position.set(0, -0.2, 0.51);
    logo.rotation.x = Math.PI / 2;
    group.add(logo);
    
    caseModel = group;
    caseScene.add(caseModel);
    
    // Анимация парящего эффекта
    animateCase();
    
    console.log('Case model created');
}

// Создание простой модели предмета (ножа)
function createItemModel(rarity = 'legendary') {
    if (!resultScene) return;
    
    // Очищаем предыдущую модель
    if (itemModel) {
        resultScene.remove(itemModel);
        // Также удаляем все частицы
        resultScene.children.forEach(child => {
            if (child.type === 'Points') {
                resultScene.remove(child);
            }
        });
    }
    
    const group = new THREE.Group();
    
    // Цвет в зависимости от редкости
    const rarityColors = {
        'common': 0x4b69ff,
        'uncommon': 0x8847ff,
        'rare': 0xd32ce6,
        'mythical': 0xeb4b4b,
        'legendary': 0xd4af37
    };
    
    const bladeColor = rarityColors[rarity] || 0xd4af37;
    
    // Лезвие ножа (более детализированное)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-1, 0);
    bladeShape.lineTo(1, 0.2);
    bladeShape.lineTo(1, -0.2);
    bladeShape.lineTo(-1, 0);
    
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 3
    });
    
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: bladeColor,
        metalness: 0.95,
        roughness: 0.05,
        emissive: bladeColor,
        emissiveIntensity: 0.1
    });
    
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.x = Math.PI / 2;
    group.add(blade);
    
    // Рукоятка ножа
    const handleGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.3);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(-1.3, 0, 0);
    group.add(handle);
    
    // Детали на рукоятке
    const handleDetailGeometry = new THREE.BoxGeometry(0.05, 0.25, 0.35);
    const handleDetailMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.1
    });
    
    for (let i = -1; i <= 1; i += 2) {
        const detail = new THREE.Mesh(handleDetailGeometry, handleDetailMaterial);
        detail.position.set(-1.3 + i * 0.15, 0, 0);
        group.add(detail);
    }
    
    // Острие ножа
    const tipGeometry = new THREE.ConeGeometry(0.05, 0.3, 8);
    const tipMaterial = new THREE.MeshStandardMaterial({
        color: bladeColor,
        metalness: 0.95,
        roughness: 0.05
    });
    
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.position.set(1.15, 0, 0);
    tip.rotation.z = Math.PI / 2;
    group.add(tip);
    
    itemModel = group;
    resultScene.add(itemModel);
    
    // Добавляем свет соответствующего цвета
    const pointLight = new THREE.PointLight(bladeColor, 3, 15);
    pointLight.position.set(0, 2, 5);
    resultScene.add(pointLight);
    
    // OrbitControls для вращения предмета
    if (!resultControls && resultRenderer) {
        resultControls = new THREE.OrbitControls(resultCamera, resultRenderer.domElement);
        resultControls.enableDamping = true;
        resultControls.dampingFactor = 0.05;
        resultControls.autoRotate = true;
        resultControls.autoRotateSpeed = 2;
        resultControls.enableZoom = false;
        resultControls.enablePan = false;
    }
    
    // Создаем частицы
    createParticles(bladeColor);
    
    // Запускаем анимацию
    animateItem();
    
    console.log('Item model created with rarity:', rarity);
}

// Создание частиц для эффекта
function createParticles(color = 0xd4af37) {
    const particleCount = 200;
    const particles = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const colorRGB = new THREE.Color(color);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Позиции в сфере вокруг центра
        const radius = 2 + Math.random() * 3;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.cos(phi);
        positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        
        // Цвета с вариациями
        colors[i3] = colorRGB.r * (0.7 + Math.random() * 0.3);
        colors[i3 + 1] = colorRGB.g * (0.7 + Math.random() * 0.3);
        colors[i3 + 2] = colorRGB.b * (0.7 + Math.random() * 0.3);
        
        // Размеры
        sizes[i] = 0.1 + Math.random() * 0.2;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particles.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    resultScene.add(particleSystem);
    
    // Сохраняем ссылку на систему частиц для анимации
    particleSystem.userData.speed = 0.01 + Math.random() * 0.02;
    particleSystem.userData.rotationSpeed = 0.001 + Math.random() * 0.002;
    
    return particleSystem;
}

// Анимация кейса
function animateCase() {
    if (!caseScene || !caseRenderer || !caseCamera) return;
    
    requestAnimationFrame(animateCase);
    
    const delta = clock ? clock.getDelta() : 0.016;
    
    if (caseModel) {
        // Плавное вращение
        caseModel.rotation.y += 0.01;
        
        // Легкое парение вверх-вниз
        caseModel.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    }
    
    if (caseControls) {
        caseControls.update();
    }
    
    if (caseRenderer && caseScene && caseCamera) {
        caseRenderer.render(caseScene, caseCamera);
    }
}

// Анимация предмета
function animateItem() {
    if (!resultScene || !resultRenderer || !resultCamera) return;
    
    requestAnimationFrame(animateItem);
    
    if (itemModel) {
        // Вращение предмета
        itemModel.rotation.y += 0.02;
        
        // Пульсация масштаба
        const pulse = 1 + Math.sin(Date.now() * 0.002) * 0.05;
        itemModel.scale.setScalar(pulse);
    }
    
    // Анимация частиц
    resultScene.children.forEach(child => {
        if (child.type === 'Points' && child.geometry) {
            const positions = child.geometry.attributes.position.array;
            const time = Date.now() * 0.001;
            
            for (let i = 0; i < positions.length; i += 3) {
                // Медленное движение частиц по спирали
                const particleIndex = i / 3;
                const angle = time * child.userData.speed + particleIndex * 0.1;
                const radius = 2 + Math.sin(time * 0.5 + particleIndex) * 0.5;
                
                positions[i] = Math.cos(angle) * radius;
                positions[i + 2] = Math.sin(angle) * radius;
                positions[i + 1] = Math.cos(time * 0.3 + particleIndex) * 0.5;
            }
            
            child.geometry.attributes.position.needsUpdate = true;
            child.rotation.y += child.userData.rotationSpeed || 0.001;
        }
    });
    
    if (resultControls) {
        resultControls.update();
    }
    
    if (resultRenderer && resultScene && resultCamera) {
        resultRenderer.render(resultScene, resultCamera);
    }
}

// Загрузка модели кейса (используется при открытии модального окна)
function loadCaseModel() {
    if (!isCaseSceneInitialized) {
        initCaseScene();
    }
    createCaseModel();
}

// Загрузка модели предмета (используется при показе результата)
function loadItemModel(rarity = 'legendary') {
    if (!isResultSceneInitialized) {
        initResultScene();
    }
    createItemModel(rarity);
}

// Инициализация 3D модели кейса в сетке (для миниатюр)
function initCaseModel(caseId, modelUrl) {
    const container = document.getElementById(`case-${caseId}`);
    if (!container) {
        console.log('Container not found for case:', caseId);
        return;
    }
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Создаем canvas
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    
    // Инициализация Three.js для миниатюры
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 3);
    
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true
    });
    renderer.setSize(200, 200);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(3, 3, 3);
    scene.add(directionalLight);
    
    // Создаем упрощенную модель кейса для миниатюры
    const group = new THREE.Group();
    
    // Основной корпус
    const geometry = new THREE.BoxGeometry(1.5, 1, 0.7);
    const material = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.6,
        roughness: 0.4
    });
    
    const caseMesh = new THREE.Mesh(geometry, material);
    group.add(caseMesh);
    
    // Золотые детали
    const detailGeometry = new THREE.BoxGeometry(1.6, 0.05, 0.75);
    const detailMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.1
    });
    
    const topDetail = new THREE.Mesh(detailGeometry, detailMaterial);
    topDetail.position.y = 0.525;
    group.add(topDetail);
    
    const bottomDetail = new THREE.Mesh(detailGeometry, detailMaterial);
    bottomDetail.position.y = -0.525;
    group.add(bottomDetail);
    
    scene.add(group);
    
    // Анимация вращения
    function animate() {
        requestAnimationFrame(animate);
        
        // Медленное вращение
        group.rotation.y += 0.01;
        
        // Легкое покачивание
        group.rotation.x = Math.sin(Date.now() * 0.001) * 0.05;
        group.rotation.z = Math.cos(Date.now() * 0.001) * 0.05;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    console.log('Case thumbnail created for case:', caseId);
}

// Обработка изменения размера окна
function onWindowResize() {
    if (caseCamera && caseRenderer) {
        const canvas = document.getElementById('case-canvas');
        if (canvas) {
            caseCamera.aspect = canvas.clientWidth / canvas.clientHeight;
            caseCamera.updateProjectionMatrix();
            caseRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        }
    }
    
    if (resultCamera && resultRenderer) {
        const canvas = document.getElementById('result-canvas');
        if (canvas) {
            resultCamera.aspect = canvas.clientWidth / canvas.clientHeight;
            resultCamera.updateProjectionMatrix();
            resultRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        }
    }
}

// Экспорт функций для использования в script.js
window.THREE_APP = {
    loadCaseModel: loadCaseModel,
    loadItemModel: loadItemModel,
    initCaseModel: initCaseModel,
    onWindowResize: onWindowResize
};

// Инициализация при загрузке
window.addEventListener('load', () => {
    console.log('3D App loaded');
    window.addEventListener('resize', onWindowResize);
});

// Инициализация по требованию
window.init3DScenes = function() {
    initCaseScene();
    initResultScene();
    console.log('3D scenes initialized on demand');
};