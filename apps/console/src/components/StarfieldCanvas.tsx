import { useEffect, useRef } from "react";
import type * as ThreeNamespace from "three";
import { createHiveConstellation } from "./hiveConstellation";

// 3D 星空背景(Three.js / WebGL)。動態 import 延遲載入 three,只有 /home 掛載時
// 才會下載,其他控制台頁面不受影響。
//
// 場景由三層組成:
//   1. 星雲:全屏 shader 平面——深空漸層、頂部微光、斜向銀河帶,以及緩慢漂移的雲氣;
//   2. 星域:近/遠兩層點陣星點(自訂 shader),球殼分布。每顆星獨立閃爍、依距離
//      縮放、帶色溫差異;大星在片段著色器疊加十字星芒。相機隨滑鼠做視差位移,
//      近星移動多、遠星移動少,配合星域緩慢擺動呈現 3D 縱深;
//   3. 流星:偶發的拖尾光條(面向相機的漸層面片),3 顆輪替出現。
//
// 效能護欄(軟體渲染的內建瀏覽器也能順開):
//   - 偵測 SwiftShader/llvmpipe 等軟體渲染 → 降像素比與星數,星雲改用無雜訊簡化版;
//   - 自適應解析度:平均影格時間過長時自動降低渲染解析度(外觀不變);
//   - 分頁隱藏時降頻渲染;unmount 時完整釋放 GPU 資源;
//   - prefers-reduced-motion 時只渲染一幀靜態星空。

const NEAR_STAR_COUNT = 2600;
const FAR_STAR_COUNT = 4200;
const METEOR_COUNT = 3;
const SOFTWARE_RENDER_STAR_RATIO = 0.55;

const STAR_VERTEX_SHADER = `
uniform float uTime;
uniform float uPixelRatio;
uniform float uFade;
attribute float aScale;
attribute float aPhase;
attribute float aSpeed;
attribute vec3 aColor;
varying float vTwinkle;
varying float vSpike;
varying vec3 vColor;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float twinkle = 0.62 + 0.38 * sin(uTime * aSpeed + aPhase);
  vTwinkle = twinkle;
  vSpike = smoothstep(1.7, 2.9, aScale);
  vColor = aColor;
  float size = aScale * uPixelRatio * (150.0 / max(-mvPosition.z, 1.0)) * (0.82 + 0.18 * twinkle);
  gl_PointSize = clamp(size * uFade, 0.0, 24.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const STAR_FRAGMENT_SHADER = `
varying float vTwinkle;
varying float vSpike;
varying vec3 vColor;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float core = 1.0 - smoothstep(0.03, 0.5, d);
  float halo = pow(1.0 - smoothstep(0.05, 0.5, d), 2.4) * 0.32;
  float alpha = core + halo;
  if (vSpike > 0.01) {
    float spikeX = (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 16.0))
      * (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 1.5));
    float spikeY = (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 16.0))
      * (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 1.5));
    alpha += (spikeX + spikeY) * vSpike * 0.6;
  }
  alpha = clamp(alpha, 0.0, 1.0) * vTwinkle * 0.95;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

// 背景:在場景內重建 .home 的頂部暈光漸層,再疊上銀河帶與緩慢漂移的雲氣
// (canvas 為不透明,效能最好)。
const NEBULA_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}
`;

const NEBULA_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uAspect;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.55 * noise(p);
  v += 0.28 * noise(p * 2.03 + vec2(7.1, 3.7));
  v += 0.14 * noise(p * 4.01 - vec2(3.3, 9.1));
  return v;
}

void main() {
  vec2 uv = vUv;
  vec3 base = mix(vec3(0.022, 0.024, 0.028), vec3(0.043, 0.047, 0.056), pow(uv.y, 1.35));
  float topGlow = exp(-distance(vec2(uv.x, uv.y * 0.9), vec2(0.5, 1.18)) * 3.4) * 0.10;

  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float band = exp(-pow(p.x * 0.55 + p.y * 0.83 + 0.10, 2.0) * 5.5);

  float n1 = fbm(p * 2.4 + vec2(uTime * 0.012, -uTime * 0.007));
  float n2 = fbm(p * 5.6 - vec2(uTime * 0.017, uTime * 0.005));
  float dust = smoothstep(0.28, 0.92, n1 * 0.8 + n2 * 0.3);

  vec3 nebulaCool = vec3(0.085, 0.115, 0.190);
  vec3 nebulaWarm = vec3(0.180, 0.130, 0.240);
  vec3 color = base + topGlow;
  color += mix(nebulaCool, nebulaWarm, n2) * band * dust * 0.95;

  float vignette = 1.0 - smoothstep(0.55, 1.2, length(p));
  color *= mix(0.76, 1.0, vignette);
  gl_FragColor = vec4(color, 1.0);
}
`;

