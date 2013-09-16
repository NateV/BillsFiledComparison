//console.log(topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469);

var width=500;
var realWidth = document.getElementById("mapUS").getBoundingClientRect().width;
var height=400;

var projection = d3.geo.albersUsa()
 				.scale(800)
 				.translate([width,height/2]);

var plainProjection = d3.geo.albersUsa()
 				.scale(800)
 				.translate([width,height/2]);
var plainPath = d3.geo.path().projection(plainProjection)

var colorScale = d3.scale.linear().domain([0,10000]).range(["#8888ff","#ff00ff"]);
				
var path = d3.geo.path().projection(projection);

var stateNameDiv = d3.select("#mapUS").append("text").attr("x", 70).attr("y",70)
						.attr("id","stateNameDiv"),
	billsFiledDiv = d3.select("#mapUS").append("text").attr("x",realWidth-140).attr("y",70)
				   		.attr("id","billsFiledDiv");

//var undistortedStates = topojson.feature(topojsonStates, topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469);
//console.log("States");
//console.log(undistortedStates);

var cartogram = d3.cartogram()
	.projection(projection)
	.properties(function(d) {
		return d.properties;
	});

//var geometries = topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469.geometries
//var features = cartogram(topojsonStates, geometries);
//console.log("Features:");
//console.log(features);

var distortionToggle = ["Off","On"];
var isDistorted;

var n=0;
function updateMap() {
	console.log("Updating map for the " + n + "th time.");
	n++;
	
	var statePaths = d3.select("#mapUS")
		.selectAll("path");
	var newFeatures;
	var currentPath;
	
	if (isDistorted) {
		console.log("map is distorted");
		//change the value() function of the cartogram
		cartogram.value(function(d) {
			return (getBills(d.properties.name)*500);
		});
		
		//get the new features
		newFeatures = cartogram(topojsonStates, topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469.geometries).features;
		console.log("new features");
		console.log(newFeatures);
		
		//set the data on the map and change the class.
		statePaths.data(newFeatures)
				.attr("class","state-distorted");
		currentPath = cartogram.path;
	
	} else {
		//get the new features
		newFeatures = topojson.feature(topojsonStates, topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469).features;

		//set the data on the map
		statePaths.data(newFeatures);
		currentPath = plainPath;
	}
	
	//create a transition
	statePaths.transition()
			  .duration(800)
			  .ease("linear")
			  .attr("d", currentPath )
			  .attr("fill", function(d) {
					if (isDistorted===1) {
					  return colorScale(getBills(d.properties.name))
					} else {
						return "#8888ff";
					}
			   });
}//end updateMap();


	$("#toggleDistort").append("<option>" + distortionToggle[0] + "</option>")
					   .append("<option>" + distortionToggle[1] + "</option>")
					   .val(distortionToggle[0])
					   .change(function() {
							switch ($(this).val()) {
								case distortionToggle[0]:
									isDistorted=0;
							 		break;
							 	case distortionToggle[1]:
							 		isDistorted=1;
							 		break;
							 	default:
							 		isDistorted=0;
							 		console.log("something in .change is broken");
							 		break;
							}
							updateMap();
						});

	
initMap();
	




function initMap() {
//	var plainFeatures = cartogram(topojsonStates, topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469.geometries).features;
	var plainFeatures = topojson.feature(topojsonStates, topojsonStates.objects.d1d33fb69d1c7961235a2b0d78778469).features;
	console.log("Plain features");
	console.log(plainFeatures);
	var statePaths = d3.select("#mapUS").selectAll("path")
					.data(plainFeatures)
					.enter()
					.append("path")
					.attr("d",plainPath)
					.attr("class","map")
					.on("mouseover", function(d,i) {
						console.log(d);
						d3.select("#stateNameDiv").text(d.properties.name);
						d3.select("#billsFiledDiv").text(getBills(d.properties.name) + " bills.");
						if(isDistorted===1) {
							d3.select(this).attr("class","state-distorted-hover");
							return;
						} else {
							d3.select(this).attr("class","state-hover");
							return;
						}
						
					})
					.on("mouseleave", function(d,i) {
//						d3.select("#detailsDiv").;
						if (isDistorted===1) {
							d3.select(this).attr("class","state-distorted");
							return;
						} else {
							d3.select(this).attr("class","map");
							return;
						}
					});
}

	
	
function getBills(stateName) {
	stateName = stateName.toUpperCase();
	//console.log("State name is: " + stateName);
	for (var i=0;i<billsFiledData.length;i++) {
//		console.log("comparing against " + billsFiledData[i].State);
		if (billsFiledData[i].State===stateName) {
			//console.log("match! Returning " + billsFiledData[i].Total);
			return billsFiledData[i].Total;
		}
	}
	//console.log("no match for " + stateName + ". Something is broken :(");
	return 0;
}//end getBills