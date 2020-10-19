/////////////////////////////////////////////////////////
/////////////// The RIXEL       Function ////////////////
/////////////// Written by Eric Mörth    ////////////////
/////////////////////////////////////////////////////////
var tumorInfo;
var tumorMax;

function createRixel(id,number,tooltip, data, w, h, maxValue = 0) {
    var cfgRixels = {
        w: 0,				//Width of the circle
        h: 0,				//Height of the circle
        maxValue: 0,
        dotRadius: 1,
        opacityAreaRixel: 0.8,
        opacityStroke: 1,
        strokeWidth: 0.6, 		//The width of the stroke around each blob
        roundStrokes: true,	//If true the area and stroke will follow a round path (cardinal-closed)
        color: d3.scale.ordinal().range(["#1782b2", "#66FFFD", "#AAFFDC"]),
        colorSimilarity: (value) => d3.interpolateViridis(value),
        margin: {top: 0, right: 0, bottom: 0, left: 0}, //The margins of the SVG
    };
    cfgRixels.w = w;
    cfgRixels.h = h;
    cfgRixels.maxValue = maxValue;

    let tumorInfoArray = data[0][data[0].length-1];
    if(tumorInfoArray !== undefined){
        tumorInfo = new Map();
        tumorMax = 0;
        // normalize the values with the largest value
        tumorInfoArray.forEach((info) => {
            if(info.value > tumorMax){
                tumorMax = info.value;
            }
        });
        tumorInfoArray.forEach((info) => {
            tumorInfo.set(info.axis, info.value / tumorMax);
        });

    }else{
        tumorInfo = undefined;
    }
    data[0] = data[0].slice(0,data[0].length-1);

    var similarity = function (data) {
        let sim = 0;
        let dataMax = 0;
        data.forEach((valPair) => {
            if(valPair.value > dataMax){
                dataMax = valPair.value;
            }
        });
        data.forEach((valPair) => {
            sim += Math.pow(((valPair.value/dataMax) - tumorInfo.get(valPair.axis)), 2);
        });
        sim = Math.sqrt(sim);
        // console.log(sim);
        return 1-sim;
    };


    var colortooltip = function (d, cfgRixels, i){
        if(tumorInfo !== undefined){
            var val = similarity(d);
            return cfgRixels.colorSimilarity(val);
        }else{
            return cfgRixels.color(i);
        }
    }


    //If the supplied maxValue is smaller than the actual one, replace by the max in the data
    var maxValue = Math.max(cfgRixels.maxValue, d3.max(data, function (i) {
        return d3.max(i.map(function (o) {
            return o.value;
        }))
    }));

    var allAxis = (data[0].map(function (i, j) {
            return i.axis
        })),	//Names of each axis
        total = allAxis.length,					//The number of different axes
        radius = Math.min(cfgRixels.w / 2, cfgRixels.h / 2), 	//Radius of the outermost circle
        Format = d3.format('%'),			 	//Percentage formatting
        angleSlice = Math.PI * 2 / total;		//The width in radians of each "slice"

    //Scale for the radius
    var rScale = d3.scale.linear()
        .range([0, radius])
        .domain([0, maxValue]);

    //  d3.select(id).select("svg").remove();
    //Initiate the radar chart SVG
    var svg = d3.select(id).append("svg")
        .attr("width", cfgRixels.w + cfgRixels.margin.left + cfgRixels.margin.right)
        .attr("height", cfgRixels.h + cfgRixels.margin.top + cfgRixels.margin.bottom)
        .attr("class", "radar" + id);
    //Append a g element
    var g = svg.append("g")
        .attr("transform", "translate(" + (cfgRixels.w / 2 + cfgRixels.margin.left) + "," + (cfgRixels.h / 2 + cfgRixels.margin.top) + ")");

    // Show the grid
    var border=1;
    svg.attr("border",border);
    let grid = svg.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", h)
        .attr("width", w)
        .attr("opacity", 0)
        .style("stroke", "#CCCCCC")
        .style("fill", "none")
        .style("stroke-width", border);
    // Show the grid END

    //Filter for the outside glow
    var filterRixelDef = g.append("defs");
    var filter = filterRixelDef.append('filter')
        .attr('id', 'glowRixel'),
        feGaussianBlur = filter.append('feGaussianBlur')
        .attr('stdDeviation', '1')
        .attr('result', 'coloredBlurRixel'),
        feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlurRixel');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    /////////////////////////////////////////////////////////
    //////////////////// Draw the axes //////////////////////
    /////////////////////////////////////////////////////////

    //Wrapper for the grid & axes
    var axisGrid = g.append("g").attr("class", "axisWrapper");

    /////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////
    ///////////// Draw the radar chart blobs ////////////////
    /////////////////////////////////////////////////////////

    //The radial line function
    var radarLine = d3.svg.line.radial()
        .interpolate("linear-closed")
        .radius(function (d) {
            return rScale(d.value);
        })
        .angle(function (d, i) {
            return i * angleSlice;
        });

    if (cfgRixels.roundStrokes) {
      //  radarLine.interpolate("cardinal-closed");
    }

    //Create a wrapper for the blobs
    var rixelWrapper = g.selectAll(".radarWrapper")
        .data(data)
        .enter().append("g")
        .attr("class", "radarWrapper");

    // Define the div for the tooltip
    // var tooltip = d3.select("body").append("div")
    //     .attr("class", "tooltip")
    //     .style("opacity", 0);


    var tool_tip;
    //Append the backgrounds
    rixelWrapper
        .append("path")
        .attr("class", "radarArea")
        .attr("d", function (d, i) {
            return radarLine(d);
        })
        .style("fill", function (d, i) {
            if(tumorInfo !== undefined){
                var val = similarity(d);
                return cfgRixels.colorSimilarity(val);
            }else{
                return cfgRixels.color(i);
            }
        })
        .style("fill-opacity", cfgRixels.opacityAreaRixel)
        .on('mouseover', function (d, i) {
            //Dim all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", 0.1);
            d3.selectAll(".radarStroke")
                .transition().duration(200)
                .style("stroke-opacity", 0.1);
            d3.selectAll(".line")
                .transition().duration(200)
                .style("stroke-opacity", 0.1);
            //Bring back the hovered over blob
            d3.select(this)
                .transition().duration(200)
                .style("fill-opacity", 0.7);

            svg.call(tooltip);
            //Show tooltip by using the data d => Create radarChart in the container of the tooltip
            tooltip.show();
            //
            // tooltip.transition()
            //     .duration(200)
            //     .style("opacity", .9);
            // tooltip.html("<div id='tip'></div>")
            //     .style("left", (d3.event.pageX) + "px")
            //     .style("top", (d3.event.pageY) + "px");
            d[0].color = colortooltip(d, cfgRixels, i);
            RadarChartToolTip("#tipDiv", [d], ["Rixel"],
                {w:220, h:220, dotRadius: 0,
                    margin: {top: 80, right: 80, bottom: 80, left: 80},  levels: 3, labelFactor: 1.5});
        })
        .on('mouseout', function () {
            //Bring back all blobs
            d3.selectAll(".radarArea")
                .transition().duration(200)
                .style("fill-opacity", cfgRixels.opacityAreaRixel);
            d3.selectAll(".radarStroke")
                .transition().duration(200)
                .style("stroke-opacity", cfgRixels.opacityStroke);
            d3.selectAll(".line")
                .transition().duration(200)
                .style("stroke-opacity", 1);

            tooltip.hide();
            // tooltip.transition()
            //     .duration(500)
            //     .style("opacity", 0);
        });

    //Create the outlines
    //Create the outlines
    rixelWrapper.append("path")
        .attr("class", "radarStroke")
        .attr("d", function(d,i) { return radarLine(d); })
        .style("stroke-width", cfgRixels.strokeWidth + "px")
        .style("stroke-opacity", cfgRixels.opacityStroke)
        .style("stroke", function(d,i) {
            if(tumorInfo !== undefined){
                var val = similarity(d);
                return cfgRixels.colorSimilarity(val);
            }else{
                return cfgRixels.color(i);
            }
        })
        .style("fill", "none")
        .style("filter" , "url(#glowRixel)");

    //Create the straight lines radiating outward from the center
    var axis = axisGrid.selectAll(".axis")
        .data(allAxis)
        .enter()
        .append("g")
        .attr("class", "axis");
    //Append the lines
    axis.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", function (d, i) {
            // return rScale(maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2);
            return rScale(data[0][i].value) * Math.cos(angleSlice * i - Math.PI / 2);
        })
        .attr("y2", function (d, i) {
            return rScale(data[0][i].value) * Math.sin(angleSlice * i - Math.PI / 2);
        })
        .attr("class", "line")
        .style("stroke", "darkgray")
        .style("stroke-opacity", 1)
        .style("stroke-width", "0.7px");

    return grid;
}



