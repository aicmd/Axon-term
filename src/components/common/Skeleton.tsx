import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'rectangular' }) => {
  const baseClasses = "animate-pulse bg-textMuted/10";
  const variantClasses = {
    text: "h-3 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
};
