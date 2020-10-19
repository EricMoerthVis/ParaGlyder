/* Radar chart design created by Nadieh Bremer - VisualCinnamon.com */

//////////////////////////////////////////////////////////////
//////////////////////// Set-Up //////////////////////////////
//////////////////////////////////////////////////////////////

var margin = {top: 100, right: 100, bottom: 100, left: 100},
    width = Math.min(700, document.getElementById('Radar') !== null ?
        document.getElementById('Radar').offsetWidth - 10 : 700) - margin.left - margin.right,
    height = Math.min(width, document.getElementById('Radar') !== null ?
        document.getElementById('Radar').offsetWidth - margin.top - margin.bottom - 20 : width);

//////////////////////////////////////////////////////////////
//////////////////// Draw the Chart //////////////////////////
//////////////////////////////////////////////////////////////
var color = d3.scale.ordinal()
    .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"]);

var radarChartOptions = {
    w: width,
    h: height,
    margin: margin,
    dotRadius: 5,
    maxValue: 0.5,
    levels: 5,
    roundStrokes: true,
    color: color
};

function setRadarMaxVal(maxVal) {
    radarChartOptions.maxValue = maxVal;
}

function updateDimensions() {
    width =  Math.min(2000, document.getElementById('Radar') !== null ?
        document.getElementById('Radar').offsetWidth - 10 : 700) - margin.left - margin.right;
    radarChartOptions.w = width;
    radarChartOptions.h = Math.min(width, document.getElementById('Radar') !== null ?
        document.getElementById('Radar').offsetWidth - margin.top - margin.bottom - 20 : width);;
}