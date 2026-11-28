"use strict";
/* Only publicly released dayXX.json files are fetched. This cannot access
   encrypted future banks or the secret, which stay on the release runner. */
window.ChronburgRelease = (function () {
  const releaseDates = {2: "2026-12-02", 3: "2026-12-03", 4: "2026-12-04", 5: "2026-12-05", 6: "2026-12-06", 7: "2026-12-07"};
  function moscowDate() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const value = name => parts.find(x => x.type === name)?.value || "00";
    return value("year") + "-" + value("month") + "-" + value("day");
  }
  function attach({day, onReady, onStatus, pollMinutes = 2}) {
    if (!Number.isInteger(day) || !releaseDates[day])
      throw new Error("No scheduled release for this day");
    let loaded = false;
    let stopped = false;
    let inFlight = false;
    let timer = null;

    async function refresh() {
      if (loaded || stopped || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          "data/day" + String(day).padStart(2, "0") + ".json?check=" + Date.now(),
          {cache: "no-store", credentials: "same-origin"}
        );
        if (!response.ok) throw new Error("not-published");
        const payload = await response.json();
        if (payload?.day !== day || payload?.kind !== "chronburg-private-day" + day ||
            !Array.isArray(payload.exams?.oge) || !Array.isArray(payload.exams?.ege))
          throw new Error("bad-release");
        // The receiving day can reject malformed content; never announce success first.
        if (onReady(payload) === false) throw new Error("bad-release");
        loaded = true;
        onStatus("✓ Задания дня загружены автоматически. Можно начинать!", "success");
        if (timer !== null) clearInterval(timer);
      } catch (error) {
        if (error.message === "bad-release")
          onStatus("Ошибка опубликованного набора. Сообщи преподавателю.", "error");
        else {
          const upcoming = moscowDate() < releaseDates[day];
          onStatus(upcoming
            ? "Задания откроются автоматически " + day + " декабря. Загружать файл не нужно."
            : "Задания ожидают публикации. Страница проверяет обновления автоматически.",
            "waiting");
        }
      } finally { inFlight = false; }
    }
    refresh();
    timer = setInterval(refresh, Math.max(1, pollMinutes) * 60000);
    return {refresh, stop() {stopped = true; if (timer !== null) clearInterval(timer);}};
  }
  return {attach};
})();
