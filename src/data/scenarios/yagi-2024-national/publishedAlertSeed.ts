import { PERSONNEL, personName } from "../../identity/personnel";
import type { PublishedAlert } from "../../../domain/published-alerts/types";

/** Bản tin cảnh báo đã công bố tới người dân trong kịch bản Yagi 2024. */
export const initialPublishedAlerts: PublishedAlert[] = [
  {
    id: "PA-YAGI-01",
    code: "PA-YAGI-01",
    title: "Cảnh báo lũ quét, sạt lở đất tại Lào Cai, Yên Bái",
    content:
      "Mưa lớn kéo dài sau bão số 3 gây nguy cơ rất cao lũ quét, sạt lở đất tại các huyện Bảo Yên, Bắc Hà, Văn Yên. Người dân ven suối, sườn dốc chủ động di dời đến điểm sơ tán gần nhất; không đi qua ngầm tràn, cầu tạm khi nước dâng.",
    severity: "critical",
    areaName: "Lào Cai, Yên Bái",
    status: "Đã công bố",
    revision: 1,
    createdBy: personName(PERSONNEL.OPERATOR.id),
    createdAt: "09/09/2024 18:00",
    publishedAt: "09/09/2024 18:30",
    withdrawnAt: null,
    updatedAt: "09/09/2024 18:30",
  },
  {
    id: "PA-YAGI-02",
    code: "PA-YAGI-02",
    title: "Lũ sông Hồng tại Hà Nội vượt báo động 2",
    content:
      "Mực nước sông Hồng tại Long Biên dự báo vượt báo động 2 trong 12 giờ tới. Hộ dân ngoài đê thuộc Tây Hồ, Ba Đình, Hoàn Kiếm, Long Biên chuẩn bị phương án di dời theo hướng dẫn của phường; kê cao tài sản, ngắt điện khu vực ngập.",
    severity: "high",
    areaName: "Hà Nội",
    status: "Đã công bố",
    revision: 1,
    createdBy: personName(PERSONNEL.OPERATOR.id),
    createdAt: "10/09/2024 07:00",
    publishedAt: "10/09/2024 07:20",
    withdrawnAt: null,
    updatedAt: "10/09/2024 07:20",
  },
  {
    id: "PA-YAGI-03",
    code: "PA-YAGI-03",
    title: "Dự thảo: hạ mức cảnh báo ven biển Quảng Ninh – Hải Phòng",
    content:
      "Gió mạnh trên vịnh Bắc Bộ đã giảm dưới cấp 6. Dự kiến cho phép tàu thuyền nhỏ hoạt động trở lại ven bờ từ sáng 11/09 sau khi kiểm tra luồng lạch.",
    severity: "medium",
    areaName: "Quảng Ninh, Hải Phòng",
    status: "Nháp",
    revision: 0,
    createdBy: personName(PERSONNEL.OPERATOR.id),
    createdAt: "10/09/2024 13:00",
    publishedAt: null,
    withdrawnAt: null,
    updatedAt: "10/09/2024 13:00",
  },
];
