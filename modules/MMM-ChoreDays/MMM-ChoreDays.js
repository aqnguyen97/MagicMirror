/* MagicMirror² Module: MMM-ChoreDays
 * One line about the most relevant chore day or holiday right now, e.g.
 *   "Take out trash & recycling tonight", "Trash pickup today", "Veterans Day tomorrow",
 *   or "Next up: Trash on Friday".
 * Pickups move one day later for the rest of a week with a weekday federal or DC holiday.
 * Schedule logic lives in chore-schedule.js.
 */
Module.register("MMM-ChoreDays", {
    defaults: {
        trashDays: [2, 5],       // 0 = Sunday ... 6 = Saturday (Tuesday, Friday)
        recyclingDays: [2],      // Tuesday
        todayUntilHour: 12,      // show "Trash pickup today" until this hour, then move on
        includeDcHolidays: true, // DC Emancipation Day + Inauguration Day also shift pickups
        extraHolidays: []        // more dates that shift pickups: [{ date: "2027-12-24", name: "..." }]
    },

    getScripts() {
        return ["chore-schedule.js"];
    },

    getStyles() {
        return ["MMM-ChoreDays.css"];
    },

    start() {
        // Re-check every 5 minutes so the message changes at noon, in the evening and at midnight
        setInterval(() => this.updateDom(), 5 * 60 * 1000);
    },

    el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    },

    getDom() {
        const card = this.el("div", "chores");
        const event = ChoreSchedule.currentEvent(moment(), this.config);
        const text = ChoreSchedule.describe(event);
        if (!text) return card;

        // Bright when it needs attention today/tonight, muted for "Next up"
        card.classList.add(text.urgent ? "chores--urgent" : "chores--later");

        const icon = event.kind === "holiday"
            ? "fa-star"
            : event.types.includes("recycling") ? "fa-recycle" : "fa-trash-can";
        card.appendChild(this.el("i", `fas ${icon} chores__icon`));

        const body = this.el("div", "chores__text");
        body.appendChild(this.el("div", "chores__main", text.main));
        if (text.note) body.appendChild(this.el("div", "chores__note", text.note));
        card.appendChild(body);
        return card;
    }
});
