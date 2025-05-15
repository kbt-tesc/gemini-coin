import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as RAPIER from '@dimforge/rapier3d-compat';

// グローバル変数
let world, physicsWorld;
let scene, camera, renderer, controls;
let base, walls = {}, coins = [];
let coinCount = 0, coinLimit = 0;
let coinMass = 4, coinFriction = 0.9, coinRestitution = 0.0;
let tiltAngle = 0;
let isMouseDown = false;
let lastCoinTime = 0;
const coinInterval = 50; // 50msごとにコインを生成
const baseSize = { width: 0.2, height: 0.03, depth: 0.2 }; // 20cm x 3cm x 20cm
const wallHeight = 0.05; // 5cm
const coinTypes = [
    { diameter: 0.0200, thickness: 0.0015, mass: 0.001, material: 'aluminum' },
    { diameter: 0.0220, thickness: 0.0015, mass: 0.00375, material: 'brass' },
    { diameter: 0.0235, thickness: 0.0015, mass: 0.0045, material: 'copper' },
    { diameter: 0.0210, thickness: 0.0017, mass: 0.004, material: 'silver' },
    { diameter: 0.0226, thickness: 0.0017, mass: 0.0048, material: 'silver' },
    { diameter: 0.0265, thickness: 0.0018, mass: 0.007, material: 'silver' }
];

// 初期化
async function init() {
    await RAPIER.init();
    physicsWorld = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    // 物理演算の精度を向上させるためにタイムステップを小さく設定
    physicsWorld.maxTimestep = 1.0 / 240.0; // 240Hzで更新して精度を向上
    // 眠り機能を調整して、動きが小さい物体を早く停止させる
    physicsWorld.integrationParameters.linearSleepThreshold = 0.001;
    physicsWorld.integrationParameters.angularSleepThreshold = 0.001;
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    // メニュー領域の高さを考慮してレンダラーのサイズを設定
    const header = document.querySelector('.mdl-layout__header');
    const headerHeight = header ? header.offsetHeight : 120;
    renderer.setSize(window.innerWidth, window.innerHeight - headerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 影の品質を向上
    document.getElementById('three-canvas-container').appendChild(renderer.domElement);
    
    // カメラ位置
    camera.position.set(0.3, 0.3, 0.3);
    camera.lookAt(0, 0, 0);
    
    // ライト
    const ambientLight = new THREE.AmbientLight(0xCCCCCC); // 環境光を明るく
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // 指向性ライトを明るく
    directionalLight.position.set(0, 1, 0);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);
    
    // 土台と壁の作成
    createBase();
    createWalls();
    
    // コントロール
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0.1;
    controls.maxDistance = 1;
    controls.maxPolarAngle = Math.PI / 2;
    
    // イベントリスナー
    window.addEventListener('resize', onWindowResize, false);
    renderer.domElement.addEventListener('mousedown', onMouseDown, false);
    renderer.domElement.addEventListener('mouseup', onMouseUp, false);
    renderer.domElement.addEventListener('mouseleave', onMouseUp, false);
    setupUI();
    
    animate();
}

// 土台の作成
function createBase() {
    const geometry = new THREE.BoxGeometry(baseSize.width, baseSize.height, baseSize.depth);
    const material = new THREE.MeshPhongMaterial({ color: 0x00aa00 }); // 緑色、影をサポート
    base = new THREE.Mesh(geometry, material);
    base.position.y = 0;
    base.receiveShadow = true;
    scene.add(base);
    
    const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(0, 0, 0);
    const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(baseSize.width / 2, baseSize.height / 2, baseSize.depth / 2)
        .setContactSkin(0.001); // 衝突マージンを追加して貫通を防ぐ
    physicsWorld.createCollider(colliderDesc, rigidBody);
    base.userData.physicsBody = rigidBody;
}

