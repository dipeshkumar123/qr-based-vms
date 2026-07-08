import { useMemo, useState } from 'react';

export default function VirtualizedList({
  items,
  itemHeight,
  height,
  overscan = 4,
  renderItem,
  className = '',
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, offsetY, totalHeight, visibleItems } = useMemo(() => {
    const safeHeight = Math.max(1, height);
    const safeItemHeight = Math.max(1, itemHeight);

    const start = Math.max(0, Math.floor(scrollTop / safeItemHeight) - overscan);
    const visibleCount = Math.ceil(safeHeight / safeItemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    const offset = start * safeItemHeight;

    return {
      startIndex: start,
      endIndex: end,
      offsetY: offset,
      totalHeight: items.length * safeItemHeight,
      visibleItems: items.slice(start, end),
    };
  }, [height, itemHeight, items, overscan, scrollTop]);

  return (
    <div
      className={className}
      style={{ height, overflowY: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => renderItem(item, startIndex + idx))}
        </div>
      </div>
    </div>
  );
}
