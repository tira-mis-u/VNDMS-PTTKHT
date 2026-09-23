import {
  Children,
  createElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type OptionElement = ReactElement<{
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
}>;

type SelectOption = {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  /** Nhãn trực quan khi control không nằm trong một label có chữ. */
  accessibleLabel?: string;
};

/**
 * Select dùng chung cho toàn hệ thống. Native select ẩn vẫn giữ name/value và
 * form semantics; trigger/listbox tùy biến cung cấp giao diện nhất quán.
 */
export function Select({
  children,
  className = "",
  value,
  defaultValue,
  disabled,
  onChange,
  accessibleLabel,
  "aria-label": ariaLabel,
  id,
  name,
  required,
  ...nativeProps
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? `select-${generatedId.replaceAll(":", "")}`;
  const listboxId = `${selectId}-listbox`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [uncontrolledValue, setUncontrolledValue] = useState(() =>
    String(defaultValue ?? ""),
  );

  const options = useMemo<SelectOption[]>(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .map((child) => {
          const option = child as OptionElement;
          const label = option.props.children;
          const text =
            typeof label === "string" || typeof label === "number"
              ? String(label)
              : String(option.props.value ?? "");
          return {
            value: String(option.props.value ?? text),
            label,
            text,
            disabled: Boolean(option.props.disabled),
          };
        }),
    [children],
  );
  const currentValue = String(value ?? uncontrolledValue ?? options[0]?.value ?? "");
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === currentValue),
  );
  const selected = options[selectedIndex];

  // Tính lại vị trí popover theo vị trí HIỆN TẠI của trigger. Trả về false khi
  // trigger đã cuộn ra khỏi khung nhìn — khi đó menu nên đóng. Tách thành hàm
  // riêng để dùng chung lúc mở và lúc cuộn/resize: menu trong dialog (bảng
  // cuộn được) bám theo trigger thay vì đóng phụp khi trình dụng tự cuộn.
  const placeMenu = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return false;
    if (rect.bottom < 4 || rect.top > window.innerHeight - 4) return false;
    {
      // Menu đặt theo viewport (portal) nhưng KHÔNG được lọt thỏm/bay ra khỏi
      // dialog chứa control: kẹp kích thước & vị trí vào trong box dialog khi
      // trigger nằm trong dialog (role="dialog" hoặc các hộp thoại form dùng chung).
      const dialogEl = trigger.current?.closest<HTMLElement>(
        '[role="dialog"], .incident-form-dialog, .citizen-sos-modal, .shelter-form-dialog, .beacon-modal',
      );
      const dialog = dialogEl?.getBoundingClientRect();
      const inset = 10;
      const boundsLeft = dialog ? Math.max(12, dialog.left + inset) : 12;
      const boundsRight = dialog
        ? Math.min(window.innerWidth - 12, dialog.right - inset)
        : window.innerWidth - 12;
      const maxWidth = Math.max(140, boundsRight - boundsLeft);
      // Popover mô phỏng <select> gốc: rộng đúng bằng trigger (chỉ kẹp khi
      // trigger vượt hộp chứa), để select và danh sách options luôn cùng bề rộng.
      const width = Math.min(
        rect.width,
        maxWidth,
        Math.max(140, Math.min(360, window.innerWidth - 24)),
      );
      const left = Math.min(
        Math.max(boundsLeft, rect.left),
        Math.max(boundsLeft, boundsRight - width),
      );
      const estimatedMenuHeight = Math.min(
        options.length * 36 + 12,
        window.innerHeight * 0.45,
        312,
      );
      const spaceBelow =
        (dialog ? Math.min(window.innerHeight - 12, dialog.bottom - inset) : window.innerHeight - 12) -
        rect.bottom -
        6;
      const spaceAbove =
        rect.top -
        (dialog ? Math.max(12, dialog.top + inset) : 12) -
        6;
      // Chọn phía còn đủ chỗ theo chính số option thay vì ngưỡng cố định;
      // menu dài ở cuối trang mobile vì vậy không tràn viewport.
      const shouldOpenUp =
        spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      setOpenUp(shouldOpenUp);
      setPopoverStyle(
        shouldOpenUp
          ? {
              position: "fixed",
              left,
              bottom: window.innerHeight - rect.top + 6,
              width,
            }
          : { position: "fixed", left, top: rect.bottom + 6, width },
      );
    }
    return true;
  };

  const openMenu = () => {
    if (options.length === 0) return;
    setActiveIndex(selectedIndex);
    placeMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !root.current?.contains(target) &&
        !popover.current?.contains(target)
      )
        setOpen(false);
    };
    const followViewport = (event?: Event) => {
      // Khi người dùng cuộn danh sách các options bên trong chính popover,
      // không tính lại vị trí (menu đứng yên, chỉ list cuộn).
      if (
        event &&
        popover.current &&
        (event.target === popover.current ||
          popover.current.contains(event.target as Node))
      ) {
        return;
      }
      // Cuộn hộp thoại/thay đổi viewport: menu BÁM THEO trigger (đúng vị trí
      // mới) thay vì đóng — hết cảnh "bấm mở rồi auto-đóng vì scroll" trong
      // dialog; chỉ đóng khi trigger đã cuộn ra khỏi khung nhìn.
      if (!placeMenu()) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", followViewport);
    window.addEventListener("scroll", followViewport, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", followViewport);
      window.removeEventListener("scroll", followViewport, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    // Theo đúng ngữ nghĩa native <select>: chọn lại đúng giá trị hiện tại KHÔNG
    // phải là một thay đổi → không phát onChange. Đây là gốc của lỗi "chỉnh
    // trùng quyền vẫn sinh dòng nhật ký bảo mật + thông báo" (owner 2026-09).
    if (option.value === currentValue) {
      setOpen(false);
      requestAnimationFrame(() => trigger.current?.focus());
      return;
    }
    if (value === undefined) setUncontrolledValue(option.value);
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
    } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const move = (direction: 1 | -1) => {
    if (!options.length) return;
    let next = activeIndex;
    do next = (next + direction + options.length) % options.length;
    while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!open) openMenu();
      else move(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(options.findIndex((option) => !option.disabled));
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      for (let index = options.length - 1; index >= 0; index -= 1)
        if (!options[index].disabled) {
          setActiveIndex(index);
          break;
        }
      return;
    }
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openMenu();
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      // Đừng để Escape "chạm" tới handler của dialog chứa ngoài: khi menu đang
      // mở, Escape chỉ đóng menu — người dùng không mất form đang điền dở.
      event.stopPropagation();
      setOpen(false);
    }
  };

  // Không có option nào: trigger vẫn hiển thị (kèm hint) nhưng không mở rỗng,
  // tránh tình huống "bấm dropdown mà không thấy gì" như lỗi đã gặp ở dialog SOS.
  const isEmpty = options.length === 0;
  const label = ariaLabel ?? accessibleLabel ?? (isEmpty ? "Chưa có lựa chọn nào" : "Chọn một giá trị");
  return (
    <>
      <div
        ref={root}
        className={`ui-select ${open ? "is-open" : ""} ${className}`}
      >
        {createElement(
          "select",
          {
            ...nativeProps,
            id: selectId,
            name,
            value: currentValue,
            disabled,
            required,
            onChange,
            className: "ui-select-native",
            tabIndex: -1,
            "aria-hidden": "true",
          },
          children,
        )}
        <button
          ref={trigger}
          type="button"
          className="ui-select-trigger"
          disabled={disabled}
          role="combobox"
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-disabled={isEmpty || undefined}
          aria-controls={listboxId}
          aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
          onClick={() => {
            if (isEmpty) return;
            if (open) setOpen(false);
            else openMenu();
          }}
          onKeyDown={onKeyDown}
        >
          <span>{selected?.label ?? label}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {open &&
        createPortal(
          <div
            ref={popover}
            className={`ui-select-popover${openUp ? " opens-up" : ""}`}
            style={popoverStyle}
          >
            <ul id={listboxId} role="listbox" aria-label={label}>
              {options.map((option, index) => (
                <li
                  id={`${listboxId}-${index}`}
                  key={`${option.value}-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  aria-disabled={option.disabled || undefined}
                  className={`${index === activeIndex ? "is-active" : ""} ${index === selectedIndex ? "is-selected" : ""} ${option.disabled ? "is-disabled" : ""}`}
                  onPointerMove={() =>
                    !option.disabled && setActiveIndex(index)
                  }
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {index === selectedIndex && (
                    <Check size={15} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
