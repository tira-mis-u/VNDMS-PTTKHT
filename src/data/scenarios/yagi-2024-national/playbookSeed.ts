import { PERSONNEL, personName } from "../../identity/personnel";
import type { UserRole } from "../../../domain/shared/auth";
import type {
  Playbook,
  PlaybookLegalBasis,
  PlaybookExecution,
  PlaybookStep,
  PlaybookStepExecution,
  PlaybookTimelineEvent,
} from "../../../domain/playbooks/types";

const PLAYBOOK_ID = "PB-YAGI-2024";
const EXECUTION_ID = "PBX-YAGI-01";

type StepSpec = {
  order: number;
  id: string;
  name: string;
  type: PlaybookStep["type"];
  required: boolean;
  prerequisites: string[];
  criteria: string[];
  role: string;
  userRole: UserRole;
  /** Giờ so với "giờ 0" = thời điểm bão đổ bộ (âm = trước bão). */
  leadTimeHours: number;
  riskLevels: number[];
  legalBasis: PlaybookLegalBasis;
  teamType?: string | null;
  description?: string;
  duration?: string;
};

const step = (spec: StepSpec): PlaybookStep => ({
  id: spec.id,
  playbookId: PLAYBOOK_ID,
  order: spec.order,
  name: spec.name,
  description:
    spec.description ??
    `Thực hiện ${spec.name.toLowerCase()} trong ứng phó Bão Yagi 2024 quy mô quốc gia.`,
  objective: spec.name,
  type: spec.type,
  status: "Chờ",
  required: spec.required,
  estimatedDuration: spec.duration ?? (spec.leadTimeHours < 0 ? "2–6 giờ" : "30–90 phút"),
  responsibleRole: spec.role,
  responsibleUserRole: spec.userRole,
  responsibleTeamType: spec.teamType ?? null,
  leadTimeHours: spec.leadTimeHours,
  riskLevels: spec.riskLevels,
  legalBasis: spec.legalBasis,
  prerequisites: spec.prerequisites,
  completionCriteria: spec.criteria,
  startedAt: null,
  completedAt: null,
  completedBy: null,
});

