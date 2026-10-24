import type * as ThreeNamespace from "three";

// Autonomia 蜂巢星座:多個大小不一的六邊形蜂巢碎片,四散漂浮在 3D 星空中。
// 與先前的中心蜂窩晶格不同:
//   - 不是一整片蜂窩網面,而是 7 個獨立碎片,深度、大小與傾角各異;
//   - 主蜂巢完整(品牌錨點,帶中心星核),其餘碎片各缺 1~2 條邊,星線斷開;
//   - 每顆頂點星獨立閃爍,邊以實例化光束繪製,端點收尖成星線;
//   - 碎片各自以極緩慢的速度擺動,碎片之間沒有連線,散落成星座。
//
// age 驅動建構動畫(碎片依序點亮並連線),time 驅動閃爍與漂浮。

type Point2 = [number, number];

type FragmentSpec = {
  center: [number, number, number];
  radius: number;
  tilt: [number, number, number];
  missingEdges: number[];
  dim: number;
  birth: number;
  core: boolean;
  spokes: boolean;
};

// 手工配置:左右與上下交錯分布,深度 88~160,由近而遠遞增。
const FRAGMENTS: FragmentSpec[] = [
  {
    center: [0, 2, -88],
    radius: 11,
    tilt: [-0.1, 0.18, 0.02],
    missingEdges: [],
    dim: 0.92,
    birth: 0.3,
    core: true,
    spokes: true,
  },
  {
    center: [-60, 26, -112],
    radius: 7.5,
    tilt: [0.22, -0.35, 0.1],
    missingEdges: [4],
    dim: 0.62,
    birth: 1.0,
    core: false,
    spokes: false,
  },
  {
    center: [54, 33, -96],
    radius: 6.5,
    tilt: [-0.3, 0.42, -0.08],
    missingEdges: [1, 5],
    dim: 0.7,
    birth: 1.35,
    core: false,
    spokes: false,
  },
  {
    center: [-66, -32, -98],
    radius: 8,
    tilt: [0.34, 0.26, 0.12],
    missingEdges: [2],
    dim: 0.58,
    birth: 1.7,
    core: false,
    spokes: false,
  },
  {
    center: [60, -26, -124],
    radius: 7,
    tilt: [-0.24, -0.4, -0.1],
    missingEdges: [0, 3],
    dim: 0.66,
    birth: 2.05,
    core: false,
    spokes: false,
  },
  {
    center: [6, -50, -138],
    radius: 8.5,
    tilt: [0.18, 0.32, -0.04],
    missingEdges: [5],
    dim: 0.6,
    birth: 2.4,
    core: false,
    spokes: false,
  },
  {
    center: [-34, 44, -160],
    radius: 5,
    tilt: [-0.36, 0.2, 0.06],
    missingEdges: [1],
    dim: 0.45,
    birth: 2.7,
    core: false,
    spokes: false,
  },
];

