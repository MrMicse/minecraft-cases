// Three.js инициализация
let caseScene, caseCamera, caseRenderer, caseControls;
let resultScene, resultCamera, resultRenderer, resultControls;
let caseModel, itemModel;
let mixer, clock;

// Инициализация 3D сцены для кейса
function initCaseScene() {
    const canvas = document.getElementById('case-canvas');
    
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
    
    // Эффекты
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
}

// Инициализация 3D сцены для результата
function initResultScene() {
    const canvas = document.getElementById('result-canvas');
    
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
    
    // Цветной свет в зависимости от редкости
    const rarityLights = {
        common: 0x4b69ff,
        uncommon: 0x8847ff,
        rare: 0xd32ce6,
        mythical: 0xeb4b4b,
        legendary: 0xd4af37
    };
    
    const pointLight = new THREE.PointLight(rarityLights.legendary, 3, 15);
    pointLight.position.set(0, 2, 5);
    resultScene.add(pointLight);
    
    // OrbitControls
    resultControls = new THREE.OrbitControls(resultCamera, resultRenderer.domElement);
    resultControls.enableDamping = true;
    resultControls.dampingFactor = 0.05;
    resultControls.autoRotate = true;
    resultControls.autoRotateSpeed = 2;
}

// Загрузка модели кейса
function loadCaseModel(modelUrl) {
    if (caseModel) {
        caseScene.remove(caseModel);
    }
    
    // Для демо создаем простую 3D модель кейса
    createCaseModel();
    
    // В реальном приложении загружаем GLTF модель:
    /*
    const loader = new THREE.GLTFLoader();
    loader.load(modelUrl, (gltf) => {
        caseModel = gltf.scene;
        caseModel.scale.set(1, 1, 1);
        caseModel.position.set(0, 0, 0);
        caseScene.add(caseModel);
        
        // Анимация
        if (gltf.animations && gltf.animations.length) {
            mixer = new THREE.AnimationMixer(caseModel);
            gltf.animations.forEach((clip) => {
                mixer.clipAction(clip).play();
            });
        }
    });
    */
}

// Создание простой модели кейса
function createCaseModel() {
    const group = new THREE.Group();
    
    // Основная часть кейса
    const geometry = new THREE.BoxGeometry(2, 1.5, 1);
    const material = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x000000,
        emissiveIntensity: 0.1
    });
    
    const caseMesh = new THREE.Mesh(geometry, material);
    group.add(caseMesh);
    
    // Украшения
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
        color: 0xd4af37,
        linewidth: 2
    });
    const edgesMesh = new THREE.LineSegments(edges, lineMaterial);
    group.add(edgesMesh);
    
    // Логотип
    const logoGeometry = new THREE.PlaneGeometry(0.8, 0.4);
    const logoMaterial = new THREE.MeshBasicMaterial({
        color: 0xd4af37,
        side: THREE.DoubleSide
    });
    const logo = new THREE.Mesh(logoGeometry, logoMaterial);
    logo.position.set(0, 0, 0.51);
    group.add(logo);
    
    caseModel = group;
    caseScene.add(caseModel);
    
    // Анимация вращения
    animateCase();
}

// Загрузка модели предмета
function loadItemModel(modelUrl) {
    if (itemModel) {
        resultScene.remove(itemModel);
    }
    
    // Для демо создаем простую 3D модель ножа
    createItemModel();
    
    // В реальном приложении загружаем GLTF модель
}

