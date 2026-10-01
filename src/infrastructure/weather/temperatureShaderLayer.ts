import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import earcut from "earcut";
import geojsonData from "../../data/gis/geoBoundaries-VNM-ADM1_simplified.json" with { type: "json" };
import type { ForecastGridSample, StationForecast } from "./ecmwfWeatherService";

// Sampling extent for the existing VNM ADM1 geometry. This is only the texture
// coordinate frame; territory inclusion is decided exclusively by the geometry mask.
// maxLng must include the ADM1 dataset's easternmost point (~114.997°E).
const VN_BOUNDS = {
  minLng: 102.0,
  maxLng: 115.0,
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
 * Build a cached triangle mesh from each ADM1 Polygon/MultiPolygon.
 * Earcut receives every ring of each GeoJSON Polygon, so holes are respected;
 * provinces remain separate fill components but share the original boundary
 * coordinates and do not pass through a fixed-resolution raster mask.
 * Coordinates are triangulated in Web Mercator, matching MapLibre's matrix.
 */
let cachedTerritoryMesh: { vertexData: Float32Array; vertexCount: number } | null = null;

function polygonsOfFeature(feature: any): number[][][][] {
  const geom = feature?.geometry;
  if (!geom) return [];
  return geom.type === "Polygon"
    ? [geom.coordinates]
    : geom.type === "MultiPolygon"
      ? geom.coordinates
      : [];
}

function buildTerritoryMesh(): { vertexData: Float32Array; vertexCount: number } {
  if (cachedTerritoryMesh) return cachedTerritoryMesh;
  const data: number[] = [];
  const features = (geojsonData as any).features || [];
  const mercatorNorth = latToMercatorY(VN_BOUNDS.maxLat);
  const mercatorSouth = latToMercatorY(VN_BOUNDS.minLat);
  const spanX = VN_BOUNDS.maxLng - VN_BOUNDS.minLng;
  const spanY = mercatorSouth - mercatorNorth;

  for (const feature of features) {
    for (const polygon of polygonsOfFeature(feature)) {
      const rings = polygon.filter((ring) => ring && ring.length >= 4);
      if (!rings.length) continue;
      const vertices: number[] = [];
      const holes: number[] = [];
      for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const ring = rings[ringIndex];
        if (ringIndex > 0) holes.push(vertices.length / 2);
        const closes = ring.length > 1 &&
          ring[0][0] === ring[ring.length - 1][0] &&
          ring[0][1] === ring[ring.length - 1][1];
        const vertexLength = closes ? ring.length - 1 : ring.length;
        for (let i = 0; i < vertexLength; i++) vertices.push(ring[i][0], ring[i][1]);
      }
      const indices = earcut(vertices, holes, 2);
      for (const index of indices) {
        const lng = vertices[index * 2];
        const lat = vertices[index * 2 + 1];
        const x = lngToMercatorX(lng);
        const y = latToMercatorY(lat);
        const u = (lng - VN_BOUNDS.minLng) / spanX;
        const v = (y - mercatorNorth) / spanY;
        data.push(x, y, u, v);
      }
    }
  }

  cachedTerritoryMesh = {
    vertexData: new Float32Array(data),
    vertexCount: data.length / 4,
  };
  return cachedTerritoryMesh;
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

  const mercatorNorth = latToMercatorY(VN_BOUNDS.maxLat);
  const mercatorSouth = latToMercatorY(VN_BOUNDS.minLat);
  for (let y = 0; y < height; y++) {
    const mercatorY = mercatorNorth + (y / (height - 1)) * (mercatorSouth - mercatorNorth);
    const lat = (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * mercatorY))) - Math.PI / 2) * (180 / Math.PI);
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
uniform float u_opacity;
uniform float u_debug_solid;
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
    // Debug solid bypasses the temperature texture and production alpha.
    if (u_debug_solid > 0.5) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        return;
    }

    float normT = texture2D(u_temp, v_uv).r;
    vec3 col = getMeteorologicalColor(normT);
    gl_FragColor = vec4(col, u_opacity);
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
  private vertexCount = 0;

  private aPosLoc = -1;
  private aUvLoc = -1;
  private uMatrixLoc: WebGLUniformLocation | null = null;
  private uTempLoc: WebGLUniformLocation | null = null;
  private uOpacityLoc: WebGLUniformLocation | null = null;
  private uDebugSolidLoc: WebGLUniformLocation | null = null;

  private debugSolid = false;
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

  setDebugSolid(enabled: boolean) {
    this.debugSolid = enabled;
    this.map?.triggerRepaint();
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
    this.uOpacityLoc = gl.getUniformLocation(prog, "u_opacity");
    this.uDebugSolidLoc = gl.getUniformLocation(prog, "u_debug_solid");

    // Tessellated territory mesh is cached in geographic coordinates projected
    // to the same normalized Web Mercator world used by MapLibre's matrix.
    const { vertexData, vertexCount } = buildTerritoryMesh();
    this.vertexCount = vertexCount;
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

    this.tempTexture = gl.createTexture();
    this.uploadTempTexture(this.pendingSamples);
  }

  private renderLogged = false;

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: any) {
    if (
      !this.visible ||
      !this.program ||
      !this.vertexBuffer ||
      !this.tempTexture ||
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
    gl.uniform1f(this.uDebugSolidLoc, this.debugSolid ? 1 : 0);

    // Texture 0: Temperature continuous field
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tempTexture);
    gl.uniform1i(this.uTempLoc, 0);

    // Draw the cached ADM1 triangle mesh; map water/labels remain in their existing layers.
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }

  onRemove() {
    const gl = this.gl;
    if (!gl) return;

    if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
    if (this.tempTexture) gl.deleteTexture(this.tempTexture);
    if (this.program) gl.deleteProgram(this.program);

    this.program = null;
    this.vertexBuffer = null;
    this.tempTexture = null;
    this.vertexCount = 0;
    this.gl = null;
    this.map = null;
  }
}
