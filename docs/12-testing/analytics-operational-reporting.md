# Kiểm thử — Analytics & Operational Reporting

## Focused application tests

`tests/application/analytics-reporting.test.ts` kiểm tra:

- operational aggregation;
- date/period và geographic filter;
- Incident timing;
- Task overdue/completion/unassigned;
- Team utilization;
- Shelter occupancy/overload;
- SOS response/bottleneck;
- Relief shortage/low stock;
- Recovery damage/progress/budget;
- report content, metric basis, navigation path và audit metadata.

## Regression gate

Chạy `npx --yes tsx --test tests/**/*.test.ts`, sau đó `npm run lint` và `npm run build`.

## Route verification

Kiểm tra HTTP 200 cho `/analytics`, `/analytics/operations`, `/analytics/resources`, `/analytics/incidents`, `/analytics/reports` cùng các route regression của module hiện hữu.

## UX verification

Xác nhận drill-down dùng custom History API router; report in ẩn shell/filter; không có emoji, icon ngoài Lucide, fake map, architecture/store trùng lặp hoặc business calculation trong JSX.