// Создание простой модели предмета
function createItemModel() {
    const group = new THREE.Group();
    
    // Простая модель ножа (базовая)
    const bladeGeometry = new THREE.BoxGeometry(2, 0.1, 0.3);
    const bladeMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x222222,
        emissiveIntensity: 0.2
    });
    
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.position.set(0, 0, 0);
    group.add(blade);
    
    // Рукоятка
    const handleGeometry = new THREE.BoxGeometry(0.8, 0.15, 0.4);
    const handleMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b4513,
        roughness: 0.8,
        metalness: 0.2
    });
    
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(-1.4, 0, 0);
    group.add(handle);
    
    itemModel = group;
    resultScene.add(itemModel);
    
    // Эффект свечения
    const pointLight = new THREE.PointLight(0xd4af37, 2, 10);
    pointLight.position.copy(itemModel.position);
    resultScene.add(pointLight);
    
    // Частицы
    createParticles();
    
    animateItem();
}

// Создание частиц для эффекта
function createParticles() {
    const particleCount = 100;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        // Позиции
        positions[i3] = (Math.random() - 0.5) * 5;
        positions[i3 + 1] = (Math.random() - 0.5) * 5;
        positions[i3 + 2] = (Math.random() - 0.5) * 5;
        
        // Цвета (золотой)
        colors[i3] = 0xd4 / 255;
        colors[i3 + 1] = 0xaf / 255;
        colors[i3 + 2] = 0x37 / 255;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    resultScene.add(particleSystem);
    
    // Анимация частиц
    function animateParticles() {
        const positions = particleSystem.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += 0.01;
            if (positions[i + 1] > 2.5) {
                positions[i + 1] = -2.5;
            }
        }
        
        particleSystem.geometry.attributes.position.needsUpdate = true;
        particleSystem.rotation.y += 0.001;
    }
    
    // Сохраняем функцию анимации
    particleSystem.userData.animate = animateParticles;
}

// Анимация кейса
function animateCase() {
    requestAnimationFrame(animateCase);
    
    const delta = clock.getDelta();
    
    if (mixer) {
        mixer.update(delta);
    }
    
    if (caseModel) {
        caseModel.rotation.y += 0.01;
    }
    
    caseControls.update();
    caseRenderer.render(caseScene, caseCamera);
}

// Анимация предмета
function animateItem() {
    requestAnimationFrame(animateItem);
    
    if (itemModel) {
        itemModel.rotation.y += 0.02;
        
        // Пульсация
        const scale = 1 + Math.sin(Date.now() * 0.002) * 0.1;
        itemModel.scale.setScalar(scale);
    }
    
    // Анимация частиц
    resultScene.children.forEach(child => {
        if (child.userData.animate) {
            child.userData.animate();
        }
    });
    
    resultControls.update();
    resultRenderer.render(resultScene, resultCamera);
}

// Инициализация 3D модели кейса в сетке
function initCaseModel(caseId, modelUrl) {
    const container = document.getElementById(`case-${caseId}`);
    if (!container) return;
    
    // Создаем простую 3D сцену для миниатюры
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    
    renderer.setSize(200, 200);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    camera.position.set(0, 0, 3);
    
    // Освещение
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    // Простая модель кейса для миниатюры
    const geometry = new THREE.BoxGeometry(1, 0.75, 0.5);
    const material = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.5,
        roughness: 0.5
    });
    
    const caseMesh = new THREE.Mesh(geometry, material);
    scene.add(caseMesh);
    
    // Анимация вращения
    function animate() {
        requestAnimationFrame(animate);
        caseMesh.rotation.y += 0.01;
        renderer.render(scene, camera);
    }
    
    animate();
}

// Обработка изменения размера окна
function onWindowResize() {
    if (caseCamera && caseRenderer) {
        const canvas = document.getElementById('case-canvas');
        caseCamera.aspect = canvas.clientWidth / canvas.clientHeight;
        caseCamera.updateProjectionMatrix();
        caseRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
    
    if (resultCamera && resultRenderer) {
        const canvas = document.getElementById('result-canvas');
        resultCamera.aspect = canvas.clientWidth / canvas.clientHeight;
        resultCamera.updateProjectionMatrix();
        resultRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
}

// Инициализация при загрузке
window.addEventListener('load', () => {
    initCaseScene();
    initResultScene();
    window.addEventListener('resize', onWindowResize);
});