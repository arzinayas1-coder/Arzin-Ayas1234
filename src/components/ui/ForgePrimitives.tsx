import React, { useState } from 'react';

export const FORGE_TOKENS = {
  bg: '#09090B',
  sidebar: '#0C0C0F',
  editor: '#101014',
  panel: '#121217',
  elevated: '#18181F',
  border: '#262630',
  text: '#F4F4F7',
  secondary: '#9999A5',
  muted: '#666672',
  violet: '#8B7CFF',
  cyan: '#40D9FF',
  success: '#36D399',
  warning: '#FBBF24',
  error: '#FB7185',
} as const;

interface ForgeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'cyan' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md';
}

export const ForgeButton: React.FC<ForgeButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  className = '',
  children,
  ...props
}) => {
  const sizeClasses =
    size === 'xs'
      ? 'h-6 px-2 text-[11px] gap-1'
      : size === 'sm'
      ? 'h-7 px-2.5 text-xs gap-1.5'
      : 'h-8 px-3.5 text-xs gap-2';

  const variantClasses: Record<NonNullable<ForgeButtonProps['variant']>, string> = {
    primary:
      'bg-[#8B7CFF] hover:bg-[#7A6AF5] text-[#09090B] font-semibold border border-transparent',
    secondary:
      'bg-[#18181F] hover:bg-[#202029] text-[#F4F4F7] border border-[#262630]',
    ghost:
      'bg-transparent hover:bg-[#18181F] text-[#9999A5] hover:text-[#F4F4F7] border border-transparent',
    cyan:
      'bg-[#40D9FF]/12 hover:bg-[#40D9FF]/20 text-[#40D9FF] border border-[#40D9FF]/40 font-medium',
    danger:
      'bg-[#FB7185]/12 hover:bg-[#FB7185]/20 text-[#FB7185] border border-[#FB7185]/35 font-medium',
    success:
      'bg-[#36D399]/12 hover:bg-[#36D399]/20 text-[#36D399] border border-[#36D399]/35 font-medium',
  };

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md whitespace-nowrap transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#8B7CFF] ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

interface ForgeTooltipProps {
  label: string;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'right';
  children: React.ReactNode;
}

export const ForgeTooltip: React.FC<ForgeTooltipProps> = ({
  label,
  shortcut,
  side = 'bottom',
  children,
}) => {
  const [visible, setVisible] = useState(false);

  const posClass =
    side === 'top'
      ? 'bottom-full left-1/2 -translate-x-1/2 mb-1.5'
      : side === 'right'
      ? 'left-full top-1/2 -translate-y-1/2 ml-2'
      : 'top-full left-1/2 -translate-x-1/2 mt-1.5';

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 ${posClass} px-2 py-1 rounded-md bg-[#18181F] border border-[#262630] shadow-xl flex items-center gap-2 whitespace-nowrap text-[11px] text-[#F4F4F7]`}
        >
          <span>{label}</span>
          {shortcut && (
            <kbd className="font-mono text-[10px] text-[#9999A5] bg-[#0C0C0F] px-1 rounded border border-[#262630]">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};

export const ForgeDivider: React.FC<{ orientation?: 'vertical' | 'horizontal'; className?: string }> = ({
  orientation = 'vertical',
  className = '',
}) =>
  orientation === 'vertical' ? (
    <div className={`w-px h-4 bg-[#262630] shrink-0 ${className}`} aria-hidden="true" />
  ) : (
    <div className={`h-px w-full bg-[#262630] shrink-0 ${className}`} aria-hidden="true" />
  );

export const ForgeStatusDot: React.FC<{
  tone: 'ready' | 'running' | 'warning' | 'error';
  size?: 'sm' | 'md';
}> = ({ tone, size = 'sm' }) => {
  const color =
    tone === 'ready'
      ? 'bg-[#36D399]'
      : tone === 'running'
      ? 'bg-[#40D9FF]'
      : tone === 'warning'
      ? 'bg-[#FBBF24]'
      : 'bg-[#FB7185]';
  const dim = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return <span className={`inline-block rounded-full shrink-0 ${dim} ${color}`} />;
};

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function ForgeSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#09090B] border border-[#262630]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-1 px-2 rounded-md text-[11px] font-medium whitespace-nowrap transition-all duration-150 ${
              active
                ? 'bg-[#18181F] text-[#F4F4F7] border border-[#8B7CFF]/45 shadow-xs'
                : 'text-[#9999A5] hover:text-[#F4F4F7] border border-transparent'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
