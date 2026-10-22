import * as THREE from "three";
import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function bootstrapTryOn() {
const $ = (selector) => document.querySelector(selector);
const cameraStage = $("#cameraStage");
const video = $("#camera");
const photo = $("#photoSource");
const emptyState = $("#emptyState");
const startButton = $("#startButton");
const photoInput = $("#photoInput");
const stageStatus = $("#stageStatus");
const statusText = $("#statusText");
const alignmentGuide = $("#alignmentGuide");
const flipButton = $("#flipButton");
const debugButton = $("#debugButton");
const debugCanvas = $("#debugLayer");
const debugContext = debugCanvas.getContext("2d");

const state = {
  faceLandmarker: null,
  stream: null,
  running: false,
  loading: false,
  mode: "idle",
  facingMode: "user",
  selectedModel: "contour",
  selectedColor: "#c7aa83",
  selectedEar: "auto",
  diagnostics: false,
  lastVideoTime: -1,
  lastFrameAt: performance.now(),
  fps: 0,
  hasFace: false,
  smoothed: null,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  $("#threeLayer").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Normalized screen space: x grows right, y grows up. MediaPipe's y grows
  // down, so applyTracking converts it with `1 - y` exactly once.
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  camera.position.z = 4;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x52675c, 2.15));
  const key = new THREE.DirectionalLight(0xfff8eb, 3.3);
  key.position.set(-2, 3, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb8d6ff, 1.25);
  rim.position.set(3, 0.5, 2);
  scene.add(rim);

  return { renderer, scene, camera };
}

const webgl = createRenderer();

const caseMaterial = new THREE.MeshPhysicalMaterial({
  color: state.selectedColor,
  roughness: 0.24,
  metalness: 0.04,
  clearcoat: 0.72,
  clearcoatRoughness: 0.2,
});
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x272b29, roughness: 0.33, metalness: 0.16 });
const tubeMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf1dbbc,
  transparent: true,
  opacity: 0.78,
  roughness: 0.25,
  transmission: 0.17,
});
const receiverMaterial = new THREE.MeshStandardMaterial({ color: 0x5b5149, roughness: 0.48 });

function addMesh(group, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.renderOrder = 1;
  group.add(mesh);
  return mesh;
}

function makeTube(points, radius, material = tubeMaterial) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 30, radius, 9, false), material);
}

function createContour() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CapsuleGeometry(0.18, 0.47, 8, 20), caseMaterial, [-0.12, 0.22, 0], [0, 0, -0.17], [0.94, 1, 0.62]);
  addMesh(group, new THREE.TorusGeometry(0.105, 0.018, 8, 32, Math.PI * 1.15), trimMaterial, [-0.11, 0.22, 0.12], [0, 0, -0.25]);
  const hook = makeTube([[0, 0.58, 0], [0.18, 0.62, 0.015], [0.28, 0.48, 0.02], [0.29, 0.27, 0.01]], 0.035);
  group.add(hook);
  const soundTube = makeTube([[0.29, 0.29, 0.01], [0.36, 0.05, 0.015], [0.25, -0.21, 0.02], [0.11, -0.34, 0.03]], 0.018);
  group.add(soundTube);
  addMesh(group, new THREE.CapsuleGeometry(0.052, 0.12, 5, 12), receiverMaterial, [0.08, -0.4, 0.035], [0, 0, 1.05], [1, 1, .74]);
  addMesh(group, new THREE.SphereGeometry(0.028, 14, 10), trimMaterial, [-0.13, 0.45, 0.12], [0, 0, 0], [1.35, .7, .45]);
  return group;
}

