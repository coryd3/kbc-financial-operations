import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Label shown for the empty ("") selection, e.g. "All Households" or "No household". */
  emptyLabel: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
}

/**
 * A type-ahead combobox that stays usable with hundreds of options.
 * Typing filters the list; arrow keys + Enter select; Escape closes.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  emptyLabel,
  placeholder = "Type to search...",
  className,
  inputClassName,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label ?? ""
    : emptyLabel;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base: SearchableSelectOption[] = [{ value: "", label: emptyLabel }, ...options];
    if (!q) return base;
    return base.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, emptyLabel]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Keep the highlighted row visible while arrowing through the list.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt) select(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    } else if (e.key === "Tab") {
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-14 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            inputClassName,
          )}
          placeholder={open ? placeholder : undefined}
          value={open ? query : selectedLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Clear selection"
              className="text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => {
                e.preventDefault();
                select("");
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Toggle options"
            className="text-muted-foreground hover:text-foreground"
            onPointerDown={(e) => {
              e.preventDefault();
              if (open) {
                setOpen(false);
                setQuery("");
              } else {
                setOpen(true);
                inputRef.current?.focus();
              }
            }}
          >
            <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-md py-1 text-sm"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground italic">No matches</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.value || "__empty__"}
                role="option"
                aria-selected={o.value === value}
                className={cn(
                  "px-3 py-2 cursor-pointer",
                  i === highlighted ? "bg-primary/10 text-primary" : "hover:bg-muted",
                  o.value === value && "font-medium",
                  !o.value && "text-muted-foreground",
                )}
                onMouseEnter={() => setHighlighted(i)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  select(o.value);
                }}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
