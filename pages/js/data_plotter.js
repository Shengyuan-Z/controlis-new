function safeNewPlot(divId, traces, layout) {
    if (typeof Plotly === "undefined") return;
    const div = document.getElementById(divId);
    if (!div) return;
    Plotly.newPlot(divId, traces, layout, {displayModeBar: false});
}

function makeTrace(name, color) {
    return {
        x: [],
        y: [],
        mode: "lines",
        line: { color },
        name
    };
}

// Current (3-phase)
var data_c1_Trace = makeTrace("Current Phase-1", "rgb(85,3,14)");
var data_c2_Trace = makeTrace("Current Phase-2", "rgb(5,17,124)");
var data_c3_Trace = makeTrace("Current Phase-3", "rgb(24,101,3)");
var data_current_layout = {
    xaxis: { title: "Time", type: "date" },
    yaxis: { title: "Current (A)" },
    title: "3-phase Current"
};
safeNewPlot("current3phPlot", [data_c1_Trace, data_c2_Trace, data_c3_Trace], data_current_layout);

// Voltage (3-phase)
var data_v1_Trace = makeTrace("Voltage Phase-1", "rgb(85,3,14)");
var data_v2_Trace = makeTrace("Voltage Phase-2", "rgb(5,17,124)");
var data_v3_Trace = makeTrace("Voltage Phase-3", "rgb(24,101,3)");
var data_voltage_layout = {
    xaxis: { title: "Time", type: "date" },
    yaxis: { title: "Voltage (V)" },
    title: "3-phase Voltage"
};
safeNewPlot("voltage3phPlot", [data_v1_Trace, data_v2_Trace, data_v3_Trace], data_voltage_layout);