// 軟體渲染用的簡化星雲:去掉 fbm 雜訊,只留漸層與銀河帶。
const NEBULA_FRAGMENT_SHADER_LITE = `
uniform float uAspect;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 base = mix(vec3(0.022, 0.024, 0.028), vec3(0.043, 0.047, 0.056), pow(uv.y, 1.35));
  float topGlow = exp(-distance(vec2(uv.x, uv.y * 0.9), vec2(0.5, 1.18)) * 3.4) * 0.10;

  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  float band = exp(-pow(p.x * 0.55 + p.y * 0.83 + 0.10, 2.0) * 5.5);

  vec3 color = base + topGlow + vec3(0.075, 0.095, 0.150) * band * 0.7;
  float vignette = 1.0 - smoothstep(0.55, 1.2, length(p));
  color *= mix(0.76, 1.0, vignette);
  gl_FragColor = vec4(color, 1.0);
}
`;

// 流星:幾何為 x∈[-1,0] 的單位面片(頭部在 x=0),以 scale.x 拉出拖尾長度。
const METEOR_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const METEOR_FRAGMENT_SHADER = `
uniform float uOpacity;
varying vec2 vUv;

void main() {
  float t = vUv.x;
  float across = abs(vUv.y - 0.5) * 2.0;
  float body = pow(t, 2.0) * (1.0 - smoothstep(0.25, 1.0, across)) * 0.45;
  float core = pow(t, 4.5) * pow(1.0 - across, 2.0);
  float alpha = (body + core) * uOpacity;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vec3(0.82, 0.90, 1.0), alpha);
}
`;

type StarFieldOptions = {
  count: number;
  radiusMin: number;
  radiusMax: number;
  scaleMin: number;
  scaleMax: number;
  frontHemisphere: boolean;
};

