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
    const closeOnViewportChange = (event?: Event) => {
      // Khi người dùng cuộn danh sách các options bên trong chính popover dropdown, không được đóng menu!
      if (
        event &&
        popover.current &&
        (event.target === popover.current || popover.current.contains(event.target as Node))
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("resize", closeOnViewportChange);
    // Trình duyệt có thể tự cuộn control vào khung nhìn ngay khi người dùng mở
    // menu. Chỉ bắt đầu theo dõi cuộn sau nhịp mở để menu không tự đóng.
    const scrollTimer = window.setTimeout(
      () => window.addEventListener("scroll", closeOnViewportChange, true),
      200,
    );
    return () => {
      window.clearTimeout(scrollTimer);
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(
        Math.max(rect.width, 210),
        Math.min(360, window.innerWidth - 24),
      );
      const left = Math.min(
        Math.max(12, rect.left),
        Math.max(12, window.innerWidth - width - 12),
      );
      const estimatedMenuHeight = Math.min(
        options.length * 36 + 12,
        window.innerHeight * 0.45,
        312,
      );
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
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
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
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
      setOpen(false);
    }
  };

  const label = ariaLabel ?? accessibleLabel ?? "Chọn một giá trị";
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
          aria-controls={listboxId}
          aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
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