export const initialPlaybooks: Playbook[] = [
  {
    id: PLAYBOOK_ID,
    code: PLAYBOOK_ID,
    name: "Ứng phó Bão Yagi 2024 — Quốc gia",
    description:
      "Quy trình chuẩn hóa tổng thể: đánh giá tình hình, kích hoạt cảnh báo, điều động lực lượng, tìm kiếm cứu nạn, sơ tán, bảo đảm hậu cần cứu trợ và điều phối khôi phục sau bão Yagi 2024.",
    disasterType: "Bão nhiệt đới, lũ lụt, lũ quét, sạt lở đất",
    triggerConditions: [
      "Bão đổ bộ đất liền hoặc hoàn lưu gây mưa lớn",
      "Cảnh báo lũ quét / sạt lở đất tại khu vực miền núi",
      "Mực nước sông vượt báo động II tại bất kỳ trạm đo nào",
      "Có người chết, mất tích hoặc bị cô lập do thiên tai",
    ],
    severityThreshold: "Cao",
    geographicScope: "Toàn quốc — ưu tiên các tỉnh miền Bắc",
    status: "Đã xuất bản",
    version: "1.0",
    owner: {
      name: personName(PERSONNEL.COMMANDER.id),
      role: "Chỉ huy ứng phó quốc gia",
      organization: "Ban Chỉ đạo Quốc gia về Phòng, chống Thiên tai",
    },
    estimatedDuration: "24–72 giờ",
    createdAt: "01/09/2024 08:00",
    updatedAt: "07/09/2024 06:00",
    steps: [
      // ── TRƯỚC BÃO (giờ 0 = thời điểm bão đổ bộ) ──────────────────────────
      // Khối này bổ sung đợt 7: trước đây phương án chỉ có các bước SAU va
      // chạm, tức là mô tả một cuộc khắc phục chứ không phải một cuộc ứng phó.
      step({
        order: 1, id: "PBS-Y-P72",
        name: "Rà soát công trình trọng điểm, hồ chứa và đê xung yếu",
        description:
          "Kiểm tra hiện trạng đê điều, hồ chứa, cầu yếu, cột điện, trường học và bệnh viện trong vùng dự kiến ảnh hưởng; lập danh sách công trình phải gia cố hoặc hạ mực nước đón lũ.",
        type: "Đánh giá", required: true, prerequisites: [],
        criteria: [
          "Có danh sách công trình trọng điểm kèm hiện trạng",
          "Hồ chứa xung yếu đã có phương án điều tiết",
        ],
        role: "Cán bộ địa phương phụ trách công trình", userRole: "citizen",
        leadTimeHours: -72, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.a — Bảo vệ công trình",
      }),
      step({
        order: 2, id: "PBS-Y-P48A",
        name: "Thông báo tàu thuyền vào nơi tránh trú và kiểm đếm phương tiện",
        description:
          "Phát thông báo cho chủ tàu, thuyền trưởng về vị trí và hướng di chuyển của bão; kiểm đếm số phương tiện, số lao động còn trên biển và hướng dẫn vào nơi trú ẩn.",
        type: "Thông báo", required: true, prerequisites: [],
        criteria: [
          "100% tàu thuyền trong danh sách đã nhận được thông báo",
          "Có số liệu phương tiện còn hoạt động trên biển",
        ],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: -48, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất",
      }),
      step({
        order: 3, id: "PBS-Y-P48B",
        name: "Đối chiếu tồn kho theo định mức và bổ sung thiếu hụt",
        description:
          "So tồn kho hiện có với nhu cầu dự kiến theo định mức (15 lít nước/người/ngày, 2.100 kcal/người/ngày) cho số dân dự kiến phải sơ tán; đề xuất điều chuyển hoặc mua bổ sung phần thiếu.",
        type: "Nhiệm vụ", required: true, prerequisites: [],
        criteria: [
          "Có bảng đối chiếu nhu cầu – tồn kho theo từng kho",
          "Phần thiếu hụt đã có phương án bù",
        ],
        role: "Thủ kho / điều phối hậu cần", userRole: "citizen",
        leadTimeHours: -48, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.e — Dự trữ vật tư, phương tiện, nhu yếu phẩm",
      }),
      step({
        order: 4, id: "PBS-Y-P36",
        name: "Chốt danh sách hộ phải sơ tán, ưu tiên nhóm dễ tổn thương",
        description:
          "Rà soát và chốt danh sách hộ trong vùng nguy hiểm; đánh dấu người già, trẻ em, phụ nữ mang thai, người khuyết tật cần hỗ trợ di chuyển; gắn mỗi hộ với một điểm sơ tán cụ thể.",
        type: "Sơ tán", required: true, prerequisites: ["PBS-Y-P72"],
        criteria: [
          "Danh sách hộ sơ tán được UBND cấp xã xác nhận",
          "Mỗi hộ đã được gán điểm sơ tán và phương tiện",
        ],
        role: "Cán bộ địa phương", userRole: "citizen",
        leadTimeHours: -36, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất",
      }),
      step({
        order: 5, id: "PBS-Y-P24A",
        name: "Chằng chống nhà cửa, cắt tỉa cây, hạ biển quảng cáo",
        description:
          "Huy động lực lượng xung kích cấp xã hỗ trợ hộ dân chằng chống nhà, gia cố mái tôn, cắt tỉa cây lớn, tháo hạ biển quảng cáo và neo giữ lồng bè nuôi trồng thủy sản.",
        type: "Nhiệm vụ", required: true, prerequisites: ["PBS-Y-P36"],
        criteria: ["Các điểm xung yếu trong danh sách đã được xử lý"],
        role: "Lực lượng xung kích cấp xã", userRole: "citizen",
        leadTimeHours: -24, riskLevels: [4, 5],
        legalBasis: "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất",
        teamType: "Đội ứng phó tổng hợp",
      }),
      step({
        order: 6, id: "PBS-Y-P24B",
        name: "Bố trí chốt chặn ngầm tràn, đường ngập và phân luồng giao thông",
        description:
          "Cắm biển, rào chắn và bố trí người trực tại ngầm tràn, đoạn đường thường ngập, cầu yếu; thống nhất phương án phân luồng với lực lượng công an giao thông.",
        type: "Nhiệm vụ", required: true, prerequisites: ["PBS-Y-P72"],
        criteria: [
          "Mọi ngầm tràn trong danh sách đều có chốt hoặc rào chắn",
          "Phương án phân luồng đã được thông báo cho người dân",
        ],
        role: "Đội trưởng cứu hộ", userRole: "rescue_unit",
        leadTimeHours: -24, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.c — An ninh trật tự, giao thông, thông tin liên lạc",
        teamType: "Đội ứng phó tổng hợp",
      }),
      step({
        order: 7, id: "PBS-Y-P12",
        name: "Kiểm tra phương án liên lạc dự phòng khi mất sóng",
        description:
          "Thử máy bộ đàm, danh bạ vệ tinh, số điện thoại trực ban thay thế và quy ước báo cáo khi mất điện, mất sóng di động — bài học lớn nhất của Yagi 2024 ở Lào Cai.",
        type: "Xác minh", required: true, prerequisites: [],
        criteria: [
          "Đã liên lạc thử thành công với tất cả xã trọng điểm",
          "Có quy ước báo cáo thay thế bằng văn bản",
        ],
        role: "Điều hành viên trực ban", userRole: "disaster_officer",
        leadTimeHours: -12, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.c — An ninh trật tự, giao thông, thông tin liên lạc",
      }),
      step({
        order: 8, id: "PBS-Y-P06",
        name: "Hoàn tất sơ tán và báo cáo số hộ, số người đã sơ tán",
        description:
          "Kết thúc di dời dân trước khi gió mạnh; kiểm đếm số hộ, số người tại từng điểm sơ tán và báo cáo về ban chỉ huy.",
        type: "Sơ tán", required: true, prerequisites: ["PBS-Y-P36", "PBS-Y-P24A"],
        criteria: [
          "100% hộ trong danh sách đã rời khỏi vùng nguy hiểm",
          "Có số liệu người tại từng điểm sơ tán",
        ],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: -6, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất",
      }),

      // ── TRONG VÀ SAU BÃO ─────────────────────────────────────────────────
      step({
        order: 9, id: "PBS-Y01",
        name: "Đánh giá khẩn cấp tình hình sau bão",
        type: "Đánh giá", required: true, prerequisites: ["PBS-Y-P06"],
        criteria: ["Có báo cáo thiệt hại sơ bộ từ ít nhất 3 địa phương"],
        role: "Trực ban PCTT TW", userRole: "disaster_officer",
        leadTimeHours: 3, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.d — Phối hợp chỉ huy và tìm kiếm cứu nạn",
      }),
      step({
        order: 10, id: "PBS-Y02",
        name: "Kích hoạt hệ thống cảnh báo quốc gia",
        type: "Thông báo", required: true, prerequisites: ["PBS-Y01"],
        criteria: ["Cảnh báo được phát tới tất cả địa phương bị ảnh hưởng"],
        role: "Điều hành viên TW", userRole: "disaster_officer",
        leadTimeHours: 4, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.c — An ninh trật tự, giao thông, thông tin liên lạc",
      }),
      step({
        order: 11, id: "PBS-Y03",
        name: "Xác định khu vực ưu tiên tìm kiếm cứu nạn",
        type: "Quyết định", required: true, prerequisites: ["PBS-Y01"],
        criteria: ["Danh sách khu vực ưu tiên được chỉ huy xác nhận"],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: 5, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.d — Phối hợp chỉ huy và tìm kiếm cứu nạn",
      }),
      step({
        order: 12, id: "PBS-Y04",
        name: "Điều động lực lượng TKCN đến hiện trường",
        type: "Điều động", required: true, prerequisites: ["PBS-Y03"],
        criteria: ["Ít nhất 1 đội TKCN chuyên nghiệp đã tiếp cận mỗi điểm khẩn cấp"],
        role: "Điều hành viên", userRole: "disaster_officer",
        leadTimeHours: 6, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.đ — Nguồn nhân lực",
        teamType: "Đội tìm kiếm cứu nạn",
      }),
      step({
        order: 13, id: "PBS-Y05",
        name: "Kích hoạt sơ tán bổ sung tại khu vực phát sinh nguy cơ",
        type: "Sơ tán", required: true, prerequisites: ["PBS-Y04"],
        criteria: ["Hoạt động sơ tán đang triển khai hoặc hoàn thành tại khu vực ưu tiên"],
        role: "Chỉ huy sơ tán", userRole: "disaster_officer",
        leadTimeHours: 8, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.b — Sơ tán, bảo vệ người, tài sản, sản xuất",
        teamType: "Đội ứng phó tổng hợp",
      }),
      step({
        order: 14, id: "PBS-Y06",
        name: "Tiếp nhận và xử lý các cuộc gọi SOS",
        type: "Nhiệm vụ", required: true, prerequisites: ["PBS-Y02"],
        criteria: ["Tất cả SOS đã được phân loại và giao đội xử lý"],
        role: "Điều hành viên", userRole: "disaster_officer",
        leadTimeHours: 8, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.d — Phối hợp chỉ huy và tìm kiếm cứu nạn",
        teamType: "Đội cứu hộ tổng hợp",
      }),
      step({
        order: 15, id: "PBS-Y07",
        name: "Điều phối hậu cần cứu trợ",
        type: "Cứu trợ", required: true, prerequisites: ["PBS-Y05", "PBS-Y06"],
        criteria: ["Yêu cầu cứu trợ ưu tiên đã được phê duyệt và hàng đang vận chuyển"],
        role: "Điều phối hậu cần", userRole: "citizen",
        leadTimeHours: 12, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.e — Dự trữ vật tư, phương tiện, nhu yếu phẩm",
      }),
      step({
        order: 16, id: "PBS-Y08",
        name: "Xác minh tình hình hiện trường và cập nhật thương vong",
        type: "Xác minh", required: true, prerequisites: ["PBS-Y07"],
        criteria: ["Có báo cáo xác minh tổng hợp từ hiện trường"],
        role: "Chỉ huy hiện trường", userRole: "rescue_unit",
        leadTimeHours: 24, riskLevels: [3, 4, 5],
        legalBasis: "Đ22.d — Phối hợp chỉ huy và tìm kiếm cứu nạn",
      }),
      step({
        order: 17, id: "PBS-Y09",
        name: "Chuyển sang giai đoạn khôi phục",
        type: "Quyết định", required: false, prerequisites: ["PBS-Y08"],
        criteria: ["Tình huống được kiểm soát; kế hoạch phục hồi được phê duyệt"],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: 48, riskLevels: [3, 4, 5],
        legalBasis: "Kết thúc ứng phó & rút kinh nghiệm",
      }),
      step({
        order: 18, id: "PBS-Y10",
        name: "Đánh giá thiệt hại và lập kế hoạch tái thiết",
        type: "Đánh giá", required: true, prerequisites: ["PBS-Y09"],
        criteria: ["Báo cáo thiệt hại toàn diện được hoàn thành và gửi cấp trên"],
        role: "Tổ đánh giá thiệt hại", userRole: "citizen",
        leadTimeHours: 72, riskLevels: [3, 4, 5],
        legalBasis: "Kết thúc ứng phó & rút kinh nghiệm",
      }),

      // ── KẾT THÚC ỨNG PHÓ ─────────────────────────────────────────────────
      step({
        order: 19, id: "PBS-Y11",
        name: "Công bố kết thúc ứng phó và giải thể sở chỉ huy hiện trường",
        description:
          "Ra quyết định kết thúc trạng thái ứng phó, rút lực lượng tăng cường, bàn giao công việc còn lại cho chính quyền địa phương và bộ phận phục hồi.",
        type: "Quyết định", required: true, prerequisites: ["PBS-Y10"],
        criteria: [
          "Có văn bản công bố kết thúc ứng phó",
          "Danh sách việc bàn giao cho giai đoạn phục hồi đã được ký nhận",
        ],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: 96, riskLevels: [3, 4, 5],
        legalBasis: "Kết thúc ứng phó & rút kinh nghiệm",
        duration: "1–2 giờ",
      }),
      step({
        order: 20, id: "PBS-Y12",
        name: "Họp rút kinh nghiệm trong vòng 7 ngày",
        description:
          "Đối chiếu diễn biến thực tế với phương án: bước nào chậm, bước nào thừa, số liệu nào sai; ghi nhận thành đề xuất sửa phương án cho lần sau.",
        type: "Đánh giá", required: true, prerequisites: ["PBS-Y11"],
        criteria: [
          "Có biên bản rút kinh nghiệm",
          "Mỗi tồn tại đều có người chịu trách nhiệm khắc phục và thời hạn",
        ],
        role: "Chỉ huy ứng phó", userRole: "disaster_officer",
        leadTimeHours: 168, riskLevels: [3, 4, 5],
        legalBasis: "Kết thúc ứng phó & rút kinh nghiệm",
        duration: "Nửa ngày",
      }),
    ],
  },
];

