var dubai = ee.FeatureCollection("projects/my-project-1535562518622/assets/dubai_boundaries");
var samples = ee.FeatureCollection("projects/my-project-1535562518622/assets/samples");

// Load Sentinel-2 imagery, filter by date and region
var sentinel2 = ee.ImageCollection('COPERNICUS/S2')
  .filterBounds(ROI)  // Filter by area of interest
  .filterDate('2023-01-01', '2023-12-31')  // Filter by date range
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))  // Filter for low cloud cover
  .median();  // Take the median to reduce cloud cover and noise

// Select relevant bands (e.g., B2, B3, B4, B8 for RGB and NIR)
// Blue, Green, Red, NIR, SWIR1, SWIR2
var bands = ['B2', 'B3', 'B4', 'B8', 'B11', 'B12']; 
// Clip the image to the area of interest
var clippedImage = sentinel2.select(bands).clip(dubai);

samples = samples.randomColumn('random');
// Split the data into training and validation sets
var trainingSamples = samples.filter(ee.Filter.lt('random', 0.7));  // 70% for training
var validationSamples = samples.filter(ee.Filter.gte('random', 0.7));  // 30% for validation

// Sample the image at the training samples
var training = clippedImage.sampleRegions({
    collection: trainingSamples,
    properties: ['class'],
    scale: 10,  // Sentinel-2 has a resolution of 10m for certain bands
  });

// Train a classifier (RandomForest classifier)
var classifier = ee.Classifier.smileRandomForest(50);  // 50 trees in the forest
var trainedClassifier = classifier.train({
  features: training,
  classProperty: 'class',
  inputProperties: bands,
});

// Classify the image
var classified = clippedImage.classify(trainedClassifier);

// center the map into ROI
Map.centerObject(ROI, 10);
// Visualize the classification result
var classPalette = ['green', 'blue', 'yellow', 'red']; 
// Colors for Vegetation, Water, Sandy areas, Built-up
Map.addLayer(classified, {min:1, max:4, palette: classPalette}, 'Classified Image');

// Sample the classified image using validation points
var validation = clippedImage.sampleRegions({
    collection: validationSamples,
    properties: ['class'],  // True class labels
    scale: 10,  // Same resolution as training
  });
  // Classify the validation samples
  var validated = validation.classify(trainedClassifier);
  // Compute the confusion matrix (error matrix) for validation
  var accuracy = validated.errorMatrix('class', 'classification');
  // Print the confusion matrix and accuracy metrics
  print('Confusion Matrix:', accuracy);
  print('Overall Accuracy:', accuracy.accuracy()); 