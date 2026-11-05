import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-br from-teal to-violet text-white shadow-[0_10px_20px_rgba(106,76,255,0.22)] hover:brightness-105',
  secondary:
    'border border-sky-blue bg-white text-navy hover:border-teal hover:bg-beige',
  ghost: 'text-muted hover:bg-sky-blue/60 hover:text-navy',
};

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-[0.875rem] px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
