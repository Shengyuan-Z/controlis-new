/*
Acceleration Data
 */
var data_xyz_XTrace = {
    y: [],
    mode: "lines",
    line: {
        color: 'rgb(85,3,14)'
    },
    name: "X-axis"
}
var data_xyz_YTrace = {
    y: [],
    mode: "lines",
    line: {
        color: "rgb(5,17,124)"
    },
    name: "Y-axis"
}
var data_xyz_ZTrace = {
    y: [],
    mode: "lines",
    line: {
        color: "rgb(24,101,3)"
    },
    name: "Z-axis"
}
// Layout
var data_xyz_layout = {
    yaxis: {
        title: "Acceleration(g)"
    },
    title: "3D Acceleration"
}
Plotly.newPlot('accXYZPlot', [data_xyz_XTrace, data_xyz_YTrace, data_xyz_ZTrace], data_xyz_layout,
    {displayModeBar: false})


/*
Current Data
 */
var data_c1_XTrace = {
    y: [],
    mode: "lines",
    line: {
        color: 'rgb(85,3,14)'
    },
    name: "Current Phase-1"
}
var data_c2_YTrace = {
    y: [],
    mode: "lines",
    line: {
        color: "rgb(5,17,124)"
    },
    name: "Current Phase-2"
}
var data_c3_ZTrace = {
    y: [],
    mode: "lines",
    line: {
        color: "rgb(24,101,3)"
    },
    name: "Current Phase-3"
}
// Layout
var data_current_layout = {
    yaxis: {
        title: "Current (A)"
    },
    title: "3-phase Current"
}
Plotly.newPlot('current3phPlot', [data_c1_XTrace, data_c2_YTrace, data_c3_ZTrace], data_current_layout,
    {displayModeBar: false})