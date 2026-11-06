/* MagicMirror² Module: MMM-CaBiStatus
* Shows Capital Bikeshare availability (classic vs ebike) for selected stations.
*/
Module.register("MMM-CaBiStatus", {
    defaults: {
        stationIds: [],            // e.g., ["31205","31214"]
        updateInterval: 30 * 1000, // 30s
        showDocks: true,
        header: "Capital Bikeshare",
        lowThreshold: 2,           // counts at or below this are highlighted as "running low"
        statusAgingMinutes: 2,     // status dot turns amber when data is this old
        statusStaleMinutes: 5,     // ...and red at this age
        statusErrorMinutes: 30,    // ...and at this age a warning icon + "Last updated <time>" replaces the dot
        loadTimeoutMinutes: 2      // after this long with no data at all, show "Can't load data"
    },

    start() {
        this.stations = {}; // { station_id: {name, ebikes, classic, docks, lastReported} }
        this.loaded = false;
        this.lastFetched = null;   // when the dashboard last received data (not when stations reported)
        this.startedAt = Date.now();

        // Re-draw every 30s even if no new data arrives, so the status dot can age
        setInterval(() => this.updateDom(), 30 * 1000);
        this.sendSocketNotification("CABI_CONFIG", {
            stationIds: this.config.stationIds,
            updateInterval: this.config.updateInterval
        });
    },

    getStyles() { return ["MMM-CaBiStatus.css"]; },

    // The header is drawn inside the card instead of MagicMirror's default header bar
    getHeader() { return ""; },

    socketNotificationReceived(notification, payload) {
        if (notification === "CABI_DATA") {
            this.stations = payload;
            this.loaded = true;
            this.lastFetched = Date.now();
            this.updateDom();
        }
    },

    el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    },

    countLevel(value) {
        if (value === null || value === undefined) return "";
        if (value === 0) return "cabi-count--empty";
        if (value <= this.config.lowThreshold) return "cabi-count--low";
        return "";
    },

    // A big number with a small icon label underneath, e.g. "7" over a bike icon
    countCell(value, iconClass, label) {
        const cell = this.el("div", `cabi-count ${this.countLevel(value)}`);
        cell.appendChild(this.el("div", "cabi-count__value", value ?? "—"));

        const caption = this.el("div", "cabi-count__label");
        const icon = this.el("i", iconClass);
        caption.appendChild(icon);
        caption.appendChild(document.createTextNode(` ${label}`));
        cell.appendChild(caption);
        return cell;
    },

    getDom() {
        const card = this.el("div", "cabi");

        const header = this.el("div", "cabi__header");
        const title = this.el("span", "cabi__title");
        title.appendChild(this.el("i", "fas fa-bicycle"));
        title.appendChild(document.createTextNode(` ${this.config.header}`));
        header.appendChild(title);
        card.appendChild(header);

        if (!this.loaded) {
            const waitedMinutes = (Date.now() - this.startedAt) / 60000;
            if (waitedMinutes >= this.config.loadTimeoutMinutes) {
                const error = this.el("div", "cabi__empty status-error");
                error.appendChild(this.el("i", "fas fa-triangle-exclamation"));
                error.appendChild(document.createTextNode(" Can't load bike data"));
                card.appendChild(error);
            } else {
                card.appendChild(this.el("div", "cabi__empty", "Loading bike availability…"));
            }
            return card;
        }

        let shown = 0;
        this.config.stationIds.forEach(id => {
            const s = this.stations[id];
            if (!s) return;
            shown++;

            const row = this.el("div", "cabi-row");
            row.appendChild(this.el("div", "cabi-row__name", s.name || id));
            row.appendChild(this.countCell(s.classic, "fas fa-bicycle", "bikes"));
            row.appendChild(this.countCell(s.ebikes, "fas fa-bolt", "e-bikes"));

            if (this.config.showDocks) {
                const docks = this.el("div", "cabi-row__docks");
                docks.appendChild(this.el("span", "cabi-row__docks-value", s.docks ?? "—"));
                docks.appendChild(document.createTextNode(" docks"));
                row.appendChild(docks);
            }

            card.appendChild(row);
        });

        if (shown === 0) {
            card.appendChild(this.el("div", "cabi__empty", "No station data"));
        }

        // Status dot at the right end of the header: green = fresh, amber = getting old, red = out of date
        if (this.lastFetched) {
            const ageMinutes = (Date.now() - this.lastFetched) / 60000;

            if (ageMinutes >= this.config.statusErrorMinutes) {
                // Long outage: warning icon + when data last arrived
                const time = moment(this.lastFetched).format(config.timeFormat === 24 ? "HH:mm" : "h:mm a");
                const error = this.el("span", "status-error");
                error.appendChild(this.el("i", "fas fa-triangle-exclamation"));
                error.appendChild(document.createTextNode(` Last updated ${time}`));
                header.appendChild(error);
            } else {
                let status = "fresh";
                if (ageMinutes >= this.config.statusStaleMinutes) status = "stale";
                else if (ageMinutes >= this.config.statusAgingMinutes) status = "aging";
                header.appendChild(this.el("span", `status-dot status-dot--${status}`));
            }
        }

        return card;
    }
});
