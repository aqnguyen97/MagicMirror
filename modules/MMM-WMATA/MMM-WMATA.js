/* global Module, Log, moment */
Module.register("MMM-WMATA", {
    requiresVersion: '2.2.0',

    defaults: {
        apiKey: "",

        trainStations: [],
        trainUpdateInterval: 60,

        showTrainIncidents: true,
        trainIncidentUpdateInterval: 300,

        busStops: [],
        busUpdateInterval: 60,
        showEmptyBusStops: true,
        busStopFilterFn: (_datetime, _stationCode) => true,
        busRouteIncidentFilterFn: (_incidentType, _route) => true,

        showBusIncidents: true,
        busIncidentUpdateInterval: 300,

        busIncidentRoutes: null,

        // Dashboard layout options
        trainWalkMinutes: 0,      // minutes to walk to the station; 0 turns off leave-now coloring
        busWalkMinutes: 0,        // minutes to walk to the bus stop
        leaveNowWindow: 3,        // arrivals within walk..walk+window minutes are shown as "leave now"
        showWalkTimes: true,      // show "· N min walk" in the column headers
        laterArrivals: 2,         // how many following arrivals to show next to the big number
        busStopsLabel: null,      // header for the bus column; defaults to the first stop's name
        ignoreBusRoutes: {},      // routes to hide per stop, e.g. { "1001653": ["C57"] }
        // Optional: combine stops/routes into one row each, showing whichever bus comes next.
        // [{ label: "Florida & Georgia", detail: "Northbound", stops: ["1001653"], routes: ["C51", "C53"], walkMinutes: 3 }, ...]
        // detail (a smaller second line), routes and walkMinutes are optional.
        // When set, busStops is filled in from the groups.
        busGroups: [],
    },

    /**
     * Core method, called when all modules are loaded and the system is ready to boot up.
     */
    start() {
        if (this.config.busGroups.length > 0) {
            const stops = this.config.busGroups.flatMap((group) => group.stops);
            this.config.busStops = [...new Set([...this.config.busStops, ...stops])];
        }

        this.apiKey = null;
        this.initialized = false;

        this.trainUpdateInterval = 0;
        this.busUpdateInterval = 0;

        this.trainIncidentUpdateInterval = 0;
        this.busIncidentUpdateInterval = 0;

        this.trainTimesLastUpdatedTimestamp = null;
        this.trainTimesLastUpdatedFormatted = null;

        this.busTimesLastUpdatedTimestamp = null;
        this.busTimesLastUpdatedFormatted = null;

        this.formattedTrainData = null;
        this.formattedBusData = null;
        this.formattedTrainIncidentData = null;
        this.formattedBusIncidentData = null;

        this.trainDelays = [];
        this.trainAlerts = [];

        this.busDelays = [];
        this.busAlerts = [];

        this.activeBusStops = [];

        Log.info("WMATA Starting");

        this.sendSocketNotification("WMATA_INIT", {
            identifier: this.identifier,
            apiKey: this.config.wmataApiKey,
            trainStations: this.config.trainStations,
        });
    },

    socketNotificationReceived(notification, payload) {
        if (payload.identifier === this.identifier) {
            const now = moment();

            switch (notification) {
                case "WMATA_INITIALIZED":
                    this.initialized = true;

                    this.startFetchingLoops();
                    break;
                case "WMATA_TRAIN_TIMES_DATA":
                    this.trainTimesLastUpdatedTimestamp = now.format("x");
                    this.trainTimesLastUpdatedFormatted = now.format("MMM D - h:mm:ss a");

                    this.formattedTrainData = this.formatTrains(payload.trainData);

                    this.updateDom();

                    break;
                case "WMATA_BUS_TIMES_DATA":
                    console.log(`received data ${payload.busPredictions}`);
                    console.debug(payload.busPredictions);

                    this.busTimesLastUpdatedTimestamp = now.format("x");
                    this.busTimesLastUpdatedFormatted = now.format("MMM D - h:mm:ss a");
                    this.activeBusStops = Object.keys(payload.busPredictions).filter((stopID) => {
                        return payload.busPredictions[stopID].predictions.length > 0;
                    });

                    console.log("active stops");
                    console.debug(this.activeBusStops);

                    this.formattedBusData = this.formatBuses(payload.busPredictions);

                    this.updateDom();
                    break;
                case "WMATA_TRAIN_INCIDENTS_DATA":
                    console.log("received update for train incidents");
                    console.debug(payload.trainDelays);
                    console.debug(payload.trainAlerts);

                    this.trainDelays = payload.trainDelays.map(this.formatTrainLine);
                    this.trainAlerts = payload.trainAlerts.map(this.formatTrainLine);

                    this.updateDom();
                    break;
                case "WMATA_BUS_INCIDENTS_DATA":
                    this.busDelays = payload.busDelays.filter((route) => this.config.busRouteIncidentFilterFn('delay', route));
                    this.busAlerts = payload.busAlerts.filter((route) => this.config.busRouteIncidentFilterFn('alert', route));

                    this.updateDom();
                    break;
            }
        }
    },

    getStyles() {
        return ["MMM-WMATA.css"];
    },

    getTranslations() {
        return {
            en: "translations/en.json"
        };
    },

    getTemplate() {
        return "MMM-WMATA.njk";
    },

    getTemplateData() {
        const trains = this.formattedTrainData;
        const buses = this.formattedBusData;

        const lastUpdated = Math.max(
            Number(this.trainTimesLastUpdatedTimestamp) || 0,
            Number(this.busTimesLastUpdatedTimestamp) || 0
        );

        return {
            loading: trains === null && buses === null,

            showTrains: this.config.trainStations.length > 0,
            trainStationName: trains ? trains.stationName : null,
            trainRows: trains ? trains.rows : [],
            trainWalkMinutes: this.config.trainWalkMinutes,
            showWalkTimes: this.config.showWalkTimes,

            showBuses: this.config.busStops.length > 0,
            busLabel: this.config.busStopsLabel || (buses ? buses.stopName : null) || "Buses",
            busRows: buses ? buses.rows : [],
            busWalkMinutes: this.config.busWalkMinutes,
            busesLoaded: buses !== null,

            notices: this.buildNotices(),
            updated: lastUpdated ? moment(lastUpdated).format("h:mm A") : null,
        };
    },

    buildNotices() {
        const notices = [];
        const lines = (list) => list.filter(Boolean).map((l) => `${l[0].toUpperCase()}${l.slice(1)}`).join(", ");

        if (this.trainDelays.length > 0) notices.push(`Delays on ${lines(this.trainDelays)} line`);
        if (this.trainAlerts.length > 0) notices.push(`Alerts on ${lines(this.trainAlerts)} line`);
        if (this.busDelays.length > 0) notices.push(`Bus delays: ${this.busDelays.join(", ")}`);
        if (this.busAlerts.length > 0) notices.push(`Bus alerts: ${this.busAlerts.join(", ")}`);

        return notices;
    },

    /**
     * Turns a list of arrival rows (each with a `minutes` array) into display rows:
     * the next arrival, a few later ones, and a status for the leave-now coloring.
     */
    finishRows(rows, defaultWalkMinutes) {
        return rows.map((row) => {
            const minutes = row.minutes.sort((a, b) => a - b);
            const next = minutes[0];
            const walkMinutes = row.walkMinutes ?? defaultWalkMinutes;

            let status = "";
            if (next !== undefined && walkMinutes > 0) {
                if (next < walkMinutes) {
                    status = "missed";
                } else if (next < walkMinutes + this.config.leaveNowWindow) {
                    status = "go";
                }
            }

            return {
                ...row,
                hasNext: next !== undefined,
                next,
                later: minutes.slice(1, 1 + this.config.laterArrivals),
                status,
            };
        });
    },

    startFetchingLoops() {
        // Need to check what we're fetching among:
        // busses, trains, bus incidents, and train incidents
        // Start immediately ...

        Log.info("Starting WMATA Fetching loops...");

        if (this.config.trainStations.length > 0) {
            this.startTrainTimeFetchingLoop(this.config.trainUpdateInterval);
        }

        if (this.config.busStops.length > 0) {
            this.startBusTimeFetchingLoop(this.config.busUpdateInterval);
        }

        if (this.config.showTrainIncidents === true) {
            this.startTrainIncidentsFetchingLoop(this.config.trainIncidentUpdateInterval);
        }

        if (this.config.showBusIncidents === true) {
            this.startBusIncidentsFetchingLoop(this.config.busIncidentUpdateInterval);
        }
    },

    startTrainTimeFetchingLoop(trainUpdateInterval) {
        Log.info("Starting fetching loop for train predictions");
        this.getTrainTimes();

        if (this.trainUpdateInterval === 0) {
            this.trainUpdateInterval = setInterval(() => {
                this.getTrainTimes();
            }, trainUpdateInterval * 1000);
        }
    },

    startBusTimeFetchingLoop(busUpdateInterval) {
        Log.info("Starting fetching loop for bus predictions");
        this.getBusTimes();

        if (this.busUpdateInterval === 0) {
            this.busUpdateInterval = setInterval(() => {
                this.getBusTimes();
            }, busUpdateInterval * 1000);
        }
    },

    startTrainIncidentsFetchingLoop(trainIncidentUpdateInterval) {
        Log.info("Starting fetching loop for train incidents");
        this.getTrainIncidents();

        if (this.trainIncidentUpdateInterval === 0) {
            this.trainIncidentUpdateInterval = setInterval(() => {
                this.getTrainIncidents();
            }, trainIncidentUpdateInterval * 1000);
        }
    },

    startBusIncidentsFetchingLoop(busIncidentUpdateInterval) {
        Log.info("Starting fetching loop for train incidents");
        this.getBusIncidents();

        if (this.busIncidentUpdateInterval === 0) {
            this.busIncidentUpdateInterval = setInterval(() => {
                this.getBusIncidents();
            }, busIncidentUpdateInterval * 1000);
        }
    },

    getTrainTimes() {
        Log.info("Fetching train predictions...");
        this.sendSocketNotification("WMATA_TRAIN_TIMES_GET", {
            identifier: this.identifier,
            apiKey: this.config.apiKey,
            stations: this.config.trainStations,
        });
    },

    getBusTimes() {
        Log.info("Fetching bus predictions...");

        this.sendSocketNotification("WMATA_BUS_TIMES_GET", {
            identifier: this.identifier,
            apiKey: this.config.apiKey,
            busStops: this.config.busStops.filter((stop) => {
                // If we're actively tracking buses, we'll always include this
                // station in the update.
                if (this.activeBusStops.includes(stop)) {
                    return true;
                }

                return this.config.busStopFilterFn(new Date(), stop);
            })
        });
    },

    getTrainIncidents() {
        Log.info("Fetching train incidents...");

        this.sendSocketNotification("WMATA_TRAIN_INCIDENTS_GET", {
            identifier: this.identifier,
            apiKey: this.config.apiKey
        });
    },

    getBusIncidents() {
        Log.info("Fetching bus incidents...");

        this.sendSocketNotification("WMATA_BUS_INCIDENTS_GET", {
            identifier: this.identifier,
            apiKey: this.config.apiKey,
            busIncidentRoutes: null,
        });
    },

    formatTrains(trains) {
        const passengerLines = ["RD", "BL", "YL", "OR", "GR", "SV"];
        const rowsByKey = new Map();

        for (const train of trains) {
            // Skip "No Passenger" trains and arrivals with no time yet
            if (!passengerLines.includes(train["Line"]) || train["MinNumber"] < 0) continue;

            const destination = train["DestinationName"] || train["Destination"];
            const key = `${train["Group"]}|${train["Line"]}|${destination}`;

            if (!rowsByKey.has(key)) {
                rowsByKey.set(key, {
                    line: train["Line"],
                    destination,
                    group: String(train["Group"]),
                    minutes: [],
                });
            }
            rowsByKey.get(key).minutes.push(train["MinNumber"]);
        }

        const rows = this.finishRows([...rowsByKey.values()], this.config.trainWalkMinutes)
            .sort((a, b) => a.group.localeCompare(b.group) || a.next - b.next);

        // Mark the first row of each track group so the template can add a gap
        rows.forEach((row, i) => {
            row.newGroup = i > 0 && rows[i - 1].group !== row.group;
        });

        return {
            stationName: trains.length > 0 ? trains[0]["LocationName"] : null,
            rows,
        };
    },

    formatBuses(busPredictions) {
        if (this.config.busGroups.length > 0) {
            return this.formatBusGroups(busPredictions);
        }

        const rowsByKey = new Map();
        let stopName = null;

        for (const [stopID, stopInfo] of Object.entries(busPredictions)) {
            stopName = stopName || stopInfo["locationName"];
            const ignoredRoutes = this.config.ignoreBusRoutes[stopID] || [];

            for (const prediction of stopInfo["predictions"] || []) {
                if (ignoredRoutes.includes(prediction["RouteID"])) continue;

                const key = `${prediction["RouteID"]}|${prediction["DirectionText"]}`;

                if (!rowsByKey.has(key)) {
                    rowsByKey.set(key, {
                        route: prediction["RouteID"],
                        direction: prediction["DirectionText"],
                        minutes: [],
                    });
                }
                rowsByKey.get(key).minutes.push(prediction["Minutes"]);
            }
        }

        const rows = this.finishRows([...rowsByKey.values()], this.config.busWalkMinutes)
            .sort((a, b) => a.next - b.next);

        return { stopName, rows };
    },

    /**
     * One row per configured group: every matching bus from the group's stops,
     * merged, with the route badge of whichever arrives first. Rows keep config order.
     */
    formatBusGroups(busPredictions) {
        const rows = this.config.busGroups.map((group) => {
            const arrivals = [];

            for (const stopID of group.stops) {
                for (const prediction of busPredictions[stopID]?.predictions || []) {
                    if (group.routes && !group.routes.includes(prediction["RouteID"])) continue;
                    arrivals.push({ minutes: prediction["Minutes"], route: prediction["RouteID"] });
                }
            }

            arrivals.sort((a, b) => a.minutes - b.minutes);

            return {
                route: arrivals.length > 0 ? arrivals[0].route : (group.routes || []).join("/"),
                direction: group.label,
                detail: group.detail,
                minutes: arrivals.map((a) => a.minutes),
                walkMinutes: group.walkMinutes,
            };
        });

        return { stopName: null, rows: this.finishRows(rows, this.config.busWalkMinutes) };
    },

    formatTrainLine(trainLine) {
        switch (trainLine) {
            case 'RD':
                return 'red';
            case 'BL':
                return 'blue';
            case 'YL':
                return 'yellow';
            case 'SV':
                return 'silver';
            case 'OR':
                return 'orange';
            case 'GR':
                return 'green';
        }
    },
});
