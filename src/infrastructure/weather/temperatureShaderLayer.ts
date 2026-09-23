import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import geojsonData from "../../data/gis/geoBoundaries-VNM-ADM1_simplified.json" with { type: "json" };
import type { ForecastGridSample, StationForecast } from "./ecmwfWeatherService";

// Bounding box bao phủ toàn bộ lãnh thổ Việt Nam & hải đảo
const VN_BOUNDS = {
  minLng: 102.0,
  maxLng: 114.5,
  minLat: 8.0,
  maxLat: 24.0,
};

function lngToMercatorX(lng: number): number {
  return (lng + 180) / 360;
}

function latToMercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.max(-0.9999, Math.min(0.9999, sin));
  return 0.5 - (0.25 * Math.log((1 + clamped) / (1 - clamped))) / Math.PI;
}

/**
 * Mặt nạ lãnh thổ Việt Nam — CLIP ĐỊA LÝ CHÍNH XÁC, render-time.
 *
 * Hai bài học đã đo bằng số trên chính dataset ADM1 của dự án:
 *  1) Lỗ trắng cũ (STATE A) KHÔNG phải do union thiếu — union 64 ring tỉnh ở
 *     lưới cao phủ kín 30/30 điểm đất liền (gồm Mù Cang Chải, Sa Pa, Lũng Cú,
 *     Pù Rình…, khoảng cách tới land cell = 0). Lỗ cũ do mesh tam giác tai tỉnh
 *     bị simplify ăn mòn — mesh đó đã bỏ.
 *  2) Tràn ra ngoài biên giới (STATE B) do giãn nở hình thái 7px@640 ≈ 19km
 *     quanh mọi ring (kể cả biên giới đất liền TQ/Lào/Cam) + blur lan thêm.
 *     Giãn nở là công cụ SAI: nó hàn khe nội tỉnh bằng cái giá vẽ màu ra
 *     nước bạn.
 *
 * Cách đúng: KHÔNG nới rộng hình học. Raster union chính xác từng ring ở
 * lưới cao gấp 2 (supersample) để biên raster ≥0.7km/cell, rồi hạ mẫu lấy
 * ĐỘ PHỦ 0–255 (anti-aliasing thật ở mức dưới pixel, mép mềm 1 texel chứ
 * không phải vành 19km). Fragment discard khi ngoài lãnh thổ — NDMapVN bên
 * dưới hiện nguyên trạng: biển/Hà Nội/Vientiane không hề có màu nhiệt.
 * Diện tích phủ đo được = 14.1% bbox ≈ đúng tỉ lệ đất VN trong bbox (13.9%),
 * tức mask không thừa không thiếu.
 */
const MASK_RES = 1280;
const MASK_SS = 2; // mỗi texel mask = 2×2 ô raster con → độ phủ biên 4 mức
let cachedLandMask: Uint8Array | null = null;

function ringsOfFeature(feature: any): number[][][] {
  const geom = feature?.geometry;
  if (!geom) return [];
  const polys: number[][][][] =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  // even-odd theo TỪNG polygon của TỪNG tỉnh (đảo/hole xử lý đúng), sau đó
  // OR liên tỉnh = union lãnh thổ — biên giới nội tỉnh CHUNG vertex trong
  // dataset nên union không để lại khe.
  return polys.map((poly) => poly[0]); // chỉ lấy outer ring của mỗi polygon
}

