(() => {
  const entrance = document.getElementById('entrance');
  const root = document.getElementById('root');
  const video = entrance.querySelector('video');
  const previousOverflow = document.body.style.overflow;
  let finished = false;
  let revealStarted = 0;
  let frame;
  const reveal = () => {
    if (revealStarted) return;
    revealStarted = performance.now();
    entrance.classList.add('entrance-leaving');
    root.classList.add('entrance-revealed');
  };
  const dismiss = (immediate = false) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    reveal();
    setTimeout(() => {
      entrance.hidden = true;
      root.inert = false;
      root.classList.remove('entrance-pending', 'entrance-revealed');
      document.body.style.overflow = previousOverflow;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }, immediate ? 0 : Math.max(0, 480 - (performance.now() - revealStarted)));
  };
  const timeout = setTimeout(() => dismiss(true), 2800);
  entrance.hidden = false;
  root.inert = true;
  root.classList.add('entrance-pending');
  document.body.style.overflow = 'hidden';
  video.addEventListener('ended', () => dismiss());
  video.addEventListener('error', () => dismiss(true));
  const watch = () => {
    if (finished) return;
    if (video.duration && video.currentTime >= video.duration - 0.36) reveal();
    frame = requestAnimationFrame(watch);
  };
  video.addEventListener('playing', () => entrance.classList.add('entrance-playing'), { once: true });
  frame = requestAnimationFrame(watch);
  video.muted = true;
  video.src = '/operation_loading.webm';
  video.play().catch(() => dismiss(true));
})();
