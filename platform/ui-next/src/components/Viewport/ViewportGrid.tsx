import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Hook to detect if the viewport is in mobile mode (< 768px).
 */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobile;
}

/**
 * A minimal top-level container that organizes multiple <ViewportPane>
 * children in a grid. Typically driven by a layout config.
 *
 * On mobile/tablet (< 768px), forces a single viewport layout for
 * better touch interaction and readability.
 */
function ViewportGrid({ numRows, numCols, layoutType, children }) {
  const isMobile = useIsMobile();

  // On mobile, only render the first (active) viewport
  const visibleChildren = isMobile
    ? React.Children.toArray(children).slice(0, 1)
    : children;

  return (
    <div
      data-cy="viewport-grid"
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
      }}
      data-mobile={isMobile || undefined}
      role="region"
      aria-label={`Viewport grid: ${isMobile ? '1x1 mobile' : `${numRows}x${numCols}`}`}
    >
      {visibleChildren}
    </div>
  );
}

ViewportGrid.propTypes = {
  numRows: PropTypes.number.isRequired,
  numCols: PropTypes.number.isRequired,
  layoutType: PropTypes.string,
  children: PropTypes.arrayOf(PropTypes.node).isRequired,
};

export { ViewportGrid };
