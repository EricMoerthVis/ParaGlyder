/////////////////////////////////////////////////////////
/////////////// The Radar Chart Function ////////////////
/////////////// Written by Nadieh Bremer ////////////////
////////////////// VisualCinnamon.com ///////////////////
/////////// Inspired by the code of alangrafu ///////////
/////////////////////////////////////////////////////////

function RadarChartToolTip(id, data, legendText, options) {
    var cfgToolTip = {
        w: 600,				//Width of the circle
        h: 600,				//Height of the circle
        margin: {top: 20, right: 20, bottom: 20, left: 20}, //The margins of the SVG
        levels: 2,				//How many levels or inner circles should there be drawn
        maxValue: 0, 			//What is the value that the biggest circle will represent
        labelFactor: 1.25, 	//How much farther than the radius of the outer circle should the labels be placed
        wrapWidth: 80, 		//The number of pixels after which a label needs to be given a new line
        opacityArea: 0.55, 	//The opacity of the area of the blob
        dotRadius: 8, 			//The size of the colored circles of each blog
        opacityCircles: 0.1, 	//The opacity of the circles of each blob
        strokeWidth: 4, 		//The width of the stroke around each blob
        roundStrokes: false,	//If true the area and stroke will follow a round path (cardinal-closed)
        color: d3.scale.category10(),	//Color function
    };

    //Put all of the options into a variable called cfgToolTip
    if ('undefined' !== typeof options) {
        for (var i in options) {
            if ('undefined' !== typeof options[i]) {
                cfgToolTip[i] = options[i];
            }
        }//for i
    }//if

    //Remove whatever chart with the same id/class was present before
    d3.select(id).select("svg").remove();

    //If the supplied maxValue is smaller than the actual one, replace by the max in the data
    var maxValue = Math.max(cfgToolTip.maxValue, d3.max(data, function (i) {
        return d3.max(i.map(function (o) {
            return o.q75;
        }))
    }));

    if (data.length !== 0) {
        var allAxis = (data[0].map(function (i, j) {
                return i.axis
            })),	//Names of each axis
            total = allAxis.length,					//The number of different axes
            radius = Math.min(cfgToolTip.w / 2, cfgToolTip.h / 2), 	//Radius of the outermost circle
            Format = d3.format('%'),			 	//Percentage formatting
            angleSlice = Math.PI * 2 / total;		//The width in radians of each "slice"

        //Scale for the radius
        var rScale = d3.scale.linear()
            .range([0, radius])
            .domain([0, maxValue]);

        /////////////////////////////////////////////////////////
        //////////// Create the containerMriAnalyzer SVG and g /////////////
        /////////////////////////////////////////////////////////


        //Initiate the radar chart SVG
        var svg = d3.select(id).append("svg")
            .attr("width", cfgToolTip.w + cfgToolTip.margin.left + cfgToolTip.margin.right)
            .attr("height", cfgToolTip.h + cfgToolTip.margin.top + cfgToolTip.margin.bottom)
            .attr("class", "radar" + id);
        //Append a g element
        var g = svg.append("g")
            .attr("transform", "translate(" + (cfgToolTip.w / 2 + cfgToolTip.margin.left) + "," + (cfgToolTip.h / 2 + cfgToolTip.margin.top) + ")");

        /////////////////////////////////////////////////////////
        ////////// Glow filter for some extra pizzazz ///////////
        /////////////////////////////////////////////////////////

        //Filter for the outside glow
        var filter = g.append('defs').append('filter').attr('id', 'glowTooltip'),
            feGaussianBlur = filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlurTooltip'),
            feMerge = filter.append('feMerge'),
            feMergeNode_1 = feMerge.append('feMergeNode').attr('in', 'coloredBlurTooltip'),
            feMergeNode_2 = feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        /////////////////////////////////////////////////////////
        /////////////// Draw the Circular grid //////////////////
        /////////////////////////////////////////////////////////

        //Wrapper for the grid & axes
        var axisGrid = g.append("g").attr("class", "axisWrapper");

        //Draw the background circles
        axisGrid.selectAll(".levels")
            .data(d3.range(1, (cfgToolTip.levels + 1)).reverse())
            .enter()
            .append("circle")
            .attr("class", "gridCircle")
            .attr("r", function (d, i) {
                return radius / cfgToolTip.levels * d;
            })
            .style("fill", "#CDCDCD")
            .style("stroke", "#CDCDCD")
            .style("fill-opacity", cfgToolTip.opacityCircles)
            .style("filter", "url(#glowTooltip)");

        //Text indicating at what % each level is
        axisGrid.selectAll(".axisLabel")
            .data(d3.range(1, (cfgToolTip.levels + 1)).reverse())
            .enter().append("text")
            .attr("class", "axisLabel")
            .attr("x", 4)
            .attr("y", function (d) {
                return -d * radius / cfgToolTip.levels;
            })
            .attr("dy", "0.4em")
            .style("font-size", "10px")
            .attr("fill", "#e9e9e9")
            .text(function (d, i) {
                return Format(maxValue * d / cfgToolTip.levels);
            });

        /////////////////////////////////////////////////////////
        //////////////////// Draw the axes //////////////////////
        /////////////////////////////////////////////////////////

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
                return rScale(maxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("y2", function (d, i) {
                return rScale(maxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .attr("class", "line")
            .style("stroke", "white")
            .style("stroke-width", "2px");

        //Append the labels at each axis
        axis.append("text")
            .attr("class", "legend")
            .style("font-family", "Calibri")
            .style("font-size", "14px")
            .style("fill", "#FFFFFF")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("x", function (d, i) {
                return rScale(maxValue * cfgToolTip.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2);
            })
            .attr("y", function (d, i) {
                return rScale(maxValue * cfgToolTip.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2);
            })
            .text(function (d) {
                return d
            })
            .call(wrap, cfgToolTip.wrapWidth);

        /////////////////////////////////////////////////////////
        ///////////// Draw the radar chart blobs ////////////////
        /////////////////////////////////////////////////////////

        //The radial line function
        var radarLine = d3.svg.line.radial()
            .interpolate("linear-closed")
            .radius(function (d) {
                return rScale(d.mean);
            })
            .angle(function (d, i) {
                return i * angleSlice;
            });
        //
        // if (cfgToolTip.roundStrokes) {
        //     radarLine.interpolate("cardinal-closed");
        // }

        var area = d3.svg.area.radial()
            .interpolate("linear-closed")
            .angle(function (d, i) {
                return i * angleSlice;
            })
            .innerRadius(function (d) {
                return rScale(d.q25);
            })
            .outerRadius(function (d) {
                return rScale(d.q75);
            });

        //Create a wrapper for the blobs
        var blobWrapper = g.selectAll(".radarWrapper")
            .data(data)
            .enter().append("g")
            .attr("class", "radarWrapper");

        //Append the backgrounds
        blobWrapper
            .append("path")
            .attr("class", "radarArea")
            .attr("d", function (d, i) {
                return area(d, i);
            })
            .style("fill", function (d, i) {
                // return cfgToolTip.color(i);
                return d[0].color;
            })
            .style("fill-opacity", cfgToolTip.opacityArea)
            .on('mouseover', function (d, i) {
                //Dim all blobs
                d3.selectAll(".radarArea")
                    .transition().duration(200)
                    .style("fill-opacity", 0.1);
                //Bring back the hovered over blob
                d3.select(this)
                    .transition().duration(200)
                    .style("fill-opacity", 0.7);
            })
            .on('mouseout', function () {
                //Bring back all blobs
                d3.selectAll(".radarArea")
                    .transition().duration(200)
                    .style("fill-opacity", cfgToolTip.opacityArea);
            });

        //Create the outlines
        blobWrapper.append("path")
            .attr("class", "radarStroke")
            .attr("d", function (d, i) {
                return radarLine(d);
            })
            .style("stroke-width", cfgToolTip.strokeWidth + "px")
            .style("stroke", function (d, i) {
                // return cfgToolTip.color(i);
                return d[0].color;
            })
            .style("stroke-opacity", 1.0)
            .style("fill", "none")
            .style("filter", "url(#glowTooltip)");
    }
}//RadarChart
