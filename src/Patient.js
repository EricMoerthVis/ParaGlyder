var chartUpdateCallback;
var similarityImageCallback;
var timeout;

class Patient {
    constructor(name, files, chartUpdate, similarityCallback, colorTumor, colorCompare) {
        this.files = files;
        this.name = name;
        this.colors = {tumor: colorTumor, compare: colorCompare};
        chartUpdateCallback = chartUpdate;
        similarityImageCallback = similarityCallback;
        this.tumorWorker = new Worker('src/Analysis.js');
        this.tumorWorker.addEventListener('message', this.handleTumorStatisticsEvent, false);
        this.compareWorker = new Worker('src/Analysis.js');
        this.compareWorker.addEventListener('message', this.handleCompareStatisticsEvent, false);

        this.similarityWorker = new Worker('src/AnalysisSimilarity.js');
        this.similarityWorker.addEventListener('message', this.handleSimilarityEvent, false);
    }

    handleTumorStatisticsEvent(e) {
        registerTumorChartStats(e.data["name"], e.data["result"]);
        chartUpdateCallback(e.data["name"], "tumor");
        if(timeout !== undefined){
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            let patient = getPatient(e.data["name"]);
            let message = patient.getPatientSimilarityMessageObject(getPatient(e.data["name"]).getTumorDataMessageObject());
            patient.postMessageToSimilarityWorker(message);
        }, 500);
    }

    postMessageToSimilarityWorker(message) {
        this.similarityWorker.postMessage(message)
    }

    handleCompareStatisticsEvent(e) {
        registerCompareChartStats(e.data["name"], e.data["result"]);
        chartUpdateCallback(e.data["name"], "compare");
    }

    handleSimilarityEvent(e) {
        // console.log("Finished Similarity Volume calculation");
        let patient = getPatient(e.data["name"]);
        let image = patient.getImages()[0];
        let vtkImageData = vtk.Common.DataModel.vtkImageData.newInstance({
            extent: image.getExtent(),
            origin: image.getOrigin(),
            spacing: image.getSpacing(),
            direction: image.getDirection(),
        });
        // create VTK image data
        const scalars = vtk.Common.Core.vtkDataArray.newInstance({
            name: 'Scalars',
            values: e.data["data"],
            numberOfComponents: 1,
        });
        vtkImageData.getPointData().setScalars(scalars);
        similarityImageCallback(vtkImageData);
    }

    loadImages(files, callback) {
        //load all the files for probing later
        this.files = files;
        this.images = [];
        this.imageNames = [];
        this.imageMax = [];
        let promises = [];
        let imgIndx = 0;
        for (var i = 0; i < files.length; i++) {
            this.imageNames[i] = getFileName(files[i].name);
            promises[imgIndx] = itk.readImageFile(null, files[i]).then(({image: itkImage}) => {
                // let index = imgIndx;
                return vtk.Common.DataModel.vtkITKHelper.convertItkToVtkImage(itkImage);
                // console.log("HERERER");
            }).catch((error) => {
                console.log(error);
            });
            imgIndx++;
        }
        return Promise.all(promises).then((imageResult) => {
            this.images = imageResult;
            calcMinMaxValues(this.images).then((result) => {
                this.sliceMin = result.sliceMin;
                this.sliceMax = result.sliceMax;
                this.calcGlobalMaxValues(this.sliceMin, this.sliceMax);
                callback(this);
            });
        });
    }

    calcGlobalMaxValues(sliceMin, sliceMax) {
        this.maxVals = sliceMax[0];
        this.minVals = sliceMin[0];
        for (let i = 1; i < sliceMin.length; i++) {
            for (let j = 0; j < sliceMin[i].length; j++) {
                if (this.maxVals[j] < sliceMax[i][j]) {
                    this.maxVals[j] = sliceMax[i][j];
                }
                if (this.minVals[j] > sliceMin[i][j]) {
                    this.minVals[j] = sliceMin[i][j];
                }
            }
        }
    }

    getImages() {
        return this.images;
    }

    getFiles() {
        return this.files;
    }

    getName() {
        return this.name;
    }

    getImageToFileName(filename) {
        for (let i = 0; i < this.files.length; i++) {
            if (this.files[i].name === filename) {
                return this.images[i];
            }
        }
        return null;
    }

    setTumorHandler(tumorPicker) {
        // TODO handle tumorpicker null event => deselect Tumor
        if (tumorPicker === null) {
            registerTumorChartStats(this.name, null);
            chartUpdateCallback(this.name, "tumor");
        } else if (!_.isEqual(tumorPicker, this.tumorPicker)) {
            this.tumorPicker = tumorPicker;
            let message = Patient.getMessageObject(this.images, tumorPicker, this.maxVals, this.minVals, this.name);
            this.tumorWorker.postMessage(message);
            // calculateMaskedImageStatistics(tumorPicker, this.images);
        }
    }

    resamplePickers(){
        let message = Patient.getMessageObject(this.images, this.tumorPicker, this.maxVals, this.minVals, this.name);
        this.tumorWorker.postMessage(message);
        message = Patient.getMessageObject(this.images, this.comparisonPicker, this.maxVals, this.minVals, this.name);
        this.compareWorker.postMessage(message);
    }

    static getMessageObject(images, picker, maxVals, minVals, name) {
        var object = {};
        object["picker"] = picker;
        for (let i = 0; i < images.length; i++) {
            object["image" + i] = images[i].getPointData().getScalars().getData();
        }
        object["extent"] = images[0].getExtent();
        object["bounds"] = images[0].getBounds();
        object["maxVals"] = maxVals;
        object["minVals"] = minVals;
        object["name"] = name;
        return object;
    }

    getPatientSimilarityMessageObject(tumorInfo) {
        var object = {};
        for (let i = 0; i < this.images.length; i++) {
            object["image" + i] = this.images[i].getPointData().getScalars().getData();
        }
        object["imageNames"] = this.imageNames.join(";");
        object["extent"] = this.images[0].getExtent();
        object["bounds"] = this.images[0].getBounds();
        object["maxVals"] = this.maxVals;
        object["minVals"] = this.minVals;
        object["name"] = this.name;
        object["tumorInfo"] = tumorInfo;
        return object;
    }

    getPatientMessageObject() {
        var object = {};
        for (let i = 0; i < this.images.length; i++) {
            object["image" + i] = this.images[i].getPointData().getScalars().getData();
        }
        object["imageNames"] = this.imageNames.join(";");
        object["extent"] = this.images[0].getExtent();
        object["bounds"] = this.images[0].getBounds();
        object["sliceMax"] = this.sliceMax;
        object["sliceMin"] = this.sliceMin;
        return object;
    }

    getTumorDataMessageObject() {
        return getTumorPickerDataFromPatient(this.name);
    }

    setComparisonValue(comparisonPicker) {
        // TODO handle comparisonPicker null event => deselect Compare region
        if (comparisonPicker === null) {
            registerCompareChartStats(this.name, null);
            chartUpdateCallback(this.name, "compare");
        } else if (!_.isEqual(comparisonPicker, this.comparisonPicker)) {
            this.comparisonPicker = comparisonPicker;
            let message = Patient.getMessageObject(this.images, comparisonPicker, this.maxVals, this.minVals, this.name);
            this.compareWorker.postMessage(message);
            // calculateMaskedImageStatistics(tumorPicker, this.images);
        }
    }

    getSliceMin() {
        return this.sliceMin;
    }

    getSliceMax() {
        return this.sliceMax;
    }

}