function createSilk() {
  const group = new THREE.Group();
  addMesh(group, new THREE.CapsuleGeometry(0.125, 0.41, 8, 20), caseMaterial, [-0.11, 0.28, 0], [0, 0, -0.13], [0.9, 1, 0.55]);
  addMesh(group, new THREE.CapsuleGeometry(0.026, 0.13, 5, 10), trimMaterial, [-0.105, 0.34, 0.083], [0, 0, -0.1], [1, 1, .45]);
  const wire = makeTube([[0, 0.49, 0], [0.2, 0.5, 0], [0.32, 0.29, .01], [0.31, 0.02, .015], [0.18, -0.25, .02]], 0.012);
  group.add(wire);
  addMesh(group, new THREE.CapsuleGeometry(0.045, 0.11, 5, 12), receiverMaterial, [0.13, -0.33, 0.025], [0, 0, .92], [1, 1, .7]);
  addMesh(group, new THREE.SphereGeometry(0.048, 16, 10), new THREE.MeshStandardMaterial({ color: 0x4f4c48, roughness: .63 }), [0.05, -0.38, 0.02], [0, 0, 0], [1.25, .72, .72]);
  return group;
}

function createInside() {
  const group = new THREE.Group();
  addMesh(group, new THREE.SphereGeometry(0.28, 32, 20), caseMaterial, [0.07, -0.02, 0], [0.15, -0.2, -0.25], [0.78, 1.05, .48]);
  addMesh(group, new THREE.SphereGeometry(0.08, 18, 12), trimMaterial, [0.18, -0.04, 0.115], [0, 0, 0], [1, .55, .28]);
  addMesh(group, new THREE.TorusGeometry(0.035, 0.008, 7, 20), receiverMaterial, [-0.01, 0.07, 0.12], [0, 0, 0]);
  const pull = makeTube([[0.22, -0.08, 0], [0.34, -0.16, .01], [0.38, -0.28, .02]], 0.009, trimMaterial);
  group.add(pull);
  return group;
}

const tryOnRoot = new THREE.Group();
tryOnRoot.visible = false;
webgl.scene.add(tryOnRoot);

const modelGroups = {
  contour: createContour(),
  silk: createSilk(),
  inside: createInside(),
};
Object.values(modelGroups).forEach((model) => tryOnRoot.add(model));

const occluder = new THREE.Mesh(
  new THREE.CircleGeometry(1, 48),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true, side: THREE.DoubleSide }),
);
occluder.renderOrder = 0;
occluder.position.z = 0.26;
webgl.scene.add(occluder);
occluder.visible = false;

function updateModelVisibility() {
  Object.entries(modelGroups).forEach(([name, group]) => { group.visible = name === state.selectedModel; });
}
updateModelVisibility();

function resizeRenderer() {
  const rect = cameraStage.getBoundingClientRect();
  webgl.renderer.setSize(rect.width, rect.height, false);
  debugCanvas.width = Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2));
  debugCanvas.height = Math.round(rect.height * Math.min(window.devicePixelRatio || 1, 2));
  debugCanvas.style.width = `${rect.width}px`;
  debugCanvas.style.height = `${rect.height}px`;
  debugContext.setTransform(debugCanvas.width / rect.width, 0, 0, debugCanvas.height / rect.height, 0, 0);
}
new ResizeObserver(resizeRenderer).observe(cameraStage);
resizeRenderer();

async function ensureLandmarker(runningMode = "VIDEO") {
  if (state.faceLandmarker) {
    await state.faceLandmarker.setOptions({ runningMode });
    return state.faceLandmarker;
  }
  statusText.textContent = "Загружаем трекинг…";
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  state.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
    runningMode,
    numFaces: 1,
    minFaceDetectionConfidence: 0.55,
    minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.5,
    outputFacialTransformationMatrixes: true,
  });
  return state.faceLandmarker;
}

function setStatus(message, tracking = false) {
  statusText.textContent = message;
  stageStatus.classList.toggle("tracking", tracking);
}

function showExperience(mode) {
  state.mode = mode;
  emptyState.classList.add("hidden");
  stageStatus.hidden = false;
  alignmentGuide.hidden = false;
  flipButton.hidden = mode !== "video";
  cameraStage.classList.toggle("photo-mode", mode === "photo");
  video.style.display = mode === "video" ? "block" : "none";
  photo.style.display = mode === "photo" ? "block" : "none";
  $("#threeLayer").style.transform = mode === "video" ? "scaleX(-1)" : "none";
  debugCanvas.style.transform = mode === "video" ? "scaleX(-1)" : "none";
}

