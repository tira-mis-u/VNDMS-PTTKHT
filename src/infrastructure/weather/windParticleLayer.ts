/**
 * LỚP HẠT GIÓ ĐỘNG (WIND PARTICLE LAYER) — phong cách bản đồ Windy
 *
 * Vẽ hàng nghìn hạt trôi theo trường gió 10m của ECMWF-IFS lên một canvas 2D
 * phủ trên bản đồ MapLibre. Không có thanh tua thời gian hay nút play/pause:
 * dòng gió chảy liên tục và tự nhiên đúng như nền bản đồ thời tiết thật.
 *
 * Kiến trúc:
 * 1. `WindField` — nội suy trường gió (u, v) từ các điểm lấy mẫu rời rạc
 *    (lưới đất liền + lưới biển) thành một lattice đều để tra cứu O(1);
 *    xoáy thuận nhiệt đới được cộng thêm dưới dạng vortex giải tích nên hạt
 *    gió xoáy quanh tâm bão giống ảnh vệ tinh.
 * 2. `WindParticleLayer` — vòng lặp requestAnimationFrame: mờ dần khung cũ để
 *    tạo vệt, đẩy từng hạt theo (u, v), hồi sinh hạt hết tuổi thọ.
 *
 * Toàn bộ tính toán chạy trên client từ dữ liệu đã tải sẵn — không gọi API
 * trong vòng lặp vẽ.
 */

import type { Map as MapLibreMap } from "maplibre-gl";
import type { StormTrack } from "./stormDetection";

export interface WindSamplePoint {
  lat: number;
  lng: number;
  /** km/h */
  windSpeed: number;
  /** Độ, hướng gió THỔI TỪ (quy ước khí tượng). */
  windDirection: number;
}

const FIELD_LNG_MIN = 99;
const FIELD_LNG_MAX = 123;
const FIELD_LAT_MIN = 3;
const FIELD_LAT_MAX = 26;
const FIELD_STEP = 0.4;

/** Trường gió nội suy trên lattice đều, tra cứu bằng nội suy song tuyến tính. */
export class WindField {
  private readonly nx: number;
  private readonly ny: number;
  private readonly u: Float32Array;
  private readonly v: Float32Array;
  readonly maxSpeed: number;

