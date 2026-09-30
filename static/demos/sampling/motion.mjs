// Shared SVG motion. Final positions always exist without animation.
export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function moveDot(node, { dx = 0, dy, delay = 0, duration = 550, elapsed = 0 }) {
  if (!node || reducedMotion() || elapsed >= delay + duration) return null;
  const opacity = Number(getComputedStyle(node).opacity);
  const animation = node.animate([
    { transform: `translate(${dx}px, ${dy}px)`, opacity: 0, offset: 0 },
    { transform: `translate(${dx * .94}px, ${dy * .94}px)`, opacity, offset: .12 },
    { transform: 'translate(0px, 1.5px)', opacity, offset: .88 },
    { transform: 'translate(0px, 0px)', opacity, offset: 1 }
  ], { duration, delay, easing: 'cubic-bezier(.35,.05,.55,1)', fill: 'backwards' });
  animation.currentTime = Math.max(0, elapsed);
  animation.finished.then(() => animation.cancel()).catch(() => {});
  return animation;
}

export function dropNewDots(nodes, from, startedAt, top = 8) {
  const fresh = [...nodes].slice(from);
  const elapsed = performance.now() - startedAt;
  // At most 1.2 seconds of stagger, even for 100 simultaneous draws.
  const stagger = fresh.length < 2 ? 0 : Math.min(65, 1200 / (fresh.length - 1));
  fresh.forEach((node, i) => moveDot(node, {
    dy: top - Number(node.getAttribute('cy')) - 8, delay: i * stagger, elapsed
  }));
}
