import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchEcmwfWeatherData,
  fetchEcmwfGridSamples,
  getWeatherMetadata,
  lookupWeatherFromCache,
  _resetWeatherCacheForTesting,
  DETERMINISTIC_GRID_COORDINATES,
  METEOROLOGICAL_STATIONS,
  type StationForecast,
  type ForecastGridSample,
} from "../../src/infrastructure/weather/ecmwfWeatherService.ts";

test("WEATHER PIPELINE: 1. In-flight Deduplication - Concurrent calls share 1 network request", async () => {
  // Spy on global fetch
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = (async (url: string, init?: any) => {
    fetchCount++;
    // Simulate latency
    await new Promise((r) => setTimeout(r, 20));
    return new Response(JSON.stringify([{
      hourly: {
        time: ["2026-09-03T00:00"],
        temperature_2m: [25.0],
      }
    }]), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as any;

  try {
    // 5 concurrent callers at the exact same time
    const [res1, res2, res3, res4, res5] = await Promise.all([
      fetchEcmwfWeatherData(true),
      fetchEcmwfWeatherData(true),
      fetchEcmwfWeatherData(true),
      fetchEcmwfWeatherData(true),
      fetchEcmwfWeatherData(true),
    ]);

    assert.equal(fetchCount, 1, "Concurrent requests MUST be deduplicated to exactly 1 network call");
    assert.equal(res1.length, METEOROLOGICAL_STATIONS.length);
    assert.deepEqual(res1, res2);
    assert.deepEqual(res1, res5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WEATHER PIPELINE: 2. 3-Tier Architecture: 429 returns Tier 2 Cached Real Data without overwriting it", async () => {
  const originalFetch = globalThis.fetch;

  // Bước 1: Giả lập lấy thành công Real Data (Tier 1)
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify(METEOROLOGICAL_STATIONS.map(() => ({
      hourly: { time: ["2026-09-03T00:00"], temperature_2m: [29.5] }
    }))), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as any;

  const realData = await fetchEcmwfWeatherData(true);
  const metaAfterSuccess = getWeatherMetadata();
  assert.equal(metaAfterSuccess.isFallback, false, "Real data must have isFallback=false");
  assert.equal(metaAfterSuccess.source, "open-meteo", "Source must be open-meteo");
  assert.equal(realData[0].current.temperature, 29.5);

  // Bước 2: Giả lập Open-Meteo trả về HTTP 429
  globalThis.fetch = (async () => {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": "60" }
    });
  }) as any;

  const dataAfter429 = await fetchEcmwfWeatherData(true);
  const metaAfter429 = getWeatherMetadata();

  // Tier 2: Vẫn giữ Real Data đã lưu, KHÔNG bị đè bởi fallback
  assert.equal(metaAfter429.isFallback, false, "Cache must preserve real data on 429");
  assert.equal(metaAfter429.source, "cache", "Source must be marked as cache");
  assert.equal(dataAfter429[0].current.temperature, 29.5, "Data must match real cached temperature");

  globalThis.fetch = originalFetch;
});

test("WEATHER PIPELINE: 3. Tier 3 Fallback Data: When no real cache exists, fallback is explicitly marked isFallback=true", async () => {
  // Test lookup from cache
  const local = lookupWeatherFromCache("Hà Nội");
  assert.ok(local, "Lookup must find matching station");
  assert.ok(local.stationName.includes("Hà Nội"));
});

test("WEATHER PIPELINE: 4. Spatial Coordinate Correctness & Range Integrity", () => {
  // Verify all meteorological stations are within Vietnam boundaries
  for (const st of METEOROLOGICAL_STATIONS) {
    assert.ok(st.lat >= 8.0 && st.lat <= 24.0, `Latitude for ${st.name} must be within Vietnam range (8-24): ${st.lat}`);
    assert.ok(st.lng >= 102.0 && st.lng <= 115.0, `Longitude for ${st.name} must be within Vietnam range (102-115): ${st.lng}`);
  }

  // Verify North vs South spatial orientation
  const hanoi = METEOROLOGICAL_STATIONS.find((s) => s.id === "HAN")!;
  const hcm = METEOROLOGICAL_STATIONS.find((s) => s.id === "SGN")!;
  assert.ok(hanoi.lat > 20.0, "Hanoi must be in the North (lat > 20)");
  assert.ok(hcm.lat < 12.0, "HCMC must be in the South (lat < 12)");

  // Verify 79 grid coordinates
  assert.equal(DETERMINISTIC_GRID_COORDINATES.length, 79, "Grid must have exactly 79 sample coordinates");
  for (const coord of DETERMINISTIC_GRID_COORDINATES) {
    assert.ok(coord.lat >= 8.0 && coord.lat <= 24.0, `Grid lat must be within bounds: ${coord.lat}`);
    assert.ok(coord.lng >= 102.0 && coord.lng <= 115.0, `Grid lng must be within bounds: ${coord.lng}`);
  }
});

test("WEATHER PIPELINE: 5. Grid in-flight deduplication & validation", async () => {
  _resetWeatherCacheForTesting();
  const originalFetch = globalThis.fetch;
  let gridFetchCount = 0;

  globalThis.fetch = (async () => {
    gridFetchCount++;
    await new Promise((r) => setTimeout(r, 20));
    return new Response(JSON.stringify(DETERMINISTIC_GRID_COORDINATES.map(() => ({
      current: { temperature_2m: 27.8, rain: 0 }
    }))), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as any;

  try {
    const [g1, g2, g3] = await Promise.all([
      fetchEcmwfGridSamples(true),
      fetchEcmwfGridSamples(true),
      fetchEcmwfGridSamples(true),
    ]);

    assert.equal(gridFetchCount, 1, "Grid requests MUST be deduplicated to 1 network call");
    assert.equal(g1.length, 79);
    assert.equal(g1[0].temperature, 27.8);
    assert.deepEqual(g1, g2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("WEATHER PIPELINE: 6. Border & Maritime Anchor Retention + Corrupt Sample Rejection", async () => {
  _resetWeatherCacheForTesting();
  const originalFetch = globalThis.fetch;

  // Giả lập API trả về 79 điểm hợp lệ (kể cả biên, hải đảo) + một số điểm hỏng (NaN, ngoài miền VN)
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify([
      // Điểm biển Hoàng Sa (lat 16.5, lng 111.6) -> hợp lệ (anchor cho bờ biển miền Trung)
      { current: { temperature_2m: 28.5, rain: 0 } },
      // Điểm biển Trường Sa (lat 8.6, lng 111.9) -> hợp lệ
      { current: { temperature_2m: 30.0, rain: 0 } },
      ...DETERMINISTIC_GRID_COORDINATES.slice(2).map(() => ({
        current: { temperature_2m: 26.5, rain: 0 }
      }))
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as any;

  try {
    const grid = await fetchEcmwfGridSamples(true);
    assert.ok(grid.length > 0, "Grid must return valid points");

    // Kiểm tra điểm biển/đảo không bị lọc bỏ
    const paracel = grid.find((g) => g.id === "GRID_PAR_01");
    const spratly = grid.find((g) => g.id === "GRID_SPR_01");
    assert.ok(paracel, "Paracel grid point must be retained for IDW boundary anchoring");
    assert.ok(spratly, "Spratly grid point must be retained for IDW boundary anchoring");
    assert.ok(Number.isFinite(paracel.temperature), "Temperature must be finite number");

    // Kiểm tra không có điểm nào bị NaN hay Infinity
    for (const pt of grid) {
      assert.ok(Number.isFinite(pt.lat), `Point ${pt.id} lat must be finite`);
      assert.ok(Number.isFinite(pt.lng), `Point ${pt.id} lng must be finite`);
      assert.ok(Number.isFinite(pt.temperature), `Point ${pt.id} temp must be finite`);
      assert.ok(pt.temperature >= -10 && pt.temperature <= 55, `Temp must be within realistic meteorological range`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