// 球面均勻取樣;近層只取相機前方(z < 0)半球,拉高視野內的星點密度。
function createStarFieldGeometry(
  THREE: typeof ThreeNamespace,
  options: StarFieldOptions,
): ThreeNamespace.BufferGeometry {
  const { count, radiusMin, radiusMax, scaleMin, scaleMax, frontHemisphere } = options;
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const palette: Array<[number, number, number]> = [
    [0.7, 0.8, 1.0],
    [0.9, 0.94, 1.0],
    [1.0, 0.92, 0.8],
    [0.84, 0.8, 1.0],
  ];

  for (let i = 0; i < count; i += 1) {
    const y = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const ring = Math.sqrt(1 - y * y);
    const radius = radiusMin + Math.random() ** 1.7 * (radiusMax - radiusMin);
    const zRaw = radius * ring * Math.sin(theta);
    positions[i * 3] = radius * ring * Math.cos(theta);
    positions[i * 3 + 1] = radius * y;
    positions[i * 3 + 2] = frontHemisphere ? -Math.abs(zRaw) : zRaw;

    scales[i] = scaleMin + Math.random() ** 2.4 * (scaleMax - scaleMin);
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.45 + Math.random() * 1.35;

    const tint = palette[Math.floor(Math.random() * palette.length)];
    const brightness = 0.72 + Math.random() * 0.28;
    colors[i * 3] = tint[0] * brightness;
    colors[i * 3 + 1] = tint[1] * brightness;
    colors[i * 3 + 2] = tint[2] * brightness;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

type Meteor = {
  mesh: ThreeNamespace.Mesh;
  material: ThreeNamespace.ShaderMaterial;
  origin: ThreeNamespace.Vector3;
  direction: ThreeNamespace.Vector3;
  speed: number;
  ttl: number;
  age: number;
  active: boolean;
  nextAt: number;
};

export function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    const cleanupFns: Array<() => void> = [];

    const boot = async () => {
      const THREE = await import("three");
      if (disposed) return;

      // 軟體渲染偵測(用暫存 canvas 探測,不需先建 renderer):
      // SwiftShader / llvmpipe / Microsoft Basic Render Driver(內建瀏覽器常見)。
      const probe = document.createElement("canvas");
      const probeGl = probe.getContext("webgl2") ?? probe.getContext("webgl");
      const probeExt = probeGl?.getExtension("WEBGL_debug_renderer_info");
      const gpuName =
        probeGl && probeExt ? String(probeGl.getParameter(probeExt.UNMASKED_RENDERER_WEBGL) ?? "") : "";
      const isSoftwareRender = !probeGl || /swiftshader|llvmpipe|software|basic render/i.test(gpuName);

      let renderer: ThreeNamespace.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: false,
          antialias: !isSoftwareRender,
          powerPreference: "high-performance",
        });
      } catch {
        // WebGL 不可用:.home 的漸層背景仍在,頁面功能不受影響。
        return;
      }

      renderer.setPixelRatio(isSoftwareRender ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x06070a, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 1000);
      camera.position.set(0, 0, 0);

      // 靜態資源(幾何 / 材質)統一收集,unmount 時一次釋放。
      const disposables: Array<{ dispose: () => void }> = [];
      const disposeAll = () => {
        for (const item of disposables) item.dispose();
        disposables.length = 0;
        renderer.dispose();
      };

      // ---------- 星雲背景 ----------
      const nebulaGeometry = new THREE.PlaneGeometry(2, 2);
      const nebulaMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uAspect: { value: camera.aspect },
        },
        vertexShader: NEBULA_VERTEX_SHADER,
        fragmentShader: isSoftwareRender ? NEBULA_FRAGMENT_SHADER_LITE : NEBULA_FRAGMENT_SHADER,
        depthTest: false,
        depthWrite: false,
      });
      const nebula = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
      nebula.frustumCulled = false;
      nebula.renderOrder = -1;
      scene.add(nebula);
      disposables.push(nebulaGeometry, nebulaMaterial);

      // ---------- 星域 ----------
      const starGroup = new THREE.Group();
      const starMaterials: ThreeNamespace.ShaderMaterial[] = [];

      const addStarLayer = (
        count: number,
        radiusMin: number,
        radiusMax: number,
        scaleMin: number,
        scaleMax: number,
        frontHemisphere: boolean,
      ) => {
        const geometry = createStarFieldGeometry(THREE, {
          count,
          radiusMin,
          radiusMax,
          scaleMin,
          scaleMax,
          frontHemisphere,
        });
        // 軟體渲染時只畫部分星點。
        geometry.setDrawRange(0, Math.floor(count * (isSoftwareRender ? SOFTWARE_RENDER_STAR_RATIO : 1)));

        const material = new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: 1 },
            uFade: { value: 0 },
          },
          vertexShader: STAR_VERTEX_SHADER,
          fragmentShader: STAR_FRAGMENT_SHADER,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });

        starGroup.add(new THREE.Points(geometry, material));
        starMaterials.push(material);
        disposables.push(geometry, material);
      };

      addStarLayer(NEAR_STAR_COUNT, 45, 190, 0.9, 2.9, true);
      addStarLayer(FAR_STAR_COUNT, 220, 460, 0.55, 1.5, false);
      scene.add(starGroup);

      // ---------- 蜂巢星座 ----------
      const hive = createHiveConstellation(THREE, {
        pixelRatio: renderer.getPixelRatio(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      scene.add(hive.root);
      disposables.push(...hive.geometries, ...hive.materials);

      // ---------- 流星 ----------
      const meteorGeometry = new THREE.PlaneGeometry(1, 1);
      // 讓頭部位於原點、拖尾朝 -x 延伸,mesh.position 即為流星頭位置。
      meteorGeometry.translate(-0.5, 0, 0);
      disposables.push(meteorGeometry);

      const meteors: Meteor[] = [];
      for (let i = 0; i < METEOR_COUNT; i += 1) {
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uOpacity: { value: 0 },
          },
          vertexShader: METEOR_VERTEX_SHADER,
          fragmentShader: METEOR_FRAGMENT_SHADER,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(meteorGeometry, material);
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.renderOrder = 10;
        scene.add(mesh);
        disposables.push(material);
        meteors.push({
          mesh,
          material,
          origin: new THREE.Vector3(),
          direction: new THREE.Vector3(),
          speed: 0,
          ttl: 0,
          age: 0,
          active: false,
          nextAt: 1.4 + i * 2.6 + Math.random() * 2.5,
        });
      }

      const spawnMeteor = (meteor: Meteor) => {
        meteor.origin.set(-110 + Math.random() * 150, 45 + Math.random() * 35, -130 + Math.random() * 40);
        meteor.direction.set(0.8 + Math.random() * 0.25, -(0.5 + Math.random() * 0.22), 0).normalize();
        meteor.speed = 95 + Math.random() * 55;
        meteor.ttl = 0.95 + Math.random() * 0.45;
        meteor.age = 0;
        meteor.active = true;
        meteor.mesh.visible = true;
        meteor.mesh.rotation.z = Math.atan2(meteor.direction.y, meteor.direction.x);
      };

      const updateMeteors = (time: number, delta: number) => {
        for (const meteor of meteors) {
          if (!meteor.active) {
            if (time >= meteor.nextAt) spawnMeteor(meteor);
            continue;
          }
          meteor.age += delta;
          if (meteor.age >= meteor.ttl) {
            meteor.active = false;
            meteor.mesh.visible = false;
            meteor.nextAt = time + 2.6 + Math.random() * 5.5;
            continue;
          }
          meteor.mesh.position
            .copy(meteor.origin)
            .addScaledVector(meteor.direction, meteor.speed * meteor.age);
          const trailLength = meteor.speed * meteor.ttl * 0.32;
          meteor.mesh.scale.set(trailLength, 0.6 + trailLength * 0.008, 1);
          const fadeIn = Math.min(meteor.age / 0.12, 1);
          const fadeOut = Math.min((meteor.ttl - meteor.age) / 0.38, 1);
          meteor.material.uniforms.uOpacity.value = Math.max(Math.min(fadeIn, fadeOut), 0) * 0.85;
        }
      };

      // ---------- 尺寸與自適應解析度 ----------
      let resScale = 1;
      let frameCostAvg = 16;
      let framesSinceScale = 0;
      const applySize = () => {
        const width = Math.max(1, Math.round(window.innerWidth * resScale));
        const height = Math.max(1, Math.round(window.innerHeight * resScale));
        renderer.setSize(width, height, false);
        camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
        camera.updateProjectionMatrix();
        nebulaMaterial.uniforms.uAspect.value = camera.aspect;
        // gl_PointSize 以 drawing buffer 像素計,須同時反映像素比與降採樣倍率。
        const pointPixelRatio = renderer.getPixelRatio() * resScale;
        for (const material of starMaterials) material.uniforms.uPixelRatio.value = pointPixelRatio;
        hive.setPixelRatio(pointPixelRatio);
        hive.setViewport(window.innerWidth, window.innerHeight);
      };
      applySize();
      window.addEventListener("resize", applySize);
      cleanupFns.push(() => window.removeEventListener("resize", applySize));

      const renderOnce = () => renderer.render(scene, camera);

      // 減少動態偏好:不跑動畫迴圈,只渲染一幀完整靜態星空。
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (const material of starMaterials) material.uniforms.uFade.value = 1;
        hive.update(1.5, 99);
        renderOnce();
        cleanupFns.push(disposeAll);
        return;
      }

      // ---------- 互動視差 ----------
      const pointerTarget = { x: 0, y: 0 };
      const onPointerMove = (event: PointerEvent) => {
        pointerTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;
        pointerTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      cleanupFns.push(() => window.removeEventListener("pointermove", onPointerMove));

      let elapsed = 0;
      let lastFrameTime = performance.now();

      const renderFrame = () => {
        const now = performance.now();
        const rawDelta = now - lastFrameTime;
        lastFrameTime = now;
        // 分頁切走再回來時避免時間跳躍。
        const delta = Math.min(rawDelta / 1000, 0.05);

        // 自適應解析度:平均影格時間過長就降解析度,恢復順暢再升回。
        frameCostAvg = frameCostAvg * 0.92 + rawDelta * 0.08;
        framesSinceScale += 1;
        if (framesSinceScale >= 45) {
          framesSinceScale = 0;
          if (frameCostAvg > 30 && resScale > 0.7) {
            resScale = Math.max(0.7, resScale * 0.75);
            applySize();
          } else if (frameCostAvg < 17 && resScale < 1) {
            resScale = Math.min(1, resScale / 0.75);
            applySize();
          }
        }

        elapsed += delta;
        const fade = Math.min(elapsed / 1.1, 1);
        const easedFade = 1 - (1 - fade) ** 3;
        nebulaMaterial.uniforms.uTime.value = elapsed;
        for (const material of starMaterials) {
          material.uniforms.uTime.value = elapsed;
          material.uniforms.uFade.value = easedFade;
        }

        // 星域緩慢擺動;相機隨滑鼠視差 + 無操作時的自然漂移。
        starGroup.rotation.y = Math.sin(elapsed * 0.018) * 0.16;
        starGroup.rotation.x = Math.sin(elapsed * 0.013 + 1.2) * 0.07;
        hive.update(elapsed * 0.7, elapsed);
        const targetX = pointerTarget.x * 1.1 + Math.sin(elapsed * 0.11) * 0.35;
        const targetY = -pointerTarget.y * 0.8 + Math.cos(elapsed * 0.09) * 0.25;
        camera.position.x += (targetX - camera.position.x) * 0.045;
        camera.position.y += (targetY - camera.position.y) * 0.045;
        // 看向遠方一點而非原點(相機可能位於原點,lookAt 自身會退化)。
        camera.lookAt(0, 0, -200);

        updateMeteors(elapsed, delta);
        renderer.render(scene, camera);
      };

      // 動畫驅動:不依賴 requestAnimationFrame 與 DOM 計時器——部分內嵌
      // webview(如 Microsoft Basic Render Driver 軟體渲染)會停止派發
      // RAF 並深度節流計時器,兩者都會讓動畫永遠停擺。MessageChannel
      // 的訊息任務不在節流範圍,以此自建排程迴圈,並以 15ms 閘門限制
      // 最高約 60fps;分頁被系統判定隱藏時降到約 10fps 繼續渲染
      // (某些 webview 會誤判可見頁面為隱藏,完全停渲染會讓動畫凍結)。
      const pumpChannel = new MessageChannel();
      let channelScheduled = false;
      let running = true;

      const pump = () => {
        channelScheduled = false;
        if (!running) return;
        const frameInterval = document.hidden ? 100 : 15;
        if (performance.now() - lastFrameTime >= frameInterval) {
          renderFrame();
        }
        if (running) {
          channelScheduled = true;
          pumpChannel.port2.postMessage(null);
        }
      };
      pumpChannel.port1.onmessage = pump;

      const schedulePump = () => {
        if (channelScheduled || !running) return;
        channelScheduled = true;
        pumpChannel.port2.postMessage(null);
      };

      cleanupFns.push(() => {
        running = false;
        pumpChannel.port1.close();
      });
      cleanupFns.push(disposeAll);
      schedulePump();
    };

    void boot();

    return () => {
      disposed = true;

      for (const fn of cleanupFns) fn();
      cleanupFns.length = 0;
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield-canvas" tabIndex={-1} aria-hidden="true" />;
}
