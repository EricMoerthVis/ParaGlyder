self.addEventListener('message', function (e) {
    //Gather the images
    let images = [];
    let imageCounter = 0;
    while (e.data["image" + imageCounter] !== undefined && imageCounter < 100) {
        images[imageCounter] = e.data["image" + imageCounter];
        imageCounter++;
    }
    let picker = e.data["picker"];
    let extent = e.data["extent"];
    let bounds = e.data["bounds"];
    let maxVals = e.data["maxVals"];
    let minVals = e.data["minVals"];
    let name = e.data["name"];
    if (picker !== undefined) {
        if ((picker[0] >= bounds[0] && picker[0] <= bounds[1]) &&
            (picker[1] >= bounds[2] && picker[1] <= bounds[3]) &&
            (picker[2] >= bounds[4] && picker[2] <= bounds[5])) {
            // bounds to extent conversion
            picker = getExtentFromBounds(bounds, extent, picker);
            let imageStatistics = maskImages(images, extent, bounds, picker, picker[3], maxVals, minVals);
            imageStatistics.then((result) => {
                self.postMessage({name, result});
            });
        }
    }
}, false);

/**
 * Delivers the image masked with the given mask
 *      The image the mask should be applied
 *      The mask used for the image
 * @param images
 * @param extent
 * @param bounds
 * @param picker
 * @param radius
 * @param maxVals
 * @param minVals
 */
async function maskImages(images, extent, bounds, picker, radius, maxVals, minVals) {
    let data = [];
    let center = [picker[0], picker[1], picker[2]];
    let dataCounter = 0;

    let iterationBounds = [Math.round(center[2] - radius), Math.round((center[2] + radius)),
        Math.round(center[1] - radius), Math.round((center[1] + radius)),
        Math.round(center[0] - radius), Math.round((center[0] + radius))];

    for (var z = iterationBounds[0] > 0 ? iterationBounds[0] : 0; z <= (iterationBounds[1] <= extent[5] ? iterationBounds[1] : extent[5]); z++) {
        for (var y = iterationBounds[2] > 0 ? iterationBounds[2] : 0; y <= (iterationBounds[3] <= (extent[3]) ? iterationBounds[3] : extent[3]); y++) {
            for (var x = iterationBounds[4] > 0 ? iterationBounds[4] : 0; x <= (iterationBounds[5] <= extent[1] ? iterationBounds[5] : extent[1]); x++) {
                if ((eucledianDistance(center, [x, y, z]) - radius) < 0.0) {
                    let indexVal = x + y * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
                    for (let imgIndx = 0; imgIndx < images.length; imgIndx++) {
                        if (data[imgIndx] === undefined) {
                            data[imgIndx] = [];
                        }
                        data[imgIndx][dataCounter] = images[imgIndx][indexVal];
                    }
                    dataCounter++;
                }
            }
        }
    }
    return calcStatistics(data, maxVals, minVals);
}

function getExtentFromBounds(bounds, extents, picker) {
    return [
        (1 - ((picker[0] - bounds[0]) / (bounds[1] - bounds[0]))) * (extents[1] - extents[0]),
        (1 - ((picker[1] - bounds[2]) / (bounds[3] - bounds[2]))) * (extents[3] - extents[2]),
        ((picker[2] - bounds[4]) / (bounds[5] - bounds[4])) * (extents[5] - extents[4]),
        picker[3]
    ]
}

function calcStatistics(data, maxVals, minVals) {
    promises = [];
    for (let i = 0; i < data.length; i++) {
        promises[i] = calcStatisticsOneImage(data[i], minVals[i], maxVals[i]);
    }
    return Promise.all(promises);
}

function calcStatisticsOneImage(data, minVal, maxVal) {
    return new Promise(function (resolve) {
        let values = [];
        let num = 0;
        let mean = 0;

        for (let i = 0; i < data.length; i++) {
            let value = (data[i] - minVal) / (maxVal - minVal);
            //
            values[num] = value;
            mean += value;
            num++;
        }

        // sort the array
        let sorted = asc(values);
        let min = sorted[0];
        let q25 = quantile(sorted, .25);
        let q50 = quantile(sorted, .50);
        let q75 = quantile(sorted, .75);
        let max = sorted[sorted.length - 1];
        mean = mean / num;
        resolve([min, q25, q50, q75, max, mean]);
    });
}

/**
 * STATISTICS FUNCTIONS
 */
// sort array ascending
const asc = arr => arr.sort((a, b) => a - b);

const quantile = (arr, q) => {
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

/**
 * Delivers the eucledian distance between x and y
 * @param x
 *      First point in 3D
 * @param y
 *      Second point in 3D
 * @returns {number}
 *      The eucledian distance between x and y
 */
function eucledianDistance(x, y) {
    return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2));
}
