var imageMapper;
var cropFilter;
var renderer;
var renderWindow;
var imageSave;
var patientSave;
var imageSliceBounds;
var imageSlice;
var imageNumberSave = 0;
var sizeGrid = 6;
var rixelMaxValue = 1;
var sliceValue;
var sliceSave;
var tooltip;
var rixels = [];

/**
 * Creates the Rixel view for the given file in the given container.
 * @param file
 *      File to display.
 * @param container
 *      Container to present the view in.
 */
function drawRixelsBasis(patient, container, toolTip) {
    tooltip = toolTip;
    containerSave = container;
    patientSave = patient;
    imageSave = patient.getImages()[imageNumberSave];
    selectFileForRixelView(patient.getName(), patient.getFiles()[imageNumberSave].name);
    imageSliceBounds = imageSave.getBounds();
    userExtents = imageSave.getExtent();
    emptyContainer(container);
    const genericRenderWindow = vtk.Rendering.Misc.vtkGenericRenderWindow.newInstance({
        background: [0, 0, 0],
    });
    genericRenderWindow.setContainer(container);
    renderWindow = genericRenderWindow.getRenderWindow();
    renderer = genericRenderWindow.getRenderer();
    sliceSave = Math.round(imageSave.getBounds()[5] / 2);
    sliceValue = getSliceValueExtents(sliceSave);
    setSlice("z", sliceSave);
}

function createViewer(container, patient, slicingMode = vtk.Rendering.Core.vtkImageMapper.SlicingMode.Z) {
    if (renderer.getActors().length > 0) {
        renderer.removeActor(renderer.getActors()[0]);
    }

    imageSave = patient.getImages()[imageNumberSave];
    cropFilter = vtk.Filters.General.vtkImageCropFilter.newInstance();
    cropFilter.setCroppingPlanes(userExtents);
    cropFilter.setInputData(imageSave);
    imageMapper = vtk.Rendering.Core.vtkImageMapper.newInstance();
    imageMapper.setInputData(cropFilter.getOutputData());
    imageMapper.setSlicingMode(slicingMode);
    sliceMode = slicingMode;
    imageMapper.setZSlice(sliceSave);
    imageSlice = vtk.Rendering.Core.vtkImageSlice.newInstance({
        property: getWindowLevel(patient, sliceValue, imageNumberSave)
    });
    renderer.addActor(imageSlice);
    imageSlice.setMapper(imageMapper);
    setCameraToSlicingDirection();
    addInteractionHandler(imageSave, renderWindow, imageSlice);
    imageSlice.getMapper().setZSlice(sliceSave);
    renderer.resetCamera();
    renderer.getActiveCamera().setParallelProjection(true);

    zoom = (2 / Math.abs(imageSliceBounds[3] - imageSliceBounds[2])) / renderer.getActiveCamera().getProjectionMatrix()[5];
    //TODO zoom adaptive to the bounding box?
    renderer.getActiveCamera().zoom(zoom);
    renderer.resetCameraClippingRange();

    renderWindow.render();
    // renderWindow.captureImages()[0].then(image
}

function getWindowLevel(patient, slice, imageNum) {
    let min = patient.getSliceMin()[slice][imageNum];
    let max = patient.getSliceMax()[slice][imageNum];

    let window = (max - min) / 2;
    let level = min + ((max - min) / 4);
    return vtk.Rendering.Core.vtkImageProperty.newInstance({
        colorWindow: window,
        colorLevel: level
    });
}

function setSlice(plane, slice) {
    if (slice != null) {
        sliceSave = slice;

        if (plane === "z") {
            sliceSave = slice;
            createViewer(containerSave, patientSave, vtk.Rendering.Core.vtkImageMapper.SlicingMode.Z);
            sliceValue = getSliceValueExtents(slice);
            rixelWorker.postMessage({function: "setSlice", data: sliceValue});
        }
        renderWindow.render();
    }
}

function getSliceValueExtents(slice) {
    extent = imageSave.getExtent();
    bounds = imageSave.getBounds();
    return Math.round(((slice - bounds[4]) / (bounds[5] - bounds[4])) * (extent[5] - extent[4]));
}

function setBoundingBox(boundingBox) {
    let boundsOfBox = getMaxBoundsOfBoundingBox(boundingBox);
    imageSliceBounds = boundsOfBox;
    userExtents = getBoundingBoxExtentFromBounds(boundsOfBox);
    createViewer(containerSave, patientSave, sliceMode);
    rixelWorker.postMessage({function: "setBoundingBox", data: userExtents});
}

/**
 * Finds the bounds for the image to use, out of the bounding box presented by the given value
 * @param boundingBox
 * @returns {*[]}
 */
