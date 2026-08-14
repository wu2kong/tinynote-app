import React from 'react';
import { Crown } from 'lucide-react';

interface ProBadgeProps {
  className?: string;
  size?: number;
  title?: string;
}

const ProBadge: React.FC<ProBadgeProps> = ({ className = '', size = 12, title }) => (
  <span className={`pro-badge ${className}`.trim()} title={title} aria-label={title || 'Pro'}>
    <Crown size={size} strokeWidth={2.25} />
  </span>
);

export default ProBadge;