function getFileName(name) {
    let result = "";
    let pos = name.lastIndexOf("_");
    let pos2 = name.lastIndexOf(")");
    let pos3 = name.lastIndexOf("map");
    if (pos2 !== -1) {
        result = name.substring(pos + 1, pos2 + 1)
    } else {
        result = name.substring(pos + 1, pos3)
    }
    return result === "" ? name : result;
}

async function calcMinMaxValues(images) {
    let sliceMin = [];
    let sliceMax = [];
    let extent = images[0].getExtent();
    for (var z = 0; z <= extent[5]; z++) {
        await Promise.resolve(calcMinMaxValuesSlice(images, z));
        sliceMin[z] = imageMin;
        sliceMax[z] = imageMax;
    }
    return {sliceMin, sliceMax};
}

function calcMinMaxValuesSlice(images, z = 0) {
    imageMax = [];
    imageMin = [];
    let extent = images[0].getExtent();
    let promises = [];
    let index = 0;
    for (var f = 0; f < images.length; f++) {
        imageMax[f] = -1;
        imageMin[f] = 1000000;
    }
    let imageParam = [];
    for (let i = 0; i < images.length; i++) {
        imageParam[i] = images[i].getPointData().getScalars().getData();
    }
    for (var x = 0; x <= extent[1] - 32 - 1; x += 32) {
        for (var y = extent[3] - 1; y >= 32; y -= 32) {
            promises[index] = getStatistics(imageParam, x + 32, x, y - 32, y, z, false, extent).then(function (result) {
                let maxvals = result[4];
                let minvals = result[0];
                for (var i = 0; i < maxvals.length; i++) {
                    if (imageMax[i] < maxvals[i]) {
                        imageMax[i] = maxvals[i];
                    }
                    if (imageMin[i] > minvals[i]) {
                        imageMin[i] = minvals[i];
                    }
                }
            });
            index++;
        }
    }
    return Promise.all(promises);
}