function getMaxBoundsOfBoundingBox(boundingBox) {
    let bounds = imageSave.getBounds();
    let userBounds = [bounds[1], bounds[0], bounds[3], bounds[2], bounds[5], bounds[4]];

    // find the min and max of the bounding box to set as the new user extents
    for (let i = 0; i < boundingBox.length; i++) {
        if (boundingBox[i][0] < userBounds[0]) {
            userBounds[0] = boundingBox[i][0] < bounds[0] ? bounds[0] : boundingBox[i][0];
        }
        if (boundingBox[i][0] > userBounds[1]) {
            userBounds[1] = boundingBox[i][0] > bounds[1] ? bounds[1] : boundingBox[i][0];
        }
        if (boundingBox[i][1] < userBounds[2]) {
            userBounds[2] = boundingBox[i][1] < bounds[2] ? bounds[2] : boundingBox[i][1];
        }
        if (boundingBox[i][1] > userBounds[3]) {
            userBounds[3] = boundingBox[i][1] > bounds[3] ? bounds[3] : boundingBox[i][1];
        }
        if (boundingBox[i][2] < userBounds[4]) {
            userBounds[4] = boundingBox[i][2] < bounds[4] ? bounds[4] : boundingBox[i][2];
        }
        if (boundingBox[i][2] > userBounds[5]) {
            userBounds[5] = boundingBox[i][2] > bounds[5] ? bounds[5] : boundingBox[i][2];
        }
    }
    return userBounds;
}

/**
 * Adaption of https://kitware.github.io/vtk-js/examples/MouseRangeManipulator.html
 * Enables the adaption of the shading of the slice
 * @param image
 *  The image the interaction handler should be created for
 * @param renderWindow
 *  The render window to add it
 * @param imageSlice
 *  The image slice in use
 */
function addInteractionHandler(image, renderWindow, imageSlice) {
    const range = image
        .getPointData()
        .getScalars()
        .getRange();
    const wMin = 1;
    const wMax = range[1] - range[0];
    const wGet = imageSlice.getProperty().getColorWindow;
    const wSet = imageSlice.getProperty().setColorWindow;
    const lMin = range[0];
    const lMax = range[1];
    const lGet = imageSlice.getProperty().getColorLevel;
    const lSet = imageSlice.getProperty().setColorLevel;
    const extent = image.getExtent();
    const rangeManipulator = vtk.Interaction.Manipulators.vtkMouseRangeManipulator.newInstance({
        button: 1,
        scrollEnabled: true,
    });
    rangeManipulator.setVerticalListener(wMin, wMax, 1, wGet, wSet);
    rangeManipulator.setHorizontalListener(lMin, lMax, 1, lGet, lSet);

    const iStyle = vtk.Interaction.Style.vtkInteractorStyleManipulator.newInstance();
    iStyle.addMouseManipulator(rangeManipulator);
    renderWindow.getInteractor().setInteractorStyle(iStyle);
}

function setCameraToSlicingDirection() {
    renderer.resetCamera();
    const camera = renderer.getActiveCamera();
    const position = camera.getFocalPoint();
    const normal = imageMapper.getSlicingModeNormal();
    position[0] += normal[0];
    position[1] += normal[1];
    position[2] += normal[2];
    camera.setPosition(...position);
    switch (imageMapper.getSlicingMode()) {
        case vtk.Rendering.Core.vtkImageMapper.SlicingMode.X:
            renderer.getActiveCamera().setViewUp([0, -1, 0]);
            renderer.getActiveCamera().roll(90);
            break;
        case vtk.Rendering.Core.vtkImageMapper.SlicingMode.Y:
            renderer.getActiveCamera().setViewUp([1, 0, 0]);
            renderer.getActiveCamera().roll(90);
            break;
        case vtk.Rendering.Core.vtkImageMapper.SlicingMode.Z:
            renderer.getActiveCamera().setViewUp([0, 1, 0]);
            break;
    }
}

function drawRixels(data) {
    //calculate the size of the rixels
    let bound = d3.select(".rixelsBase").select('canvas').node().getBoundingClientRect();
    let w = bound.width / sizeGrid;
    let h = w;
    let gridContainer = document.getElementById("rixelContainer");
    while (gridContainer.firstChild) {
        gridContainer.removeChild(gridContainer.firstChild);
    }

    // adapt the grid container to the column amount
    let value = "";
    for (var x = 0; x < sizeGrid; x++) {
        value = value + "auto ";
    }
    gridContainer.style.gridTemplateColumns = value;
    gridContainer.style.display = "grid";
    gridContainer.style.gridgap = "0px";
    gridContainer.style.width = bound.width.toString() + "px";
    gridContainer.style.height = bound.height.toString() + "px";

    for (let i = 0; i < data.length; i++) {
        rixels[i] = createRixel(".grid-container", i, tooltip, [data[i]], w, h, rixelMaxValue);
    }
}

function showGrid(show){
    if(show){
        rixels.forEach((rx) => rx.attr("opacity", 1));
    }else{
        rixels.forEach((rx) => rx.attr("opacity", 0));
    }
}

function setMaxValue(maxVale) {
    rixelMaxValue = maxVale;
}

function setImage(imageNumber) {
    let val = -1;
    if (patientSave != null) {
         val = Math.round((imageNumber / 10.0) * (patientSave.getImages().length - 1));
    }
    if (val !== imageNumberSave) {
        imageNumberSave = val;
        similarityRendering = false;
        selectFileForRixelView(patientSave.getName(), patientSave.getFiles()[val].name);
        createViewer(containerSave, patientSave);
    }
}