async function startCamera(forceFacingMode) {
  if (state.loading) return;
  state.loading = true;
  startButton.disabled = true;
  showExperience("video");
  setStatus("Запрашиваем камеру…");
  try {
    stopCamera();
    if (forceFacingMode) state.facingMode = forceFacingMode;
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 960 },
        frameRate: { ideal: 30, max: 60 },
      },
    });
    video.srcObject = state.stream;
    await video.play();
    await ensureLandmarker("VIDEO");
    state.running = true;
    state.lastVideoTime = -1;
    setStatus("Ищем лицо…");
    requestAnimationFrame(trackVideoFrame);
  } catch (error) {
    console.error(error);
    state.running = false;
    showCameraError(error);
  } finally {
    state.loading = false;
    startButton.disabled = false;
  }
}

function stopCamera() {
  state.running = false;
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

function showCameraError(error) {
  emptyState.classList.remove("hidden");
  stageStatus.hidden = true;
  alignmentGuide.hidden = true;
  flipButton.hidden = true;
  tryOnRoot.visible = false;
  occluder.visible = false;
  const denied = error?.name === "NotAllowedError";
  emptyState.querySelector("h2").textContent = denied ? "Нужен доступ к камере" : "Камера недоступна";
  emptyState.querySelector("p").innerHTML = denied
    ? "Разрешите доступ в настройках браузера<br />или загрузите фотографию."
    : "Попробуйте другую камеру<br />или загрузите фотографию.";
  startButton.textContent = "Попробовать снова";
}

function getCoverMapper() {
  const containerWidth = Math.max(cameraStage.clientWidth, 1);
  const containerHeight = Math.max(cameraStage.clientHeight, 1);
  const sourceWidth = state.mode === "photo" ? photo.naturalWidth : video.videoWidth;
  const sourceHeight = state.mode === "photo" ? photo.naturalHeight : video.videoHeight;
  if (!sourceWidth || !sourceHeight) return (point) => point;

  // The video/photo uses object-fit: cover. MediaPipe reports coordinates in
  // the uncropped source frame, while Three.js draws in the visible container.
  const scale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  return (point) => ({
    x: (point.x * renderedWidth + offsetX) / containerWidth,
    y: (point.y * renderedHeight + offsetY) / containerHeight,
    z: point.z * renderedWidth / containerWidth,
  });
}

function weightedPoint(points, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return {
    x: points.reduce((sum, point, index) => sum + point.x * weights[index], 0) / total,
    y: points.reduce((sum, point, index) => sum + point.y * weights[index], 0) / total,
    z: points.reduce((sum, point, index) => sum + (point.z || 0) * weights[index], 0) / total,
  };
}

function resolveTracking(landmarks, mapPoint) {
  // A single face-outline landmark moves several pixels with expression and
  // yaw. Blend temple, cheek and jaw landmarks into a much steadier ear proxy.
  const leftUpper = mapPoint(landmarks[127]);
  const leftMiddle = mapPoint(landmarks[234]);
  const leftLower = mapPoint(landmarks[93]);
  const rightUpper = mapPoint(landmarks[356]);
  const rightMiddle = mapPoint(landmarks[454]);
  const rightLower = mapPoint(landmarks[323]);
  const leftEdge = weightedPoint([leftUpper, leftMiddle, leftLower], [0.34, 0.46, 0.2]);
  const rightEdge = weightedPoint([rightUpper, rightMiddle, rightLower], [0.34, 0.46, 0.2]);
  const leftEye = mapPoint(landmarks[33]);
  const rightEye = mapPoint(landmarks[263]);
  const nose = mapPoint(landmarks[1]);
  const chin = mapPoint(landmarks[152]);
  const forehead = mapPoint(landmarks[10]);
  if (!leftEdge || !rightEdge || !nose) return null;

  const faceWidth = distance(leftEdge, rightEdge);
  const faceHeight = distance(forehead, chin);
  const leftSpan = Math.abs(nose.x - leftEdge.x);
  const rightSpan = Math.abs(rightEdge.x - nose.x);
  const rawYaw = (leftSpan - rightSpan) / Math.max(leftSpan + rightSpan, 0.001);
  const yaw = clamp(rawYaw * 1.7, -0.9, 0.9);
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  let ear = state.selectedEar;
  if (ear === "auto") {
    // Hysteresis prevents rapid left/right switching when looking forward.
    const current = state.smoothed?.ear;
    if (current === "left" && yaw < 0.16) ear = "left";
    else if (current === "right" && yaw > -0.16) ear = "right";
    else if (yaw > 0.1) ear = "right";
    else if (yaw < -0.1) ear = "left";
    else ear = current || "right";
  }
  const edge = ear === "left" ? leftEdge : rightEdge;
  const direction = ear === "left" ? -1 : 1;
  const outward = state.selectedModel === "inside" ? 0.018 : 0.068 + Math.abs(yaw) * 0.018;
  const x = edge.x + direction * faceWidth * outward;
  const y = edge.y - faceHeight * (state.selectedModel === "inside" ? -0.012 : 0.072);
  // Face height changes substantially less than visible face width during yaw.
  const scale = faceHeight * (state.selectedModel === "inside" ? 0.16 : state.selectedModel === "silk" ? 0.205 : 0.23);

  return { x, y, scale, roll, yaw, ear, edge, faceWidth, faceHeight };
}

function smoothTracking(target) {
  if (!state.smoothed || state.smoothed.ear !== target.ear) {
    state.smoothed = { ...target };
    return state.smoothed;
  }
  const positionAlpha = 0.22;
  const rotationAlpha = 0.16;
  state.smoothed.x = lerp(state.smoothed.x, target.x, positionAlpha);
  state.smoothed.y = lerp(state.smoothed.y, target.y, positionAlpha);
  state.smoothed.scale = lerp(state.smoothed.scale, target.scale, 0.22);
  state.smoothed.roll = lerp(state.smoothed.roll, target.roll, rotationAlpha);
  state.smoothed.yaw = lerp(state.smoothed.yaw, target.yaw, rotationAlpha);
  state.smoothed.edge = target.edge;
  state.smoothed.faceWidth = target.faceWidth;
  state.smoothed.faceHeight = target.faceHeight;
  return state.smoothed;
}

function applyTracking(tracking) {
  const t = smoothTracking(tracking);
  const direction = t.ear === "left" ? -1 : 1;
  tryOnRoot.visible = true;
  tryOnRoot.position.set(t.x, 1 - t.y, 0);
  tryOnRoot.scale.set(t.scale * direction, t.scale, t.scale);
  tryOnRoot.rotation.set(0.05, -t.yaw * 0.9 * direction, -t.roll + direction * 0.05);

  occluder.visible = state.selectedModel !== "inside";
  occluder.position.set(t.edge.x - direction * t.faceWidth * 0.02, 1 - t.edge.y, 0.22);
  occluder.scale.set(t.faceWidth * 0.11, t.faceHeight * 0.17, 1);
  alignmentGuide.hidden = true;
  setStatus(`${t.ear === "left" ? "Левое" : "Правое"} ухо · ${Math.round(state.fps)} FPS`, true);
}

function hideTracking() {
  tryOnRoot.visible = false;
  occluder.visible = false;
  state.hasFace = false;
  alignmentGuide.hidden = false;
  setStatus("Поместите лицо в кадр");
}

function processResult(result) {
  const landmarks = result?.faceLandmarks?.[0];
  if (!landmarks) {
    hideTracking();
    drawDiagnostics(null);
    return;
  }
  const mapPoint = getCoverMapper();
  const tracking = resolveTracking(landmarks, mapPoint);
  if (!tracking) return;
  state.hasFace = true;
  applyTracking(tracking);
  drawDiagnostics(landmarks, tracking, mapPoint);
}

function updateFps(now) {
  const instant = 1000 / Math.max(now - state.lastFrameAt, 1);
  state.fps = state.fps ? lerp(state.fps, instant, 0.08) : instant;
  state.lastFrameAt = now;
}

function trackVideoFrame(now) {
  if (!state.running || state.mode !== "video") return;
  if (video.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    try {
      const result = state.faceLandmarker.detectForVideo(video, now);
      updateFps(now);
      processResult(result);
    } catch (error) {
      console.warn("Tracking frame skipped", error);
    }
  }
  webgl.renderer.render(webgl.scene, webgl.camera);
  requestAnimationFrame(trackVideoFrame);
}

function drawDiagnostics(landmarks, tracking, mapPoint = (point) => point) {
  const width = cameraStage.clientWidth;
  const height = cameraStage.clientHeight;
  debugContext.clearRect(0, 0, width, height);
  if (!state.diagnostics || !landmarks) return;
  debugContext.fillStyle = "rgba(116, 234, 166, .72)";
  for (let i = 0; i < landmarks.length; i += 4) {
    const point = mapPoint(landmarks[i]);
    debugContext.beginPath();
    debugContext.arc(point.x * width, point.y * height, 1.25, 0, Math.PI * 2);
    debugContext.fill();
  }
  if (tracking) {
    debugContext.strokeStyle = "#ffd288";
    debugContext.lineWidth = 2;
    debugContext.beginPath();
    debugContext.arc(tracking.x * width, tracking.y * height, 8, 0, Math.PI * 2);
    debugContext.stroke();
    debugContext.fillStyle = "rgba(19, 28, 24, .72)";
    debugContext.fillRect(12, height - 89, 194, 68);
    debugContext.fillStyle = "white";
    debugContext.font = "11px ui-monospace, monospace";
    debugContext.fillText(`ear: ${tracking.ear}`, 23, height - 66);
    debugContext.fillText(`yaw: ${tracking.yaw.toFixed(3)}`, 23, height - 49);
    debugContext.fillText(`face: ${(tracking.faceWidth * width).toFixed(0)}px`, 23, height - 32);
  }
}

async function handlePhoto(file) {
  if (!file || !file.type.startsWith("image/")) return;
  if (state.loading) return;
  state.loading = true;
  stopCamera();
  showExperience("photo");
  setStatus("Анализируем фото…");
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      photo.onload = resolve;
      photo.onerror = reject;
      photo.src = objectUrl;
    });
    await ensureLandmarker("IMAGE");
    const result = state.faceLandmarker.detect(photo);
    state.fps = 0;
    processResult(result);
    webgl.renderer.render(webgl.scene, webgl.camera);
    if (state.hasFace) setStatus("Фото обработано локально", true);
  } catch (error) {
    console.error(error);
    setStatus("Не удалось распознать фото");
    hideTracking();
  } finally {
    state.loading = false;
    URL.revokeObjectURL(objectUrl);
  }
}