const executionStep = (
  stepId: string,
  order: number,
  status: PlaybookStepExecution["status"],
  options: Partial<PlaybookStepExecution> = {},
): PlaybookStepExecution => ({
  id: `PBX-Y-${stepId}`,
  stepId,
  order,
  status,
  owner: null,
  startedAt: null,
  completedAt: null,
  completedBy: null,
  notes: "",
  blockedReason: null,
  linkedTaskIds: [],
  linkedTeamIds: [],
  linkedShelterIds: [],
  linkedEvacuationIds: [],
  linkedSosIds: [],
  linkedReliefRequestIds: [],
  verificationNote: null,
  ...options,
});

export const initialPlaybookEvents: PlaybookTimelineEvent[] = [
  {
    id: "PBE-YAGI-000-A",
    executionId: null,
    playbookId: PLAYBOOK_ID,
    incidentId: null,
    stepId: null,
    type: "created",
    message: "Tạo phương án ứng phó bão PB-YAGI-2024 phiên bản 1.0",
    actor: personName(PERSONNEL.COMMANDER.id),
    timestamp: "01/09/2024 08:00",
    source: "Ban Chỉ đạo Quốc gia về Phòng, chống Thiên tai",
  },
  {
    id: "PBE-YAGI-000-B",
    executionId: null,
    playbookId: PLAYBOOK_ID,
    incidentId: null,
    stepId: null,
    type: "published",
    message: "Xuất bản phương án PB-YAGI-2024; phát hành tới tất cả Ban PCTT tỉnh/thành",
    actor: personName(PERSONNEL.COMMANDER.id),
    timestamp: "07/09/2024 06:00",
    source: "Ban Chỉ đạo Quốc gia về Phòng, chống Thiên tai",
  },
  {
    id: "PBE-YAGI-001",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    stepId: null,
    type: "activated",
    message: "Kích hoạt khẩn cấp phương án PB-YAGI-2024 sau khi bão đổ bộ Quảng Ninh",
    actor: personName(PERSONNEL.COMMANDER.id),
    timestamp: "07/09/2024 14:30",
    source: "Ban Chỉ đạo Quốc gia",
  },
  {
    id: "PBE-YAGI-002",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    stepId: "PBS-Y01",
    type: "completed",
    message: "Hoàn thành đánh giá sơ bộ: 20+ tỉnh bị ảnh hưởng; Lào Cai, Cao Bằng ở mức thảm họa",
    actor: personName(PERSONNEL.OPERATOR.id),
    timestamp: "10/09/2024 07:00",
    source: "Trung tâm điều hành quốc gia",
  },
  {
    id: "PBE-YAGI-003",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    stepId: "PBS-Y02",
    type: "completed",
    message: "Đã phát cảnh báo tới toàn bộ 63 tỉnh thành; thông báo qua hệ thống phát thanh, SMS và ứng dụng",
    actor: personName(PERSONNEL.OPERATOR.id),
    timestamp: "10/09/2024 07:15",
    source: "Trung tâm điều hành quốc gia",
  },
  {
    id: "PBE-YAGI-004",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    stepId: "PBS-Y04",
    type: "completed",
    message: "Thủ tướng ký Công điện điều quân đội vào Lào Cai, Cao Bằng, Hà Giang",
    actor: personName(PERSONNEL.COMMANDER.id),
    timestamp: "10/09/2024 09:00",
    source: "Văn phòng Chính phủ",
  },
  {
    id: "PBE-YAGI-005",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-03",
    stepId: "PBS-Y05",
    type: "started",
    message: "Bắt đầu sơ tán 12.000 hộ dân ven đê Sông Hồng — Hà Nội",
    actor: personName(PERSONNEL.COMMANDER.id),
    timestamp: "09/09/2024 05:30",
    source: "Ban PCTT Hà Nội",
  },
  {
    id: "PBE-YAGI-006",
    executionId: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    stepId: "PBS-Y07",
    type: "blocked",
    message: "Điều phối hậu cần Lào Cai bị chặn: xe tải không vào được Làng Nủ do sạt lở QL279",
    actor: "Hệ thống nghiệp vụ",
    timestamp: "10/09/2024 13:20",
    source: "Điều hành cứu trợ",
  },
];

