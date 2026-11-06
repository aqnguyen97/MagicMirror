/* MagicMirror² Module: MMM-WeekAgenda
 * Vertical week calendar: an expanded "Today" block, then one row per day.
 *
 * Draws events shared by the built-in "calendar" module (CALENDAR_EVENTS
 * notification), so calendars, URLs and colors are configured there.
 */
Module.register("MMM-WeekAgenda", {
    defaults: {
        days: 7,                 // today plus the next 6 days
        header: "",              // optional card header
        emptyText: "Nothing planned"
    },

    start() {
        this.events = [];
        this.loaded = false;
        this.currentDay = moment().format("YYYY-MM-DD");

        // Re-draw once a minute so "today" rolls over at midnight and finished events fade
        setInterval(() => this.updateDom(), 60 * 1000);
    },

    getStyles() {
        return ["MMM-WeekAgenda.css"];
    },

    notificationReceived(notification, payload) {
        if (notification === "CALENDAR_EVENTS") {
            this.events = payload || [];
            this.loaded = true;
            this.updateDom();
        }
    },

    el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    },

    timeFormat() {
        return config.timeFormat === 24 ? "HH:mm" : "h:mm a";
    },

    /** Events that overlap the given day, all-day ones first, then by start time. */
    eventsForDay(dayStart) {
        const dayEnd = dayStart.clone().add(1, "day");

        return this.events
            .filter((event) => {
                const start = moment(Number(event.startDate));
                const end = moment(Number(event.endDate));
                return start.isBefore(dayEnd) && end.isAfter(dayStart);
            })
            .sort((a, b) => {
                if (a.fullDayEvent !== b.fullDayEvent) return a.fullDayEvent ? -1 : 1;
                return Number(a.startDate) - Number(b.startDate);
            });
    },

    /** "All day", "9:30 am", or "until 11:00 am" for an event that started earlier. */
    timeLabel(event, dayStart) {
        const start = moment(Number(event.startDate));
        const end = moment(Number(event.endDate));
        const dayEnd = dayStart.clone().add(1, "day");

        if (event.fullDayEvent || (start.isSameOrBefore(dayStart) && end.isSameOrAfter(dayEnd))) {
            return "All day";
        }
        if (start.isBefore(dayStart)) {
            return `until ${end.format(this.timeFormat())}`;
        }
        return start.format(this.timeFormat());
    },

    eventNode(event, dayStart) {
        const node = this.el("div", "agenda-event");
        node.style.setProperty("--agenda-color", event.color || "#fff");

        if (moment(Number(event.endDate)).isBefore(moment())) {
            node.classList.add("agenda-event--past");
        }

        node.appendChild(this.el("span", "agenda-event__title", event.title));
        node.appendChild(this.el("span", "agenda-event__time", this.timeLabel(event, dayStart)));
        return node;
    },

    eventList(dayStart) {
        const list = this.el("div", "agenda-events");
        const events = this.eventsForDay(dayStart);

        if (events.length === 0) {
            list.appendChild(this.el("div", "agenda-empty", this.config.emptyText));
        } else {
            events.forEach((event) => list.appendChild(this.eventNode(event, dayStart)));
        }
        return list;
    },

    getDom() {
        const card = this.el("div", "agenda");

        if (this.config.header) {
            const header = this.el("div", "agenda__header");
            header.appendChild(this.el("i", "fas fa-calendar"));
            header.appendChild(document.createTextNode(` ${this.config.header}`));
            card.appendChild(header);
        }

        if (!this.loaded) {
            card.appendChild(this.el("div", "agenda-empty", "Loading calendar…"));
            return card;
        }

        const today = moment().startOf("day");

        // Today: expanded block
        const todayBlock = this.el("div", "agenda-today");
        const todayHeader = this.el("div", "agenda-today__header");
        todayHeader.appendChild(this.el("span", "agenda-today__label", "Today"));
        todayHeader.appendChild(this.el("span", "agenda-today__date", today.format("ddd, MMM D")));
        todayBlock.appendChild(todayHeader);
        todayBlock.appendChild(this.eventList(today));
        card.appendChild(todayBlock);

        // Following days: one row each
        for (let i = 1; i < this.config.days; i++) {
            const day = today.clone().add(i, "days");
            const row = this.el("div", "agenda-day");

            const label = this.el("div", "agenda-day__label");
            label.appendChild(this.el("span", "agenda-day__name", day.format("ddd")));
            label.appendChild(this.el("span", "agenda-day__date", day.format("MMM D")));
            row.appendChild(label);

            row.appendChild(this.eventList(day));
            card.appendChild(row);
        }

        return card;
    }
});