const hexCorners = (radius: number): Point2[] => {
  const corners: Point2[] = [];
  for (let k = 0; k < 6; k += 1) {
    const angle = Math.PI / 6 + (Math.PI / 3) * k;
    corners.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return corners;
};

const NODE_VERTEX_SHADER = `
uniform float uTime;
uniform float uAge;
uniform float uPixelRatio;
attribute float aScale;
attribute float aPhase;
attribute float aSpeed;
attribute float aBirth;
varying float vGlow;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float twinkle = 0.74 + 0.26 * sin(uTime * aSpeed + aPhase);
  float birth = smoothstep(aBirth, aBirth + 0.5, uAge);
  vGlow = twinkle * birth;
  float size = aScale * uPixelRatio * (0.85 + 0.15 * twinkle) * birth * (180.0 / max(-mvPosition.z, 1.0));
  gl_PointSize = min(size, 56.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const NODE_FRAGMENT_SHADER = `
varying float vGlow;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float core = 1.0 - smoothstep(0.02, 0.22, d);
  float halo = pow(1.0 - smoothstep(0.0, 0.5, d), 2.4) * 0.5;
  float spikeX = (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 22.0))
    * (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 2.0));
  float spikeY = (1.0 - smoothstep(0.0, 0.5, abs(p.x) * 22.0))
    * (1.0 - smoothstep(0.0, 0.5, abs(p.y) * 2.0));
  float alpha = clamp(core + halo + (spikeX + spikeY) * 0.35, 0.0, 1.0) * vGlow;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.94, 0.96, 1.0), alpha);
}
`;

// 實例化光束:每條邊一組 iEndA/iEndB/iRadius/iDim/iBirth。
// 幾何足跡放大 2.6 倍以容納光暈;亮度在片段著色器以「像素空間中 fragment
// 到軸線投影線段的距離」計算,粗細以像素半徑呈現,與視角無關。
const BEAM_VERTEX_SHADER = `
uniform vec2 uViewport;
uniform float uAge;
attribute vec3 iEndA;
attribute vec3 iEndB;
attribute float iRadiusA;
attribute float iRadiusB;
attribute float iDim;
attribute float iBirth;
varying vec2 vSelfPx;
varying vec2 vAPx;
varying vec2 vBPx;
varying vec2 vRadiusPx;
varying float vU;
varying float vDim;
varying float vProgress;