  constructor(samples: WindSamplePoint[], storms: StormTrack[] = []) {
    this.nx = Math.round((FIELD_LNG_MAX - FIELD_LNG_MIN) / FIELD_STEP) + 1;
    this.ny = Math.round((FIELD_LAT_MAX - FIELD_LAT_MIN) / FIELD_STEP) + 1;
    this.u = new Float32Array(this.nx * this.ny);
    this.v = new Float32Array(this.nx * this.ny);

    const usable = samples.filter(
      (sample) =>
        Number.isFinite(sample.lat) &&
        Number.isFinite(sample.lng) &&
        Number.isFinite(sample.windSpeed) &&
        Number.isFinite(sample.windDirection),
    );

    // Thành phần (u, v) của từng điểm quan trắc: hướng khí tượng là hướng gió
    // thổi TỪ, nên vector chuyển động ngược lại.
    const vectors = usable.map((sample) => {
      const rad = (sample.windDirection * Math.PI) / 180;
      return {
        lat: sample.lat,
        lng: sample.lng,
        u: -sample.windSpeed * Math.sin(rad),
        v: -sample.windSpeed * Math.cos(rad),
      };
    });

    let maxSpeed = 1;
    for (let j = 0; j < this.ny; j += 1) {
      const lat = FIELD_LAT_MIN + j * FIELD_STEP;
      for (let i = 0; i < this.nx; i += 1) {
        const lng = FIELD_LNG_MIN + i * FIELD_STEP;

        // Nội suy nghịch đảo khoảng cách có bán kính ảnh hưởng giới hạn
        let wsum = 0;
        let usum = 0;
        let vsum = 0;
        for (const vec of vectors) {
          const dx = lng - vec.lng;
          const dy = lat - vec.lat;
          const d2 = dx * dx + dy * dy;
          if (d2 > 25) continue; // > ~5° thì bỏ qua
          const w = 1 / (d2 + 0.35);
          wsum += w;
          usum += vec.u * w;
          vsum += vec.v * w;
        }

        let u = wsum > 0 ? usum / wsum : 0;
        let v = wsum > 0 ? vsum / wsum : 0;

        // Cộng thêm hoàn lưu xoáy thuận (bắc bán cầu: ngược chiều kim đồng hồ)
        for (const storm of storms) {
          const centre = storm.current;
          const dx = (lng - centre.lng) * Math.cos((lat * Math.PI) / 180);
          const dy = lat - centre.lat;
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r < 0.02 || r > 6) continue;
          const rmax = Math.max(0.6, centre.radiusKm / 111);
          // Profile Rankine: tăng tuyến tính trong mắt bão, giảm 1/r bên ngoài
          const strength =
            r <= rmax
              ? (storm.maxWind * r) / rmax
              : (storm.maxWind * rmax) / r;
          // Tắt dần nhanh hơn ở rìa để hoàn lưu hoà vào gió mùa nền, tránh
          // hiệu ứng "vòng tròn đồng tâm" trông thiếu tự nhiên.
          const decay = Math.exp(-Math.max(0, r - rmax) / 2.2);
          const tangential = strength * decay * 0.85;
          // Tiếp tuyến ngược chiều kim đồng hồ + góc hút vào tâm ~20° như thực tế
          const inflow = 0.36;
          u += (-dy / r) * tangential - (dx / r) * tangential * inflow;
          v += (dx / r) * tangential - (dy / r) * tangential * inflow;
        }

        const index = j * this.nx + i;
        this.u[index] = u;
        this.v[index] = v;
        const speed = Math.hypot(u, v);
        if (speed > maxSpeed) maxSpeed = speed;
      }
    }
    this.maxSpeed = maxSpeed;
  }

  /** Tra cứu (u, v) theo km/h tại một tọa độ bất kỳ. */
  sample(lng: number, lat: number): { u: number; v: number } | null {
    if (lng < FIELD_LNG_MIN || lng > FIELD_LNG_MAX) return null;
    if (lat < FIELD_LAT_MIN || lat > FIELD_LAT_MAX) return null;
    const fx = (lng - FIELD_LNG_MIN) / FIELD_STEP;
    const fy = (lat - FIELD_LAT_MIN) / FIELD_STEP;
    const i = Math.min(this.nx - 2, Math.max(0, Math.floor(fx)));
    const j = Math.min(this.ny - 2, Math.max(0, Math.floor(fy)));
    const tx = fx - i;
    const ty = fy - j;
    const idx = (a: number, b: number) => b * this.nx + a;
    const u =
      this.u[idx(i, j)] * (1 - tx) * (1 - ty) +
      this.u[idx(i + 1, j)] * tx * (1 - ty) +
      this.u[idx(i, j + 1)] * (1 - tx) * ty +
      this.u[idx(i + 1, j + 1)] * tx * ty;
    const v =
      this.v[idx(i, j)] * (1 - tx) * (1 - ty) +
      this.v[idx(i + 1, j)] * tx * (1 - ty) +
      this.v[idx(i, j + 1)] * (1 - tx) * ty +
      this.v[idx(i + 1, j + 1)] * tx * ty;
    return { u, v };
  }
}

interface Particle {
  lng: number;
  lat: number;
  age: number;
  maxAge: number;
}

/**
 * Bảng màu theo tốc độ gió (km/h). Nền bản đồ NDAMapVN sáng màu nên hạt gió
 * dùng tông xanh đậm khi gió nhẹ và chuyển sang cam/đỏ khi đạt cấp bão để vẫn
 * đọc được rõ mà không phủ kín địa hình.
 */
function speedColor(speed: number): string {
  if (speed > 118) return "rgba(190, 24, 24, 0.95)";
  if (speed > 88) return "rgba(217, 90, 12, 0.9)";
  if (speed > 62) return "rgba(202, 138, 4, 0.88)";
  if (speed > 39) return "rgba(12, 116, 160, 0.85)";
  if (speed > 20) return "rgba(28, 86, 146, 0.75)";
  return "rgba(45, 92, 142, 0.6)";
}