/**
 * Derived from:
 *
 * https://gist.github.com/Daniel-Hug/7273430#file-arr-stat-js
 */
var arr = {
    max: function(array) {
        return Math.max.apply(null, array);
    },

    min: function(array) {
        return Math.min.apply(null, array);
    },

    range: function(array) {
        return arr.max(array) - arr.min(array);
    },

    midrange: function(array) {
        return arr.range(array) / 2;
    },

    sum: function(array) {
        var num = 0;
        for (var i = 0, l = array.length; i < l; i++) num += array[i];
        return num;
    },

    mean: function(array) {
        return arr.sum(array) / array.length;
    },

    median: function(array) {
        array.sort(function(a, b) {
            return a - b;
        });
        var mid = array.length / 2;
        return mid % 1 ? array[mid - 0.5] : (array[mid - 1] + array[mid]) / 2;
    },

    modes: function(array) {
        if (!array.length) return [];
        var modeMap = {},
            maxCount = 0,
            modes = [];

        array.forEach(function(val) {
            if (!modeMap[val]) modeMap[val] = 1;
            else modeMap[val]++;

            if (modeMap[val] > maxCount) {
                modes = [val];
                maxCount = modeMap[val];
            }
            else if (modeMap[val] === maxCount) {
                modes.push(val);
                maxCount = modeMap[val];
            }
        });
        return modes;
    },

    variance: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.pow(num - mean, 2);
        }));
    },

    standardDeviation: function(array) {
        return Math.sqrt(arr.variance(array));
    },

    meanAbsoluteDeviation: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.abs(num - mean);
        }));
    },

    zScores: function(array) {
        var mean = arr.mean(array);
        var standardDeviation = arr.standardDeviation(array);
        return array.map(function(num) {
            return (num - mean) / standardDeviation;
        });
    }
};

// Function aliases:
arr.average = arr.mean;