void main() {
  float u = clamp(position.y + 0.5, 0.0, 1.0);
  vU = u;
  vDim = iDim;
  vProgress = clamp((uAge - iBirth) / 0.55, 0.0, 1.0);

  vec3 axis = iEndB - iEndA;
  vec3 upHint = abs(axis.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangentX = normalize(cross(axis, upHint));
  vec3 tangentZ = normalize(cross(axis, tangentX));

  // 兩端保留四成寬度再收尖,讓相鄰邊在頂點星處確實相接;中段最粗。
  float taper = 0.42 + 0.58 * smoothstep(0.0, 0.18, u) * (1.0 - smoothstep(0.82, 1.0, u));
  float baseRadius = mix(iRadiusA, iRadiusB, u) * taper;
  vec3 local = mix(iEndA, iEndB, u) + (tangentX * position.x + tangentZ * position.z) * baseRadius * 2.6;

  vec4 clipSelf = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
  vec4 clipA = projectionMatrix * modelViewMatrix * vec4(iEndA, 1.0);
  vec4 clipB = projectionMatrix * modelViewMatrix * vec4(iEndB, 1.0);
  vec2 halfViewport = uViewport * 0.5;
  vSelfPx = (clipSelf.xy / clipSelf.w) * halfViewport;
  vAPx = (clipA.xy / clipA.w) * halfViewport;
  vBPx = (clipB.xy / clipB.w) * halfViewport;
  float projScaleY = projectionMatrix[1][1];
  vRadiusPx.x = iRadiusA * projScaleY / clipA.w * halfViewport.y;
  vRadiusPx.y = iRadiusB * projScaleY / clipB.w * halfViewport.y;
  gl_Position = clipSelf;
}
`;

const BEAM_FRAGMENT_SHADER = `
uniform float uTime;
varying vec2 vSelfPx;
varying vec2 vAPx;
varying vec2 vBPx;
varying vec2 vRadiusPx;
varying float vU;
varying float vDim;
varying float vProgress;

void main() {
  if (vU > vProgress) discard;

  vec2 ab = vBPx - vAPx;
  float abLen2 = max(dot(ab, ab), 0.0001);
  float t = clamp(dot(vSelfPx - vAPx, ab) / abLen2, 0.0, 1.0);
  vec2 closest = vAPx + ab * t;
  float dist = length(vSelfPx - closest);

  float taper = 0.42 + 0.58 * smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.82, 1.0, t));
  float radiusPx = max(mix(vRadiusPx.x, vRadiusPx.y, t) * taper, 0.5);

  float core = pow(max(1.0 - dist / radiusPx, 0.0), 1.8);
  float halo = pow(max(1.0 - dist / (radiusPx * 2.6), 0.0), 3.4) * 0.35;
  float shimmer = 0.82 + 0.18 * sin(uTime * 1.6 + t * 7.0);
  float flow = mix(1.0, 0.72, abs(sin(t * 3.14159265)));
  float head = (1.0 - smoothstep(0.0, 0.07, abs(t - vProgress))) * 0.9;

  float alpha = (core + halo + head) * shimmer * flow * vDim;
  // 幾何足跡邊緣(2.6 倍半徑)前即淡出到 0,消除點陣化邊界。
  alpha *= 1.0 - smoothstep(radiusPx * 2.1, radiusPx * 2.6, dist);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), alpha);
}
`;

export type HiveConstellation = {
  root: ThreeNamespace.Group;
  geometries: ThreeNamespace.BufferGeometry[];
  materials: ThreeNamespace.Material[];
  setPixelRatio: (value: number) => void;
  setViewport: (width: number, height: number) => void;
  update: (time: number, age: number) => void;
};

type HiveOptions = {
  pixelRatio: number;
  viewportWidth: number;
  viewportHeight: number;
};

export function createHiveConstellation(
  THREE: typeof ThreeNamespace,
  options: HiveOptions,
): HiveConstellation {
  const geometries: ThreeNamespace.BufferGeometry[] = [];
  const materials: ThreeNamespace.Material[] = [];

  const root = new THREE.Group();

  // 所有碎片共用同一組材質,只有幾何不同(每碎片 1 個 Points + 1 個 InstancedMesh)。
  const nodeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAge: { value: 0 },
      uPixelRatio: { value: options.pixelRatio },
    },
    vertexShader: NODE_VERTEX_SHADER,
    fragmentShader: NODE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(nodeMaterial);

  const viewportPx = new THREE.Vector2(options.viewportWidth, options.viewportHeight);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uAge: { value: 0 },
      uTime: { value: 0 },
      uViewport: { value: viewportPx },
    },
    vertexShader: BEAM_VERTEX_SHADER,
    fragmentShader: BEAM_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(beamMaterial);

  const sharedBaseGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 16, true);
  geometries.push(sharedBaseGeometry);

  const fragments = FRAGMENTS.map((spec) => {
    const group = new THREE.Group();
    group.position.set(spec.center[0], spec.center[1], spec.center[2]);
    group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);

    const corners = hexCorners(spec.radius);
    const vertexScale = 4 + spec.radius * 0.3;

    // ---------- 頂點星(可選中心核) ----------
    const starCount = spec.core ? 7 : 6;
    const positions = new Float32Array(starCount * 3);
    const scales = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    const speeds = new Float32Array(starCount);
    const births = new Float32Array(starCount);

    corners.forEach(([x, y], i) => {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      scales[i] = vertexScale;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.4 + Math.random() * 0.5;
      births[i] = spec.birth + 0.1 + i * 0.06;
    });
    if (spec.core) {
      positions[6 * 3] = 0;
      positions[6 * 3 + 1] = 0;
      scales[6] = spec.radius * 0.85;
      phases[6] = Math.random() * Math.PI * 2;
      speeds[6] = 0.35;
      births[6] = spec.birth;
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    nodeGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    nodeGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    nodeGeometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
    nodeGeometry.setAttribute("aBirth", new THREE.BufferAttribute(births, 1));
    geometries.push(nodeGeometry);

    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    nodePoints.frustumCulled = false;
    group.add(nodePoints);

    // ---------- 六邊形邊(略去缺失的邊),主蜂巢另加中心輻射線 ----------
    const baseRadius = 0.14 + spec.radius * 0.013;
    const edgeIndices = [0, 1, 2, 3, 4, 5].filter((i) => !spec.missingEdges.includes(i));

    const edgeInstances: Array<{ a: Point2; b: Point2; dim: number; radius: number; birth: number }> = [];
    edgeIndices.forEach((edgeIndex, order) => {
      edgeInstances.push({
        a: corners[edgeIndex],
        b: corners[(edgeIndex + 1) % 6],
        dim: spec.dim,
        radius: baseRadius,
        birth: spec.birth + 0.45 + order * 0.09,
      });
    });
    if (spec.spokes) {
      corners.forEach((corner, i) => {
        edgeInstances.push({
          a: [0, 0],
          b: corner,
          dim: spec.dim * 0.45,
          radius: baseRadius * 0.62,
          birth: spec.birth + 0.3 + i * 0.05,
        });
      });
    }

    const edgeCount = edgeInstances.length;
    const endA = new Float32Array(edgeCount * 3);
    const endB = new Float32Array(edgeCount * 3);
    const edgeRadius = new Float32Array(edgeCount);
    const dims = new Float32Array(edgeCount);
    const edgeBirths = new Float32Array(edgeCount);

    edgeInstances.forEach((edge, order) => {
      endA[order * 3] = edge.a[0];
      endA[order * 3 + 1] = edge.a[1];
      endB[order * 3] = edge.b[0];
      endB[order * 3 + 1] = edge.b[1];
      edgeRadius[order] = edge.radius;
      dims[order] = edge.dim;
      edgeBirths[order] = edge.birth;
    });

    const beamGeometry = new THREE.InstancedBufferGeometry();
    beamGeometry.index = sharedBaseGeometry.index;
    beamGeometry.setAttribute("position", sharedBaseGeometry.attributes.position);
    beamGeometry.instanceCount = edgeCount;
    beamGeometry.setAttribute("iEndA", new THREE.InstancedBufferAttribute(endA, 3));
    beamGeometry.setAttribute("iEndB", new THREE.InstancedBufferAttribute(endB, 3));
    beamGeometry.setAttribute("iRadiusA", new THREE.InstancedBufferAttribute(edgeRadius, 1));
    beamGeometry.setAttribute("iRadiusB", new THREE.InstancedBufferAttribute(edgeRadius, 1));
    beamGeometry.setAttribute("iDim", new THREE.InstancedBufferAttribute(dims, 1));
    beamGeometry.setAttribute("iBirth", new THREE.InstancedBufferAttribute(edgeBirths, 1));
    geometries.push(beamGeometry);

    const beams = new THREE.Mesh(beamGeometry, beamMaterial);
    beams.frustumCulled = false;
    group.add(beams);

    root.add(group);

    return {
      group,
      centerY: spec.center[1],
      tiltX: spec.tilt[0],
      tiltY: spec.tilt[1],
      phase: Math.random() * Math.PI * 2,
      driftSpeed: 0.08 + Math.random() * 0.06,
    };
  });

  const setPixelRatio = (value: number) => {
    nodeMaterial.uniforms.uPixelRatio.value = value;
  };

  const setViewport = (width: number, height: number) => {
    viewportPx.set(width, height);
  };

  const update = (time: number, age: number) => {
    nodeMaterial.uniforms.uTime.value = time;
    nodeMaterial.uniforms.uAge.value = age;
    beamMaterial.uniforms.uTime.value = time;
    beamMaterial.uniforms.uAge.value = age;

    // 每個碎片極緩慢地各自擺動,讓散落的蜂巢像漂浮在星海中。
    for (const fragment of fragments) {
      const drift = Math.sin(time * fragment.driftSpeed + fragment.phase);
      fragment.group.rotation.x = fragment.tiltX + drift * 0.07;
      fragment.group.rotation.y =
        fragment.tiltY + Math.cos(time * fragment.driftSpeed * 0.8 + fragment.phase) * 0.09;
      fragment.group.position.y = fragment.centerY + Math.sin(time * 0.15 + fragment.phase) * 0.5;
    }

    // 整體只做微幅漂移,不搶碎片自身的動態。
    root.rotation.y = Math.sin(time * 0.05) * 0.05;
    root.rotation.x = Math.sin(time * 0.04 + 1.4) * 0.03;
  };

  return { root, geometries, materials, setPixelRatio, setViewport, update };
}