// 壁の作成
function createWalls() {
    const wallThickness = 0.01;
    const wallData = [
        { name: 'front', size: [baseSize.width, wallHeight, wallThickness], pos: [0, wallHeight / 2, -baseSize.depth / 2 - wallThickness / 2] },
        { name: 'back', size: [baseSize.width, wallHeight, wallThickness], pos: [0, wallHeight / 2, baseSize.depth / 2 + wallThickness / 2] },
        { name: 'left', size: [wallThickness, wallHeight, baseSize.depth], pos: [-baseSize.width / 2 - wallThickness / 2, wallHeight / 2, 0] },
        { name: 'right', size: [wallThickness, wallHeight, baseSize.depth], pos: [baseSize.width / 2 + wallThickness / 2, wallHeight / 2, 0] }
    ];
    
    wallData.forEach(data => {
        const geometry = new THREE.BoxGeometry(...data.size);
        const material = new THREE.MeshPhongMaterial({ color: 0x808080 }); // 灰色、影をサポート
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(...data.pos);
        wall.receiveShadow = true;
        scene.add(wall);
        
        const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(...data.pos);
        const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(data.size[0] / 2, data.size[1] / 2, data.size[2] / 2)
        .setContactSkin(0.001); // 衝突マージンを追加して貫通を防ぐ
    physicsWorld.createCollider(colliderDesc, rigidBody);
        wall.userData.physicsBody = rigidBody;
        walls[data.name] = wall;
    });
}

// コインの作成
function createCoin() {
    if (coinLimit > 0 && coinCount >= coinLimit) return;
    
    const coinType = coinTypes[Math.floor(Math.random() * coinTypes.length)];
    const radius = coinType.diameter / 2;
    const geometry = new THREE.CylinderGeometry(radius, radius, coinType.thickness, 32);
    const material = new THREE.MeshPhongMaterial({ color: getCoinColor(coinType.material), shininess: 60 });
    const coin = new THREE.Mesh(geometry, material);
    
    const x = (Math.random() - 0.5) * baseSize.width * 0.8;
    const z = (Math.random() - 0.5) * baseSize.depth * 0.8;
    const y = 0.15; // 上15cmから落下
    coin.position.set(x, y, z);
    coin.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 18; // 0~10度の傾き
    coin.rotation.z = Math.random() * Math.PI * 2;
    coin.castShadow = true;
    coin.receiveShadow = true;
    scene.add(coin);
    
    const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setAngularDamping(0.99)
        .setLinearDamping(0.95);
    const rigidBody = physicsWorld.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(coinType.thickness / 2, radius)
        .setFriction(coinFriction)
        .setRestitution(coinRestitution)
        .setMass(coinType.mass)
        .setContactSkin(0.002); // 衝突マージンを増やして貫通を防ぐ
    physicsWorld.createCollider(colliderDesc, rigidBody);
    coin.userData.physicsBody = rigidBody;
    coins.push(coin);
    coinCount++;
    document.getElementById('coin-count').textContent = coinCount;
}

// コインの色を取得
function getCoinColor(material) {
    switch (material) {
        case 'aluminum': return 0xC0C0C0;
        case 'brass': return 0xDAA520;
        case 'copper': return 0xB87333;
        case 'silver': return 0xC0C0C0;
        default: return 0xC0C0C0;
    }
}

// ウィンドウリサイズイベント
function onWindowResize() {
    const header = document.querySelector('.mdl-layout__header');
    const headerHeight = header ? header.offsetHeight : 120;
    camera.aspect = window.innerWidth / (window.innerHeight - headerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight - headerHeight);
}

// マウスイベント
function onMouseDown() {
    isMouseDown = true;
}

function onMouseUp() {
    isMouseDown = false;
}