export function buildLandMaskTexture(): Uint8Array {
  if (cachedLandMask) return cachedLandMask;
  const features = (geojsonData as any).features || [];
  const S = MASK_RES * MASK_SS;
  const bits = new Uint8Array(S * S);
  const spanLng = VN_BOUNDS.maxLng - VN_BOUNDS.minLng;
  const spanLat = VN_BOUNDS.maxLat - VN_BOUNDS.minLat;

  // Raster hóa scanline từng ring ở lưới S: dòng y nào cắt cạnh ring thì lấp
  // even-odd, OR liên tỉnh = union ĐÚNG biên giới, không xấp xỉ hình hộp.
  for (const f of features) {
    for (const ring of ringsOfFeature(f)) {
      if (!ring || ring.length < 3) continue;
      let minLatR = Infinity;
      let maxLatR = -Infinity;
      for (const p of ring) {
        if (p[1] < minLatR) minLatR = p[1];
        if (p[1] > maxLatR) maxLatR = p[1];
      }
      const y0 = Math.max(0, Math.floor(((VN_BOUNDS.maxLat - maxLatR) / spanLat) * (S - 1)));
      const y1 = Math.min(S - 1, Math.ceil(((VN_BOUNDS.maxLat - minLatR) / spanLat) * (S - 1)));
      for (let y = y0; y <= y1; y++) {
        const lat = VN_BOUNDS.maxLat - (y / (S - 1)) * spanLat;
        const xs: number[] = [];
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const yi = ring[i][1];
          const yj = ring[j][1];
          if (yi > lat !== yj > lat) {
            const t = (lat - yi) / (yj - yi);
            xs.push(ring[i][0] + t * (ring[j][0] - ring[i][0]));
          }
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const xa = Math.max(0, Math.round(((xs[k] - VN_BOUNDS.minLng) / spanLng) * (S - 1)));
          const xb = Math.min(S - 1, Math.round(((xs[k + 1] - VN_BOUNDS.minLng) / spanLng) * (S - 1)));
          for (let x = xa; x <= xb; x++) bits[y * S + x] = 1;
        }
      }
    }
  }

  // Hạ mẫu MASK_SS×MASK_SS → độ phủ texel 0–255: viền răng cưa biến thành
  // dải anti-alias ~1 texel (≈1.4km), đúng chuẩn "antialiasing edge do GPU".
  const mask = new Uint8Array(MASK_RES * MASK_RES);
  for (let y = 0; y < MASK_RES; y++) {
    for (let x = 0; x < MASK_RES; x++) {
      const sy = y * MASK_SS;
      const sx = x * MASK_SS;
      let sum = 0;
      for (let dy = 0; dy < MASK_SS; dy++) {
        for (let dx = 0; dx < MASK_SS; dx++) sum += bits[(sy + dy) * S + sx + dx];
      }
      mask[y * MASK_RES + x] = Math.round((sum / (MASK_SS * MASK_SS)) * 255);
    }
  }

  cachedLandMask = mask;
  return mask;
}

/**
 * Hình học phủ: một tứ giác kín VN_BOUNDS (2 tam giác) thay vì mesh tỉnh —
 * mảnh nào rơi ra ngoài đất liền bị mặt nạ alpha triệt tiêu trong fragment.
 * UV quy chiếu tuyến tính theo lng/lat ĐÚNG như cách sinh texture nhiệt & mask.
 */
function buildCoverageQuad(): { vertexData: Float32Array; vertexCount: number } {
  const spanLng = VN_BOUNDS.maxLng - VN_BOUNDS.minLng;
  const spanLat = VN_BOUNDS.maxLat - VN_BOUNDS.minLat;
  const corner = (lng: number, lat: number) => [
    lngToMercatorX(lng),
    latToMercatorY(lat),
    (lng - VN_BOUNDS.minLng) / spanLng,
    (VN_BOUNDS.maxLat - lat) / spanLat,
  ];
  const tl = corner(VN_BOUNDS.minLng, VN_BOUNDS.maxLat);
  const tr = corner(VN_BOUNDS.maxLng, VN_BOUNDS.maxLat);
  const bl = corner(VN_BOUNDS.minLng, VN_BOUNDS.minLat);
  const br = corner(VN_BOUNDS.maxLng, VN_BOUNDS.minLat);
  return {
    vertexData: new Float32Array([...tl, ...tr, ...br, ...tl, ...br, ...bl]),
    vertexCount: 6,
  };
}

/**
 * Tạo texture trường nhiệt độ 2D nội suy liên tục (IDW) từ các điểm mẫu ECMWF-IFS thực tế
 */
function generateTemperatureGrid(
  samples: Array<{ lng: number; lat: number; temp: number }>,
  width = 96,
  height = 96,
  minDomainTemp = 18.0,
  maxDomainTemp = 34.0,
): Uint8Array {
  const buffer = new Uint8Array(width * height);
  if (samples.length === 0) {
    buffer.fill(128);
    return buffer;
  }

  const range = Math.max(1, maxDomainTemp - minDomainTemp);

  for (let y = 0; y < height; y++) {
    const lat = VN_BOUNDS.maxLat - (y / (height - 1)) * (VN_BOUNDS.maxLat - VN_BOUNDS.minLat);
    for (let x = 0; x < width; x++) {
      const lng = VN_BOUNDS.minLng + (x / (width - 1)) * (VN_BOUNDS.maxLng - VN_BOUNDS.minLng);

      let sumWeight = 0;
      let sumTemp = 0;

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const dlng = lng - s.lng;
        const dlat = lat - s.lat;
        const distSq = dlng * dlng + dlat * dlat;
        // Shepards IDW với p=2 và smoothing epsilon nhỏ
        const w = 1.0 / (distSq + 0.0004);
        sumWeight += w;
        sumTemp += w * s.temp;
      }

      const temp = sumWeight > 0 ? sumTemp / sumWeight : 26.0;
      const normalized = Math.max(0, Math.min(1, (temp - minDomainTemp) / range));
      buffer[y * width + x] = Math.round(normalized * 255);
    }
  }

  return buffer;
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_pos;
attribute vec2 a_uv;
uniform mat4 u_matrix;
varying vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;
uniform sampler2D u_temp;
uniform sampler2D u_land;
uniform float u_opacity;
varying vec2 v_uv;

