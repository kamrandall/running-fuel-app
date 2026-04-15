export function canScrollElement(element, deltaY) {
  if (!element || deltaY === 0) {
    return false;
  }

  const maxScrollTop = Math.max((element.scrollHeight ?? 0) - (element.clientHeight ?? 0), 0);
  if (maxScrollTop <= 0) {
    return false;
  }

  const scrollTop = element.scrollTop ?? 0;
  if (deltaY > 0) {
    return scrollTop < maxScrollTop - 1;
  }

  return scrollTop > 1;
}

export function selectScrollPanel({ hoveredPanel = null, focusedPanel = null, visiblePanels = [] }) {
  if (hoveredPanel && visiblePanels.includes(hoveredPanel)) {
    return hoveredPanel;
  }

  if (focusedPanel && visiblePanels.includes(focusedPanel)) {
    return focusedPanel;
  }

  return null;
}
