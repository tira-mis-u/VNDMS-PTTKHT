import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  children: ReactNode;
  /** Khi true: chỉ reset về state ban đầu thay vì reload trang */
  softReset?: boolean;
  /** Label mô tả khu vực đang bọc — dùng để log rõ hơn */
  area?: string;
}

interface State {
  error: Error | null;
  errorInfo: string | null;
}

export class ApplicationErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const area = this.props.area ?? "workspace";
    console.error(`[VNDMS] Lỗi giao diện tại [${area}]:`, error.message);
    console.error("[VNDMS] Component stack:", info.componentStack);
    this.setState({ errorInfo: info.componentStack?.slice(0, 400) ?? null });
  }

  handleSoftReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const msg = this.state.error.message;
    const area = this.props.area;
    return (
      <main className="fatal-error-page" role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>Không thể hiển thị không gian tác nghiệp</h1>
        <p>
          Ứng dụng gặp lỗi giao diện ngoài dự kiến.{area ? ` Khu vực bị lỗi: ${area}.` : ""}
        </p>
        {msg && (
          <p style={{ fontFamily: "monospace", fontSize: "0.8rem", opacity: 0.7 }}>
            {msg.slice(0, 200)}
          </p>
        )}
        <p>
          Chi tiết chẩn đoán đã được ghi vào bảng điều khiển của trình duyệt để
          phục vụ xử lý sự cố.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          {this.props.softReset && (
            <Button variant="secondary" onClick={this.handleSoftReset}>
              <RotateCcw size={15} />
              Thử lại trang này
            </Button>
          )}
          <Button onClick={() => window.location.reload()}>
            <RefreshCw size={15} />
            Tải lại ứng dụng
          </Button>
        </div>
      </main>
    );
  }
}
