import { useEffect, useState } from "react";

// 2 hours in ms
const MONTHLY_LIMIT = 2 * 60 * 60 * 1000;

function getMonthKey() {
  const now = new Date();
  return `knead_freemium_time_${now.getFullYear()}_${now.getMonth()}`;
}

export function useFreemiumTimer(enabled: boolean) {
  const [timeLeft, setTimeLeft] = useState(MONTHLY_LIMIT);

  useEffect(() => {
    if (!enabled) return;
    const key = getMonthKey();
    const used = Number(localStorage.getItem(key) || "0");
    setTimeLeft(Math.max(MONTHLY_LIMIT - used, 0));

    let interval: NodeJS.Timeout;
    if (timeLeft > 0) {
      const start = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start;
        const newUsed = Math.min(
          used + elapsed,
          MONTHLY_LIMIT,
        );
        localStorage.setItem(key, String(newUsed));
        setTimeLeft(Math.max(MONTHLY_LIMIT - newUsed, 0));
        if (newUsed >= MONTHLY_LIMIT)
          clearInterval(interval);
      }, 1000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [enabled]);

  return {
    timeLeft,
    isOut: timeLeft <= 0,
    formatted: `${Math.floor(timeLeft / 60000)}m ${Math.floor((timeLeft % 60000) / 1000)}s`,
  };
}
