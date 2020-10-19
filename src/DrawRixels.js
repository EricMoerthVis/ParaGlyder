var containerSave;
var sliceValue = 0;
var gridSice = 1;
var newGridSize = 6;
var ready = false;
var sliceMode;
var userExtents = [];
var images;
var imageNames;
var imageExtent;
var imageBounds;
var sliceMax;
var sliceMin;
var tumorData;
var timeout;

self.addEventListener('message', function (e) {
    var data = e.data["data"];
    switch (e.data["function"]) {
        case "transferData":
            // console.log(e.data.data);
            images = [];
            let imageCounter = 0;
            while (data["image" + imageCounter] !== undefined && imageCounter < 100) {
                images[imageCounter] = data["image" + imageCounter];
                imageCounter++;
            }
            imageNames = data["imageNames"].split(";");
            imageExtent = data["extent"];
            if (userExtents.length === 0) {
                userExtents = imageExtent;
            }
            imageBounds = data["bounds"];
            sliceMax = data["sliceMax"];
            sliceMin = data["sliceMin"];
            tumorData = data["tumorData"];
            ready = true;
            break;
        case "setTumorData":
            // Wait until the sphere hasn't been moved for 1000 milliseconds before redarwing the rixels to avoid
            // locking the main thread
            tumorData = data;
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => calculateAndDrawRixels(), 500);
            break;
        case "setSlice":
            sliceValue = data;
            if (ready) {
                calculateAndDrawRixels();
            }
            // setSlice(e.data["plane"], e.data["slice"]);
            break;
        case "setNewGridSize":
            newGridSize = data;
            self.postMessage({msg: "gridSize", data: newGridSize});
            if (ready === true) {
                calculateAndDrawRixels();
            }
            break;
        case "calculateAndDrawRixels":
            calculateAndDrawRixels();
            break;
        case "setBoundingBox":
            userExtents = data;
            if (ready === true) {
                calculateAndDrawRixels();
            }
            break;
        case "setRixelsMaxValue":
            calculateAndDrawRixels();
            break;
    }

}, false);

function probeImages(row, column, extent) {
    // Get the image extent and calculate the bound to take with the given grid size
    let stepX = (userExtents[1] - userExtents[0]) / newGridSize;
    let stepY = (userExtents[3] - userExtents[2]) / newGridSize;

    //calc the values to give to the statistics
    let xRangeLo = userExtents[0] + row * stepX;
    let xRangeHi = xRangeLo + stepX - 1;
    let yRangeLo = userExtents[2] + column * stepX;
    let yRangeHi = yRangeLo + stepY - 1;

    // Adapt
    if (column === (newGridSize - 1)) {
        yRangeHi = userExtents[3] - 1;
    }
    if (row === (newGridSize - 1)) {
        xRangeHi = userExtents[1] - 1;
    }
    // console.log("X from " + xRangeLo + " to " + xRangeHi + " Y from " + yRangeLo + " to " + yRangeHi);
    // Return a promise from the statistics
    return getStatistics(images, xRangeHi, xRangeLo, yRangeLo, yRangeHi, sliceValue, true, extent);
}

function calculateAndDrawRixels() {
    // let images = getPatient(personSelected).getImages();
    if (images != null && images[0] != null && sliceMax !== null && sliceMin !== null) {
        //probe
        ready = false;
        let promises = [];
        let promiseIndex = 0;
        let extent = imageExtent;

        for (let col = 0; col < newGridSize; col++) {
            for (let row = newGridSize - 1; row >= 0; row--) {
                promises[promiseIndex] = probeImages(row, col, extent);
                promiseIndex++;
            }
        }

        Promise.all(promises).then((result) => {
            // console.log(result);
            //Check how time consuming it is to draw the Rixels on the main thread
            let data = [];
            for (let ind = 0; ind < result.length; ind++) {
                data[ind] = [];
                for (x = 0; x < result[ind][5].length; x++) {
                    data[ind][x] = {
                        axis: imageNames[x], value: result[ind][5][x], q25: result[ind][1][x]
                        , mean: result[ind][2][x], q75: result[ind][3][x]
                    };
                }
                data[ind][data[ind].length] = tumorData;
            }
            ready = true;
            self.postMessage({msg: "calculationDone", data: data});
        });
    }
}

/**
 * Probes the given images with the given grid cell
 * @param images
 *      The images to probe
 * @param x0
 *      Start x index of the cell
 * @param x1
 *      End x index of the cell
 * @param y0
 *      Start y index of the cell
 * @param y1
 *      End y index of the cell
 * @param z
 *      Slice to probe
 * @param norm
 *          Defines if the data should be normalized
 * @returns {Promise<any>}
 *      Statistics of each image
 */
