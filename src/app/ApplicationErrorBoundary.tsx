import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ApplicationErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("VNDMS presentation error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error-page" role="alert">
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>Không thể hiển thị không gian tác nghiệp</h1>
        <p>
          Ứng dụng gặp lỗi giao diện ngoài dự kiến. Dữ liệu trình diễn cục bộ
          chưa được gửi tới máy chủ.
        </p>
        <details>
          <summary>Chi tiết kỹ thuật</summary>
          <code>{this.state.error.message}</code>
        </details>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw size={15} />
          Tải lại ứng dụng
        </Button>
      </main>
    );
  }
}
