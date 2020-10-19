self.addEventListener('message', function (e) {
    //Gather the images
    let images = [];
    let imageCounter = 0;
    while (e.data["image" + imageCounter] !== undefined && imageCounter < 100) {
        images[imageCounter] = e.data["image" + imageCounter];
        imageCounter++;
    }
    let extent = e.data["extent"];
    let imageNames = e.data["imageNames"].split(";");
    let maxVals = e.data["maxVals"];
    let minVals = e.data["minVals"];
    let name = e.data["name"];
    let tumorData = e.data["tumorInfo"];
    let tumorInfo = new Map();
    tumorMax = 0;
    // normalize the values with the largest value
    tumorData.forEach((info) => {
        if (info.value > tumorMax) {
            tumorMax = info.value;
        }
    });
    tumorData.forEach((info) => {
        tumorInfo.set(info.axis, info.value / tumorMax);
    });
    getSimilarityVolume(images, imageNames, extent, tumorInfo, name, minVals, maxVals);
}, false);

function getSimilarityVolume(images, imageNames, extent, tumorInfo, name, minVals, maxVals) {
    let data = [];
    // let center = [picker[0], picker[1], picker[2]];
    // let dataCounter = 0;
    let imageData = [];
    for (var x = 0; x <= extent[1]; x++) {
        for (var y = 0; y <= extent[3]; y++) {
            for (var z = 0; z <= extent[5]; z++) {
                let indexVal = x + y * (extent[1] + 1) + z * (extent[1] + 1) * (extent[3] + 1);
                data = [];
                for (ind = 0; ind < images.length; ind++) {
                    let value = (images[ind][indexVal] - minVals[ind]) / (maxVals[ind] - minVals[ind]);
                    data[ind] = {axis: imageNames[ind], value: value};
                }
                let sim = similarity(data, tumorInfo);
                imageData[indexVal] = sim;
            }
        }
    }
    self.postMessage({name: name, data: imageData});
}

function similarity(data, tumorInfo) {
    let sim = 0;
    let dataMax = 0;
    data.forEach((valPair) => {
        if (valPair.value > dataMax) {
            dataMax = valPair.value;
        }
    });
    if (dataMax === 0) {
        return 0;
    }
    data.forEach((valPair) => {
        sim += Math.pow(((valPair.value / dataMax) - tumorInfo.get(valPair.axis)), 2);
    });
    sim = Math.sqrt(sim);
    // console.log(sim);
    return 1 - sim;
};