import type React from "react";

export interface AkentrosIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Akentros 品牌向量圖標:蜂巢節點網路
 * (六邊形外框 + 六條中心輻射線 + 六個頂點節點 + 中心節點)。
 * 與官網開源專案頁的「Honeycomb node icon」為同一原始向量,
 * 以 currentColor 描繪,跟隨介面文字顏色(黑白灰設計系統)。
 */
export const AkentrosIcon: React.FC<AkentrosIconProps> = ({ size = 40, className, ...props }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* 六邊形外框 */}
      <path d="M50 14 L81.18 32 L81.18 68 L50 86 L18.82 68 L18.82 32 Z" strokeWidth={4} />
      {/* 中心輻射線 */}
      <g strokeWidth={3}>
        <line x1="50" y1="50" x2="50" y2="14" />
        <line x1="50" y1="50" x2="81.18" y2="32" />
        <line x1="50" y1="50" x2="81.18" y2="68" />
        <line x1="50" y1="50" x2="50" y2="86" />
        <line x1="50" y1="50" x2="18.82" y2="68" />
        <line x1="50" y1="50" x2="18.82" y2="32" />
      </g>
      {/* 頂點節點 */}
      <g fill="currentColor" stroke="none">
        <circle cx="50" cy="14" r="6" />
        <circle cx="81.18" cy="32" r="6" />
        <circle cx="81.18" cy="68" r="6" />
        <circle cx="50" cy="86" r="6" />
        <circle cx="18.82" cy="68" r="6" />
        <circle cx="18.82" cy="32" r="6" />
      </g>
      {/* 中心節點 */}
      <circle cx="50" cy="50" r="12" fill="currentColor" stroke="none" />
    </svg>
  );
};

export default AkentrosIcon;