// UIセットアップ
function setupUI() {
    document.getElementById('reset-coins').addEventListener('click', resetCoins);
    document.getElementById('reset-params').addEventListener('click', resetParams);
    document.getElementById('toggle-walls').addEventListener('click', toggleWalls);
    document.getElementById('toggle-wall-front').addEventListener('click', () => toggleWall('front'));
    document.getElementById('toggle-wall-back').addEventListener('click', () => toggleWall('back'));
    document.getElementById('toggle-wall-left').addEventListener('click', () => toggleWall('left'));
    document.getElementById('toggle-wall-right').addEventListener('click', () => toggleWall('right'));
    document.getElementById('tilt-stepper').addEventListener('change', updateTilt);
    document.getElementById('coin-limit').addEventListener('change', updateCoinLimit);
    setupSlider('coin-mass', updateCoinMass);
    setupSlider('coin-friction', updateCoinFriction);
    setupSlider('coin-restitution', updateCoinRestitution);
}

// スライダーのセットアップ
function setupSlider(id, callback) {
    const slider = document.getElementById(id);
    const input = document.getElementById(`${id}-input`);
    slider.addEventListener('input', () => {
        input.value = slider.value;
        callback(slider.value);
    });
    input.addEventListener('input', () => {
        slider.value = input.value;
        callback(input.value);
    });
}

// UIコールバック関数
function resetCoins() {
    coins.forEach(coin => {
        physicsWorld.removeRigidBody(coin.userData.physicsBody);
        scene.remove(coin);
    });
    coins = [];
    coinCount = 0;
    document.getElementById('coin-count').textContent = coinCount;
}

function resetParams() {
    coinMass = 4;
    coinFriction = 0.35;
    coinRestitution = 0.3;
    document.getElementById('coin-mass').value = 4;
    document.getElementById('coin-mass-input').value = 4;
    document.getElementById('coin-friction').value = 0.35;
    document.getElementById('coin-friction-input').value = 0.35;
    document.getElementById('coin-restitution').value = 0.3;
    document.getElementById('coin-restitution-input').value = 0.3;
}

function toggleWalls() {
    const visible = !walls['front'].visible;
    Object.values(walls).forEach(wall => {
        wall.visible = visible;
        wall.userData.physicsBody.setEnabled(visible);
    });
}

function toggleWall(name) {
    walls[name].visible = !walls[name].visible;
    walls[name].userData.physicsBody.setEnabled(walls[name].visible);
}

function updateTilt() {
    tiltAngle = parseFloat(document.getElementById('tilt-stepper').value) * Math.PI / 180;
    base.rotation.x = tiltAngle;
    // クォータニオンを使用して正しい回転を適用
    const cosHalfAngle = Math.cos(tiltAngle / 2);
    const sinHalfAngle = Math.sin(tiltAngle / 2);
    base.userData.physicsBody.setRotation({ x: sinHalfAngle, y: 0, z: 0, w: cosHalfAngle });
}

function updateCoinLimit() {
    coinLimit = parseInt(document.getElementById('coin-limit').value) || 0;
}

function updateCoinMass(value) {
    coinMass = parseFloat(value);
}

function updateCoinFriction(value) {
    coinFriction = parseFloat(value);
}

function updateCoinRestitution(value) {
    coinRestitution = parseFloat(value);
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    physicsWorld.step();
    
    // コインの生成
    if (isMouseDown && (Date.now() - lastCoinTime) > coinInterval) {
        createCoin();
        lastCoinTime = Date.now();
    }
    
    // コインの更新と削除
    coins = coins.filter(coin => {
        const pos = coin.userData.physicsBody.translation();
        if (pos.y < -1) { // 画面外に落ちた場合
            physicsWorld.removeRigidBody(coin.userData.physicsBody);
            scene.remove(coin);
            coinCount--;
            document.getElementById('coin-count').textContent = coinCount;
            return false;
        }
        coin.position.set(pos.x, pos.y, pos.z);
        const rot = coin.userData.physicsBody.rotation();
        coin.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        return true;
    });
    
    controls.update();
    renderer.render(scene, camera);
}

// 初期化実行
init();
