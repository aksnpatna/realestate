import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ variant = 'text', width, height, className = '', style }) => {
  const dims: React.CSSProperties = {};
  if (width) dims.width = typeof width === 'number' ? `${width}px` : width;
  if (height) dims.height = typeof height === 'number' ? `${height}px` : height;
  return <div className={`ui-skel ui-skel--${variant} ${className}`} style={{ ...dims, ...style }} aria-hidden="true" />;
};

/* Prebuilt skeleton for a brief card */
export const BriefSkeleton: React.FC = () => (
  <div className="ui-skel-brief">
    <Skeleton variant="text" height={24} width="60%" />
    <div className="u-b9ecfa35">
      <Skeleton variant="rect" width={80} height={22} />
      <Skeleton variant="rect" width={60} height={22} />
    </div>
    <Skeleton variant="text" height={16} width="90%" className="u-4a682385" />
    <Skeleton variant="text" height={16} width="85%" />
    <Skeleton variant="text" height={16} width="70%" />
    <div className="u-24009b5f">
      <Skeleton variant="rect" height={60} />
      <Skeleton variant="rect" height={60} />
      <Skeleton variant="rect" height={60} />
    </div>
  </div>
);
