/* Pickup schedule + US federal holidays for MMM-ChoreDays.
 * Plain functions (no MagicMirror dependencies) so they can be tested with Node.
 * Dates are moment objects at the start of the day.
 */
/* global moment */
(function (root) {
    const m = typeof moment !== "undefined" ? moment : require("moment");

    /** nth weekday of a month, e.g. (2026, 0, 1, 3) = 3rd Monday of January. weekday: 0 = Sunday. */
    function nthWeekday(year, month, weekday, n) {
        const first = m({ year, month, day: 1 });
        const offset = (weekday - first.day() + 7) % 7;
        return first.clone().add(offset + (n - 1) * 7, "days");
    }

    /** Last given weekday of a month, e.g. last Monday of May. */
    function lastWeekday(year, month, weekday) {
        const last = m({ year, month, day: 1 }).endOf("month").startOf("day");
        const offset = (last.day() - weekday + 7) % 7;
        return last.clone().subtract(offset, "days");
    }

    /** Fixed-date holidays are observed on Friday when on Saturday, Monday when on Sunday. */
    function observed(date) {
        if (date.day() === 6) return date.clone().subtract(1, "day");
        if (date.day() === 0) return date.clone().add(1, "day");
        return date;
    }

    /** Observed US federal holidays for a year: [{ date, name }]. */
    function federalHolidays(year) {
        const fixed = (month, day) => observed(m({ year, month, day }));
        return [
            { date: fixed(0, 1), name: "New Year's Day" },
            { date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day" },
            { date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day" },
            { date: lastWeekday(year, 4, 1), name: "Memorial Day" },
            { date: fixed(5, 19), name: "Juneteenth" },
            { date: fixed(6, 4), name: "Independence Day" },
            { date: nthWeekday(year, 8, 1, 1), name: "Labor Day" },
            { date: nthWeekday(year, 9, 1, 2), name: "Columbus Day" },
            { date: fixed(10, 11), name: "Veterans Day" },
            { date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving" },
            { date: fixed(11, 25), name: "Christmas Day" }
        ];
    }

    /**
     * DC-only holidays (DC government, which also shifts trash collection):
     * - DC Emancipation Day, April 16 (Saturday -> Friday, Sunday -> Monday)
     * - Inauguration Day, January 20 every four years (2029, 2033, ...); if Sunday, the 21st
     */
    function dcHolidays(year) {
        const list = [{ date: observed(m({ year, month: 3, day: 16 })), name: "DC Emancipation Day" }];
        if (year % 4 === 1) {
            let inauguration = m({ year, month: 0, day: 20 });
            if (inauguration.day() === 0) inauguration = inauguration.add(1, "day");
            list.push({ date: inauguration, name: "Inauguration Day" });
        }
        return list;
    }

    /** Federal (+ DC unless config.includeDcHolidays is false) + config.extraHolidays, around a date. */
    function holidaysNear(date, config = {}) {
        const years = [date.year() - 1, date.year(), date.year() + 1];
        const list = years.flatMap(federalHolidays);
        if (config.includeDcHolidays !== false) list.push(...years.flatMap(dcHolidays));
        for (const extra of config.extraHolidays || []) list.push({ date: m(extra.date, "YYYY-MM-DD"), name: extra.name });
        return list;
    }

    /**
     * Pickups in the week (Monday-Sunday) containing `date`, after the holiday slide:
     * any pickup on or after a weekday holiday that week moves one day later.
     * Returns [{ date, original, types: ["trash", "recycling"], holiday }].
     */
    function pickupsForWeek(date, config) {
        const monday = date.clone().startOf("day").subtract((date.day() + 6) % 7, "days");
        const sunday = monday.clone().add(6, "days");

        const holiday = holidaysNear(date, config)
            .filter((h) => h.date.isBetween(monday, sunday, "day", "[]") && h.date.day() >= 1 && h.date.day() <= 5)
            .sort((a, b) => a.date - b.date)[0] || null;

        const pickups = [];
        for (let i = 0; i < 7; i++) {
            const day = monday.clone().add(i, "days");
            const types = [];
            if (config.trashDays.includes(day.day())) types.push("trash");
            if (config.recyclingDays.includes(day.day())) types.push("recycling");
            if (types.length === 0) continue;

            const shifted = holiday && day.isSameOrAfter(holiday.date, "day");
            pickups.push({
                date: shifted ? day.clone().add(1, "day") : day,
                original: day,
                types,
                holiday: shifted ? holiday : null
            });
        }
        return pickups;
    }

    /** All pickups from `from` over the next `days` days, in order. */
    function upcomingPickups(from, days, config) {
        const start = from.clone().startOf("day");
        const end = start.clone().add(days, "days");
        const seen = new Set();
        const result = [];
        for (let week = start.clone(); week.isBefore(end.clone().add(7, "days")); week.add(7, "days")) {
            for (const p of pickupsForWeek(week, config)) {
                const key = p.date.format("YYYY-MM-DD");
                if (seen.has(key) || p.date.isBefore(start) || !p.date.isBefore(end)) continue;
                seen.add(key);
                result.push(p);
            }
        }
        return result.sort((a, b) => a.date - b.date);
    }

    /**
     * The single most relevant item at `now`:
     *   1. pickup tomorrow (put bins out tonight)
     *   2. pickup today, until config.todayUntilHour
     *   3. holiday today, then holiday tomorrow
     *   4. next pickup this coming week (muted)
     * Returns { kind: "pickup" | "holiday", when: "today" | "tomorrow" | "later", date, types?, holiday?, name? }.
     */
    function currentEvent(now, config) {
        const today = now.clone().startOf("day");
        const tomorrow = today.clone().add(1, "day");
        const pickups = upcomingPickups(today, 8, config);
        const holidays = holidaysNear(today, config);

        const pickupOn = (day) => pickups.find((p) => p.date.isSame(day, "day"));
        const holidayOn = (day) => holidays.find((h) => h.date.isSame(day, "day"));

        const pTomorrow = pickupOn(tomorrow);
        if (pTomorrow) return { kind: "pickup", when: "tomorrow", ...pTomorrow };

        const pToday = pickupOn(today);
        if (pToday && now.hour() < config.todayUntilHour) return { kind: "pickup", when: "today", ...pToday };

        const hToday = holidayOn(today);
        if (hToday) return { kind: "holiday", when: "today", date: hToday.date, name: hToday.name };

        const hTomorrow = holidayOn(tomorrow);
        if (hTomorrow) return { kind: "holiday", when: "tomorrow", date: hTomorrow.date, name: hTomorrow.name };

        const next = pickups.find((p) => p.date.isAfter(today, "day"));
        if (next) return { kind: "pickup", when: "later", ...next };
        return null;
    }

    /** "trash", "recycling" or "trash & recycling" for a list of pickup types. */
    function typesLabel(types) {
        return types.includes("trash") && types.includes("recycling") ? "trash & recycling" : types[0];
    }

    const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

    /**
     * The card's text for an event: { main, note, urgent }.
     *   tomorrow pickup -> "Take out trash & recycling tonight"
     *   today pickup    -> "Trash pickup today"
     *   holiday         -> "Veterans Day today" / "Veterans Day tomorrow"
     *   later pickup    -> "Next up: Trash on Friday"
     * note: "Moved from Friday for Veterans Day" when a holiday shifted the pickup.
     */
    function describe(event) {
        if (!event) return null;
        const note = event.kind === "pickup" && event.holiday
            ? `Moved from ${event.original.format("dddd")} for ${event.holiday.name}`
            : null;

        if (event.kind === "holiday") {
            return { main: `${event.name} ${event.when}`, note: null, urgent: true };
        }
        const what = typesLabel(event.types);
        if (event.when === "tomorrow") return { main: `Take out ${what} tonight`, note, urgent: true };
        if (event.when === "today") return { main: `${capitalize(what)} pickup today`, note, urgent: true };
        return { main: `Next up: ${capitalize(what)} on ${event.date.format("dddd")}`, note, urgent: false };
    }

    const api = { federalHolidays, dcHolidays, pickupsForWeek, upcomingPickups, currentEvent, describe };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.ChoreSchedule = api;
})(this);