export class WindParticleLayer {
  private readonly map: MapLibreMap;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private field: WindField | null = null;
  private frame: number | null = null;
  private running = false;
  private dpr = 1;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "om-wind-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Không khởi tạo được canvas 2D cho lớp gió");
    this.ctx = context;
    // Chèn ngay sau canvas WebGL của MapLibre: nằm trên nền bản đồ nhưng vẫn
    // dưới mọi Marker DOM (marker được thêm sau nên vẽ đè lên).
    const container = map.getCanvasContainer();
    const glCanvas = container.querySelector("canvas");
    if (glCanvas && glCanvas.nextSibling) container.insertBefore(this.canvas, glCanvas.nextSibling);
    else container.appendChild(this.canvas);
    this.resize();

    this.onResize = this.onResize.bind(this);
    this.onMoveStart = this.onMoveStart.bind(this);
    this.onMoveEnd = this.onMoveEnd.bind(this);
    map.on("resize", this.onResize);
    map.on("movestart", this.onMoveStart);
    map.on("moveend", this.onMoveEnd);
    map.on("zoomstart", this.onMoveStart);
    map.on("zoomend", this.onMoveEnd);
  }

  /** Cập nhật trường gió khi có dữ liệu ECMWF mới (lưới đất liền, biển, bão). */
  setField(samples: WindSamplePoint[], storms: StormTrack[]) {
    if (!samples.length) return;
    this.field = new WindField(samples, storms);
    this.seedParticles();
    if (!this.running) this.start();
  }

  start() {
    if (this.running || !this.field) return;
    this.running = true;
    this.canvas.style.opacity = "1";
    const loop = () => {
      if (!this.running) return;
      this.step();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy() {
    this.stop();
    this.map.off("resize", this.onResize);
    this.map.off("movestart", this.onMoveStart);
    this.map.off("moveend", this.onMoveEnd);
    this.map.off("zoomstart", this.onMoveStart);
    this.map.off("zoomend", this.onMoveEnd);
    this.canvas.remove();
  }

  private onResize() {
    this.resize();
    this.seedParticles();
  }

  /** Trong lúc kéo/zoom, ẩn vệt gió để không bị "trượt" lệch khỏi bản đồ. */
  private onMoveStart() {
    this.canvas.style.opacity = "0";
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private onMoveEnd() {
    this.seedParticles();
    this.canvas.style.opacity = "1";
  }

  private resize() {
    // .maplibregl-canvas-container không có kích thước nội tại (con của nó
    // được định vị tuyệt đối), nên phải đo theo container gốc của bản đồ.
    const container = this.map.getContainer();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = Math.max(1, Math.floor(width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(height * this.dpr));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private randomParticle(): Particle {
    const bounds = this.map.getBounds();
    const lng =
      bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
    const lat =
      bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
    return { lng, lat, age: 0, maxAge: 40 + Math.random() * 90 };
  }

  private seedParticles() {
    const container = this.map.getContainer();
    const area = container.clientWidth * container.clientHeight;
    // Mật độ vừa phải: đủ dày để thấy dòng chảy, đủ nhẹ để giữ 60 FPS.
    const count = Math.max(320, Math.min(1600, Math.round(area / 1400)));
    this.particles = Array.from({ length: count }, () => {
      const particle = this.randomParticle();
      particle.age = Math.random() * particle.maxAge;
      return particle;
    });
  }

  private step() {
    const field = this.field;
    if (!field) return;
    const { ctx, canvas } = this;
    const width = canvas.width / this.dpr;
    const height = canvas.height / this.dpr;

    // Làm mờ khung trước để tạo vệt gió mượt thay vì xoá sạch
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0, 0, 0, 0.90)";
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = "source-over";

    const zoom = this.map.getZoom();
    // Hệ số chuyển km/h → độ mỗi khung hình; càng zoom sâu càng chậm lại để
    // vận tốc biểu kiến trên màn hình giữ nguyên cảm giác tự nhiên.
    const speedFactor = 0.00045 * Math.pow(2, 6.5 - zoom) * 6;
    ctx.lineWidth = zoom > 8 ? 1.4 : 1.05;
    ctx.lineCap = "round";

    for (const particle of this.particles) {
      const wind = field.sample(particle.lng, particle.lat);
      if (!wind) {
        Object.assign(particle, this.randomParticle());
        continue;
      }
      const speed = Math.hypot(wind.u, wind.v);
      const latRad = (particle.lat * Math.PI) / 180;
      const nextLng =
        particle.lng + (wind.u * speedFactor) / Math.max(0.2, Math.cos(latRad));
      const nextLat = particle.lat + wind.v * speedFactor;

      const from = this.map.project([particle.lng, particle.lat]);
      const to = this.map.project([nextLng, nextLat]);

      if (
        from.x > -60 &&
        from.x < width + 60 &&
        from.y > -60 &&
        from.y < height + 60
      ) {
        ctx.strokeStyle = speedColor(speed);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }

      particle.lng = nextLng;
      particle.lat = nextLat;
      particle.age += 1;
      if (particle.age > particle.maxAge) Object.assign(particle, this.randomParticle());
    }
  }
}