export const initialPlaybookExecutions: PlaybookExecution[] = [
  {
    id: EXECUTION_ID,
    playbookId: PLAYBOOK_ID,
    incidentId: "INC-YAGI-01",
    status: "Đang hoạt động",
    currentStep: "PBS-Y06",
    startedAt: "07/09/2024 14:30",
    completedAt: null,
    activatedBy: personName(PERSONNEL.COMMANDER.id),
    executionNotes:
      "Ứng phó quy mô quốc gia. Ưu tiên TKCN Làng Nủ và Ca Thành, đồng thời giữ ổn định đê điều Hà Nội.",
    stepExecutions: [
      executionStep("PBS-Y01", 1, "Hoàn thành", {
        owner: personName(PERSONNEL.OPERATOR.id),
        startedAt: "10/09/2024 06:30",
        completedAt: "10/09/2024 07:00",
        completedBy: personName(PERSONNEL.OPERATOR.id),
        notes: "20+ tỉnh bị ảnh hưởng; Lào Cai và Cao Bằng mức thảm họa.",
      }),
      executionStep("PBS-Y02", 2, "Hoàn thành", {
        owner: personName(PERSONNEL.OPERATOR.id),
        startedAt: "10/09/2024 07:00",
        completedAt: "10/09/2024 07:15",
        completedBy: personName(PERSONNEL.OPERATOR.id),
        notes: "Cảnh báo phát tới toàn bộ 63 tỉnh thành.",
      }),
      executionStep("PBS-Y03", 3, "Hoàn thành", {
        owner: personName(PERSONNEL.COMMANDER.id),
        startedAt: "10/09/2024 07:15",
        completedAt: "10/09/2024 07:30",
        completedBy: personName(PERSONNEL.COMMANDER.id),
        notes: "Ưu tiên: Làng Nủ (LC), Ca Thành (CB), Long Biên (HN).",
      }),
      executionStep("PBS-Y04", 4, "Hoàn thành", {
        owner: personName(PERSONNEL.COMMANDER.id),
        startedAt: "10/09/2024 07:30",
        completedAt: "10/09/2024 09:00",
        completedBy: personName(PERSONNEL.COMMANDER.id),
        linkedTeamIds: ["CH-LC-01", "CH-CB-01", "CN-QUANDOI-01"],
        linkedTaskIds: ["TSK-YAGI-01", "TSK-YAGI-03"],
        notes: "Quân khu 2 điều động theo lệnh Thủ tướng.",
      }),
      executionStep("PBS-Y05", 5, "Đang thực hiện", {
        owner: personName(PERSONNEL.COMMANDER.id),
        startedAt: "09/09/2024 05:30",
        linkedTeamIds: ["CH-HN-01", "CH-YB-01"],
        linkedShelterIds: ["SHELTER-HN-01", "SHELTER-HN-02", "SHELTER-YB-01"],
        linkedEvacuationIds: ["EVAC-YAGI-01", "EVAC-YAGI-02"],
        notes: "Đang sơ tán tại Hà Nội và Yên Bái. SHELTER-HN-03 đã quá tải.",
      }),
      executionStep("PBS-Y06", 6, "Đang thực hiện", {
        owner: personName(PERSONNEL.OPERATOR.id),
        startedAt: "10/09/2024 06:00",
        linkedTaskIds: ["TSK-YAGI-01", "TSK-YAGI-03"],
        linkedSosIds: ["SOS-YAGI-01", "SOS-YAGI-02", "SOS-YAGI-03", "SOS-YAGI-04"],
        notes: "4 SOS khẩn cấp đang xử lý; SOS-YAGI-04 chưa có đội.",
      }),
      executionStep("PBS-Y07", 7, "Bị chặn", {
        owner: personName(PERSONNEL.PHAM_LE_HONG_QUANG.id),
        blockedReason: "SHP-YAGI-01 bị chặn do sạt lở QL279; REQ-YAGI-03 chưa có chuyến xuất kho.",
        linkedReliefRequestIds: ["REQ-YAGI-01", "REQ-YAGI-02", "REQ-YAGI-03"],
      }),
      executionStep("PBS-Y08", 8, "Bị chặn", {
        blockedReason: "Chờ hoàn thành điều phối cứu trợ.",
      }),
      executionStep("PBS-Y09", 9, "Bị chặn", {
        blockedReason: "Chờ xác minh hiện trường.",
      }),
      executionStep("PBS-Y10", 10, "Bị chặn", {
        blockedReason: "Chờ kết thúc giai đoạn ứng phó.",
      }),
    ],
    linkedTaskIds: ["TSK-YAGI-01", "TSK-YAGI-03", "TSK-YAGI-04", "TSK-YAGI-06"],
    linkedTeamIds: ["CH-LC-01", "CH-CB-01", "CH-HN-01", "CH-YB-01", "CN-QUANDOI-01"],
    linkedShelterIds: ["SHELTER-HN-01", "SHELTER-HN-02", "SHELTER-HN-03", "SHELTER-YB-01", "SHELTER-LC-01"],
    linkedReliefRequestIds: ["REQ-YAGI-01", "REQ-YAGI-02", "REQ-YAGI-03"],
    timeline: initialPlaybookEvents.filter(
      (event) => event.executionId === EXECUTION_ID,
    ),
    updatedAt: "10/09/2024 14:30",
  },
];