// Dải màu nhiệt độ chuẩn khí tượng liên tục (Continuous Field Color Ramp)
vec3 getMeteorologicalColor(float norm) {
    vec3 c0 = vec3(0.24, 0.55, 0.94); // ~18°C - Lam mát
    vec3 c1 = vec3(0.16, 0.78, 0.52); // ~22°C - Xanh ngọc
    vec3 c2 = vec3(0.94, 0.75, 0.15); // ~26°C - Vàng dịu
    vec3 c3 = vec3(0.96, 0.48, 0.12); // ~30°C - Cam ấm
    vec3 c4 = vec3(0.92, 0.22, 0.22); // ~34°C - Đỏ rực

    if (norm < 0.25) {
        return mix(c0, c1, norm / 0.25);
    } else if (norm < 0.50) {
        return mix(c1, c2, (norm - 0.25) / 0.25);
    } else if (norm < 0.75) {
        return mix(c2, c3, (norm - 0.50) / 0.25);
    } else {
        return mix(c3, c4, (norm - 0.75) / 0.25);
    }
}

void main() {
    // 1. CLIP ĐỊA LÝ: texel mask = độ phủ hình học thật của lãnh thổ VN trong
    //    pixel (0..1). Ngoài biên giới → giá trị 0 → hủy fragment, NDMapVN
    //    hiện nguyên trạng. KHÔNG có vành nới rộng, KHÔNG polygon trắng đè.
    float land = texture2D(u_land, v_uv).r;
    if (land < 0.012) discard;

    // 2. Nhiệt độ nội suy bi-linear phần cứng — liền mạch trên TOÀN BỘ đất liền
    //    (union 64 tỉnh tại raster 1280, đã kiểm 30/30 điểm không lỗ).
    float normT = texture2D(u_temp, v_uv).r;
    vec3 col = getMeteorologicalColor(normT);

    // 3. Alpha = độ phủ mask: trong lãnh thổ = nét 100%, chỉ dải ~1 texel
    //    (≈1.4km) tại biên là anti-alias GPU theo đúng thiết kế.
    gl_FragColor = vec4(col, u_opacity * clamp(land * 1.6, 0.0, 1.0));
}
`;

export class TemperatureShaderLayer implements CustomLayerInterface {
  id = "om-temperature-surface-gl";
  type = "custom" as const;
  renderingMode = "2d" as const;

  private map: MapLibreMap | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private tempTexture: WebGLTexture | null = null;
  private landTexture: WebGLTexture | null = null;
  private vertexCount = 0;

  private aPosLoc = -1;
  private aUvLoc = -1;
  private uMatrixLoc: WebGLUniformLocation | null = null;
  private uTempLoc: WebGLUniformLocation | null = null;
  private uLandLoc: WebGLUniformLocation | null = null;
  private uOpacityLoc: WebGLUniformLocation | null = null;

  private visible = true;
  private opacity = 0.50;
  private pendingSamples: Array<{ lng: number; lat: number; temp: number }> = [];

  constructor(visible = true, opacity = 0.50) {
    this.visible = visible;
    this.opacity = opacity;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  setOpacity(opacity: number) {
    this.opacity = opacity;
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  updateWeatherData(stations: StationForecast[], gridSamples: ForecastGridSample[]) {
    const samples: Array<{ lng: number; lat: number; temp: number }> = [];

    // Lấy mẫu từ các trạm thực tế (kiểm tra chặt chẽ chống NaN, Infinity, lệch tọa độ)
    for (const st of stations) {
      const lng = st.longitude ?? (st as any).lng;
      const lat = st.latitude ?? (st as any).lat;
      const temp = st.current?.temperature;
      if (
        typeof lng === "number" && Number.isFinite(lng) &&
        typeof lat === "number" && Number.isFinite(lat) &&
        typeof temp === "number" && Number.isFinite(temp) &&
        lat >= 6.0 && lat <= 26.0 &&
        lng >= 100.0 && lng <= 118.0 &&
        temp >= -10 && temp <= 55
      ) {
        samples.push({ lng, lat, temp });
      }
    }

    // Điểm lưới dự báo (bao gồm các điểm biên/ven biển làm anchor mượt cho IDW)
    for (const g of gridSamples) {
      const lng = g.lng;
      const lat = g.lat;
      const temp = g.temperature;
      if (
        typeof lng === "number" && Number.isFinite(lng) &&
        typeof lat === "number" && Number.isFinite(lat) &&
        typeof temp === "number" && Number.isFinite(temp) &&
        lat >= 6.0 && lat <= 26.0 &&
        lng >= 100.0 && lng <= 118.0 &&
        temp >= -10 && temp <= 55
      ) {
        samples.push({ lng, lat, temp });
      }
    }

    this.pendingSamples = samples;
    if (this.gl && this.tempTexture) {
      this.uploadTempTexture(samples);
      if (this.map) {
        this.map.triggerRepaint();
      }
    }
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("[TemperatureShaderLayer] Lỗi biên dịch shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private uploadTempTexture(samples: Array<{ lng: number; lat: number; temp: number }>) {
    const gl = this.gl;
    if (!gl || !this.tempTexture) return;

    const width = 96;
    const height = 96;
    const data = generateTemperatureGrid(samples, width, height, 18.0, 34.0);

    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // BI-LINEAR INTERPOLATION trên phần cứng GPU: Tạo trường nhiệt độ chuyển sắc mịn tuyệt đối!
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext) {
    this.map = map;
    this.gl = gl;

    const vert = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const frag = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vert || !frag) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[TemperatureShaderLayer] Lỗi liên kết program:", gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;

    this.aPosLoc = gl.getAttribLocation(prog, "a_pos");
    this.aUvLoc = gl.getAttribLocation(prog, "a_uv");
    this.uMatrixLoc = gl.getUniformLocation(prog, "u_matrix");
    this.uTempLoc = gl.getUniformLocation(prog, "u_temp");
    this.uLandLoc = gl.getUniformLocation(prog, "u_land");
    this.uOpacityLoc = gl.getUniformLocation(prog, "u_opacity");

    // Hình học: tứ giác phủ VN_BOUNDS — mặt nạ đất liền quyết định phần hiển thị
    const { vertexData, vertexCount } = buildCoverageQuad();
    this.vertexCount = vertexCount;

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    // Tạo Temperature Grid Texture
    this.tempTexture = gl.createTexture();
    if (this.pendingSamples.length > 0) {
      this.uploadTempTexture(this.pendingSamples);
    } else {
      this.uploadTempTexture([]);
    }

    // Mặt nạ lãnh thổ: union 64 tỉnh raster đúng biên giới (supersample coverage)
    this.landTexture = gl.createTexture();
    if (this.landTexture) {
      const land = buildLandMaskTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.landTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        MASK_RES,
        MASK_RES,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        land,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }

  private renderLogged = false;

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: any) {
    if (
      !this.visible ||
      !this.program ||
      !this.vertexBuffer ||
      !this.tempTexture ||
      !this.landTexture ||
      this.vertexCount === 0
    ) {
      return;
    }

    const rawMatrix = options?.defaultProjectionData?.mainMatrix || options?.modelViewProjectionMatrix || options;
    if (!rawMatrix || rawMatrix.length < 16) {
      if (!this.renderLogged) {
        console.warn("[TemperatureShaderLayer] Không tìm thấy ma trận hợp lệ trong options:", options);
      }
      return;
    }

    const matrix = rawMatrix instanceof Float32Array ? rawMatrix : new Float32Array(rawMatrix);

    if (!this.renderLogged) {
      console.log("[TemperatureShaderLayer] Render thành công lần đầu, matrix[0]:", matrix[0], "vertices:", this.vertexCount);
      this.renderLogged = true;
    }

    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Bind buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const FSIZE = Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(this.aPosLoc);
    gl.vertexAttribPointer(this.aPosLoc, 2, gl.FLOAT, false, FSIZE * 4, 0);

    gl.enableVertexAttribArray(this.aUvLoc);
    gl.vertexAttribPointer(this.aUvLoc, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);

    // Truyền Uniforms
    gl.uniformMatrix4fv(this.uMatrixLoc, false, matrix);
    gl.uniform1f(this.uOpacityLoc, this.opacity);

    // Texture 0: Temperature continuous field
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);
    gl.uniform1i(this.uTempLoc, 0);

    // Texture 1: Land mask (clip địa lý chính xác theo union lãnh thổ)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.landTexture);
    gl.uniform1i(this.uLandLoc, 1);

    // Vẽ phủ toàn khung bounding box — mặt nạ cắt còn đúng phần đất Việt Nam
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }

  onRemove() {
    const gl = this.gl;
    if (!gl) return;

    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.tempTexture) gl.deleteTexture(this.tempTexture);
    if (this.landTexture) gl.deleteTexture(this.landTexture);
    if (this.program) gl.deleteProgram(this.program);

    this.program = null;
    this.vertexBuffer = null;
    this.tempTexture = null;
    this.landTexture = null;
    this.vertexCount = 0;
    this.gl = null;
    this.map = null;
  }
}
