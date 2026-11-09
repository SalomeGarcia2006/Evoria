import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'evoria-button-primary text-white shadow-[0_10px_20px_rgba(106,76,255,0.22)] hover:brightness-105',
  secondary:
    'evoria-button-secondary border border-sky-blue bg-white text-navy hover:border-teal hover:bg-beige',
  ghost: 'evoria-button-ghost text-muted hover:bg-sky-blue/60 hover:text-navy',
};

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`evoria-button rounded-[0.875rem] px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
