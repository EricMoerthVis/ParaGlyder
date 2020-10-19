var patients = new Map();
var patientTumorChartData = new Map();
var patientCompareChartData = new Map();
var colors = d3.scale.category10(); // TODO maybe use the google
var patientColorCounter = 0;

function addPatient(name, files, callback, chartUpdate, simImageUpdate) {
    if (patients.has(name) && !fileArrayEquals(patients.get(name).getFiles(), files)) {
        patients.get(name).loadImages(files, callback);
    } else if(!patients.has(name)) {
        patients.set(name, new Patient(name, files, chartUpdate, simImageUpdate,
            colors(patientColorCounter++), colors(patientColorCounter++)));
        patients.get(name).loadImages(files, callback);
    }
}

function registerTumorChartStats(name, data) {
    if (data === null) {
        patientTumorChartData.delete(name);
    } else {
        let patient = getPatient(name);
        let chartData = getChartDataFromStatistics(data, patient.getFiles(), patient.colors.tumor);
        patientTumorChartData.set(name, chartData);
    }
}

function registerCompareChartStats(name, data) {
    if (data === null) {
        patientCompareChartData.delete(name);
    } else {
        let patient = getPatient(name);
        let chartData = getChartDataFromStatistics(data, patient.getFiles(), patient.colors.compare);
        patientCompareChartData.set(name, chartData);
    }
}

function getPatient(name) {
    return patients.get(name);
}

function getTumorPickerDataFromPatient(name) {
    return patientTumorChartData.get(name);
}

function getChartDataFromStatistics(statistics, files, color) {
    let data = [];
    for (let ind = 0; ind < statistics.length; ind++) {
        data[ind] = {
            axis: getFileName(files[ind].name),
            max: statistics[ind][4],
            mean: statistics[ind][2],
            q75: statistics[ind][1],
            q25: statistics[ind][3],
            value: statistics[ind][5],
            color: color,
        };
    }
    return data;
}

function getChartData() {
    let dataArray = [];
    let names = [];
    let arrayIndex = 0;
    let namesIndex = 0;
    for (let [key, value] of patients) {
        if (patientTumorChartData.get(key) !== undefined) {
            dataArray[arrayIndex] = patientTumorChartData.get(key);
            arrayIndex++;
            names[namesIndex] = {name: key + " tumor", color: value.colors.tumor};
            namesIndex++;
        }
        if (patientCompareChartData.get(key) !== undefined) {
            dataArray[arrayIndex] = patientCompareChartData.get(key);
            arrayIndex++;
            names[namesIndex] = {name: key + " compare region", color: value.colors.compare};
            namesIndex++;
        }
    }
    return {dataArray, names};
}