startButton.addEventListener("click", () => startCamera());
photoInput.addEventListener("change", (event) => handlePhoto(event.target.files?.[0]));
flipButton.addEventListener("click", () => {
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  startCamera(state.facingMode);
});

document.querySelectorAll(".model-card").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedModel = button.dataset.model;
    document.querySelectorAll(".model-card").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-checked", String(active));
    });
    state.smoothed = null;
    updateModelVisibility();
    webgl.renderer.render(webgl.scene, webgl.camera);
  });
});

document.querySelectorAll(".swatch").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedColor = button.dataset.color;
    caseMaterial.color.set(state.selectedColor);
    $("#colorName").textContent = button.dataset.name;
    document.querySelectorAll(".swatch").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-checked", String(active));
    });
    webgl.renderer.render(webgl.scene, webgl.camera);
  });
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedEar = button.dataset.ear;
    state.smoothed = null;
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
  });
});

debugButton.addEventListener("click", () => {
  state.diagnostics = !state.diagnostics;
  debugButton.setAttribute("aria-pressed", String(state.diagnostics));
  if (!state.diagnostics) debugContext.clearRect(0, 0, cameraStage.clientWidth, cameraStage.clientHeight);
});

const helpDialog = $("#helpDialog");
$("#helpButton").addEventListener("click", () => helpDialog.showModal());
$("#closeHelp").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  state.lastFrameAt = performance.now();
});

webgl.renderer.render(webgl.scene, webgl.camera);
}
