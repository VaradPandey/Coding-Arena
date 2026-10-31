import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Search, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { dropdownTransition } from "@/lib/motion";

export const Input = React.forwardRef(({ className, type, icon: Icon, ...props }, ref) => {
  return (
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
          Icon && "pl-10",
          className
        )}
        ref={ref}
        {...props}
      />
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const SearchBar = React.forwardRef(({ className, ...props }, ref) => {
  return <Input ref={ref} icon={Search} className={cn("rounded-full bg-input/30", className)} {...props} />;
});
SearchBar.displayName = "SearchBar";

// Basic Custom Select (Since no Headless UI is installed, we build a robust custom one using framer-motion)
export const Select = React.forwardRef(({ options = [], value, onChange, placeholder = "Select...", className }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);
  const selectedOption = options.find(opt => opt.value === value);

  // Combine forwarded ref and internal ref
  const setRefs = React.useCallback(
    (node) => {
      containerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div className={cn("relative w-full", className)} ref={setRefs}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-input/50 px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
      >
        <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            {...dropdownTransition}
            className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-[#0a0a0a]/95 backdrop-blur-xl py-1 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "relative flex w-full select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors",
                  option.disabled 
                    ? "opacity-50 cursor-not-allowed text-muted-foreground" 
                    : "cursor-pointer hover:bg-white/10 hover:text-foreground focus:bg-white/10",
                  value === option.value ? "bg-white/5 text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {value === option.value && (
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-4 w-4" />
                  </span>
                )}
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
Select.displayName = "Select";

export const Checkbox = React.forwardRef(({ className, checked, onChange, id, label, ...props }, ref) => {
  return (
    <div className="flex items-center space-x-2">
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          className={cn(
            "peer h-5 w-5 appearance-none rounded-sm border border-border bg-input/50 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/50 transition-all checked:bg-primary checked:border-primary cursor-pointer",
            className
          )}
          ref={ref}
          {...props}
        />
        <Check className="absolute h-3.5 w-3.5 text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none" />
      </div>
      {label && <label htmlFor={id} className="text-sm font-medium leading-none cursor-pointer text-muted-foreground peer-checked:text-foreground transition-colors">{label}</label>}
    </div>
  );
});
Checkbox.displayName = "Checkbox";

export const Switch = React.forwardRef(({ className, checked, onChange, id, label, ...props }, ref) => {
  return (
    <div className="flex items-center space-x-2">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "peer inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-input/80",
          className
        )}
        ref={ref}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      {label && <label htmlFor={id} className="text-sm font-medium leading-none cursor-pointer text-muted-foreground transition-colors">{label}</label>}
    </div>
  );
});
Switch.displayName = "Switch";
