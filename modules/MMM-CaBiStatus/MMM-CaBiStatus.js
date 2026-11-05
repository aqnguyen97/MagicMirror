/* MagicMirror² Module: MMM-CaBiStatus
* Shows Capital Bikeshare availability (classic vs ebike) for selected stations.
*/
Module.register("MMM-CaBiStatus", {
    defaults: {
        stationIds: [],           // e.g., ["31205","31214"]
        updateInterval: 30 * 1000, // 30s
        showDocks: true,
        header: "Capital Bikeshare"
    },

    start() {
        this.stations = {}; // { station_id: {name, ebikes, classic, docks, lastReported} }
        this.loaded = false;
        this.sendSocketNotification("CABI_CONFIG", {
            stationIds: this.config.stationIds,
            updateInterval: this.config.updateInterval
        });
    },

    getStyles() { return ["MMM-CaBiStatus.css"]; },
    getHeader() { return this.config.header; },

    socketNotificationReceived(notification, payload) {
        if (notification === "CABI_DATA") {
            this.stations = payload;
            this.loaded = true;
            this.updateDom();
        }
    },

    getDom() {
        const wrapper = document.createElement("div");
        if (!this.loaded) { wrapper.innerHTML = "Loading Capital Bikeshare…"; return wrapper; }

        const table = document.createElement("table");
        table.className = "cabi-table small light";

        // header row
        const head = document.createElement("tr");
        ["Station", "Classic", "E-bikes"].concat(this.config.showDocks ? ["Docks"] : []).forEach(h => {
            const th = document.createElement("th"); th.textContent = h; head.appendChild(th);
        });
        table.appendChild(head);

        // rows
        this.config.stationIds.forEach(id => {
            const s = this.stations[id];
            if (!s) return;
            const tr = document.createElement("tr");
            const cols = [
                s.name || id,
                s.classic,
                s.ebikes
            ];
            if (this.config.showDocks) cols.push(s.docks);

            cols.forEach(val => {
                const td = document.createElement("td");
                td.textContent = val ?? "—";
                tr.appendChild(td);
            });
            table.appendChild(tr);
        });

        wrapper.appendChild(table);

        // timestamp
        const ts = document.createElement("div");
        ts.className = "xsmall dimmed timestamp";
        const latest = Math.max(...Object.values(this.stations).map(s => s.lastReported || 0));
        if (latest) ts.textContent = `Updated ${new Date(latest * 1000).toLocaleTimeString()}`;
        wrapper.appendChild(ts);

        return wrapper;
    }
});
