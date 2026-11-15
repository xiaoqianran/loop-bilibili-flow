/** Peer scroll pattern: stick when distance-to-bottom < threshold */
export function shouldStickBottom(scrollHeight: number, scrollTop: number, clientHeight: number, threshold?: number | null) {
  const th = threshold == null ? 48 : threshold;
  return scrollHeight - scrollTop - clientHeight < th;
}

/**
 * 流式滚动状态机（纯函数，供离线测试）。
 * 修 0.8.3：距底 <80 自动 stick=true 会把刚上滑的用户拽回。
 *
 * @param {object} s  { stick, userReading, progScroll }
 * @param {object} ev { type: 'wheel-up'|'scroll'|'resume'|'start'|'paint', gap? }
 * @returns {{ stick:boolean, userReading:boolean, allowPaintScroll:boolean }}
 */
export function resolveAiScrollState(s: {stick:boolean;userReading:boolean;progScroll:boolean}, ev:{type:string;gap?:number}) {
  let stick = !!s.stick;
  let userReading = !!s.userReading;
  const prog = !!s.progScroll;
  const type = (ev && ev.type) || "";
  const gap = ev && typeof ev.gap === "number" ? ev.gap : null;

  if (type === "start" || type === "resume") {
    stick = true;
    userReading = false;
  } else if (type === "wheel-up" || type === "detach") {
    stick = false;
    userReading = true;
  } else if (type === "scroll") {
    if (prog) {
      /* 程序化滚动：状态不变 */
    } else if (gap != null && gap > 24) {
      stick = false;
      userReading = true;
    } else if (gap != null && gap <= 12 && userReading) {
      // 用户自己滚回贴底才恢复
      stick = true;
      userReading = false;
    }
  }

  const allowPaintScroll = stick && !userReading;
  return { stick, userReading, allowPaintScroll };
}