function getStatistics(images, x0, x1, y0, y1, z, norm = true, extent) {
    // let sliceMax = getPatient(personSelected).getSliceMax();
    // let sliceMin = getPatient(personSelected).getSliceMin();

    return new Promise(function (resolve) {
        let mean = [];
        let max = [];
        let min = [];
        let q25 = [];
        let q50 = [];
        let q75 = [];
        let num;

        for (var i = 0; i < images.length; i++) {
            mean[i] = 0;
            num = 0;
            let image = images[i];
            let values = [];
            for (var x = x1; x < x0; x++) {
                for (var y = y0; y < y1; y++) {
                    let value = interpolateValue(image, x, y, z, extent);
                    //min max normalization TODO => change to more sophisticated normalization
                    if (norm) {
                        if ((sliceMax[z][i] - sliceMin[z][i]) === 0) {
                            value = 0;
                        } else {
                            value = (value - sliceMin[z][i]) / (sliceMax[z][i] - sliceMin[z][i]);
                        }
                    }
                    //
                    values[num] = value;
                    mean[i] += value;
                    num++;
                }
            }
            // sort the array
            let sorted = ascRix(values);
            min[i] = sorted[0];
            q25[i] = quantileRix(sorted, .25);
            q50[i] = quantileRix(sorted, .50);
            q75[i] = quantileRix(sorted, .75);
            max[i] = sorted[sorted.length - 1];
            mean[i] = mean[i] / num;
        }
        resolve([min, q25, q50, q75, max, mean]);
    });
}

function interpolateValue(image, x, y, z, extent) {
    let value;
    // if number are integer => Easy
    if (Number.isInteger(x) && Number.isInteger(y)) {
        let indexVal = x + y * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        value = image[indexVal];
    } else if (Number.isInteger(x)) {
        //Linear interpolation
        let indexVal = x + Math.floor(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        let indexVal2 = x + Math.ceil(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);

        let valueLow = image[indexVal];
        let valueHigh = image[indexVal2];
        let share = y - Math.floor(y);

        value = share * valueLow + (1 - share) * valueHigh;
    } else if (Number.isInteger(y)) {
        //Linear interpolation
        let indexVal = Math.floor(x) + y * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        let indexVal2 = Math.ceil(x) + y * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);

        let valueLow = image[indexVal];
        let valueHigh = image[indexVal2];
        let share = x - Math.floor(x);

        value = share * valueLow + (1 - share) * valueHigh;
    } else {
        //Bilinear Interpolation
        let indexVal = Math.floor(x) + Math.floor(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        let indexVal2 = Math.floor(x) + Math.ceil(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        let indexVal3 = Math.ceil(x) + Math.floor(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
        let indexVal4 = Math.ceil(x) + Math.ceil(y) * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);

        let valueXlowYlow = image[indexVal];
        let valueXlowYhigh = image[indexVal2];
        let valueXhighYlow = image[indexVal3];
        let valueXhighYhigh = image[indexVal4];

        let shareX = x - Math.floor(x);
        let shareY = y - Math.floor(y);

        value = shareY * (shareX * valueXlowYlow + (1 - shareX) * valueXhighYlow) +
            (1 - shareY) * (shareX * valueXlowYhigh + (1 - shareX) * valueXhighYhigh);
    }
    return value;
}

/**
 * STATISTICS FUNCTIONS (double defined because of WebWorker)
 */
// sort array ascending
const ascRix = arr => arr.sort((a, b) => a - b);

const quantileRix = (arr, q) => {
    const pos = ((arr.length) - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if ((arr[base + 1] !== undefined)) {
        return arr[base] + rest * (arr[base + 1] - arr[base]);
    } else {
        return arr[base];
    }
};

/**
 * END STATISTICS FUNCTION
 */

function getBoundingBoxExtentFromBounds(userBounds) {
    extent = imageSave.getExtent();
    bounds = imageSave.getBounds();
    newUserExtent = [
        (1 - ((userBounds[1] - bounds[0]) / (bounds[1] - bounds[0]))) * (extent[1] - extent[0]), (1 - ((userBounds[0] - bounds[0]) / (bounds[1] - bounds[0]))) * (extent[1] - extent[0]),
        (1 - ((userBounds[3] - bounds[2]) / (bounds[3] - bounds[2]))) * (extent[3] - extent[2]), (1 - ((userBounds[2] - bounds[2]) / (bounds[3] - bounds[2]))) * (extent[3] - extent[2]),
        ((userBounds[4] - bounds[4]) / (bounds[5] - bounds[4])) * (extent[5] - extent[4]), ((userBounds[5] - bounds[4]) / (bounds[5] - bounds[4])) * (extent[5] - extent[4])
    ];
    return newUserExtent;
}

/**
 * Empties the given container
 * @param container
 */
function emptyContainer(container) {
    if (container) {
        container.removeChild(container.lastChild);
    }
}

/**
 * Programmatically changes the darkness of a color
 * https://www.sitepoint.com/javascript-generate-lighter-darker-color/
 *
 * @param hex
 *      Hex code of the color
 * @param lum
 *      Luminance in percentage (e.g. -0.2 => 20% darker, 0.5 => 50% lighter)
 * @returns The color code with the new luminance
 */
function colorLuminance(hex, lum) {

    // validate hex string
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00" + c).substr(c.length);
    }

    return rgb;
}

