//source: http://prag.ma/code/d3-cartogram/cartogram.js
(function(exports) {

  /*
   * d3.cartogram is a d3-friendly implementation of An Algorithm to Construct
   * Continuous Area Cartograms:
   *
   * <http://chrisman.scg.ulaval.ca/G360/dougenik.pdf>
   *
   * It requires topojson to decode TopoJSON-encoded topologies:
   *
   * <http://github.com/mbostock/topojson/>
   *
   * Usage:
   *
   * var cartogram = d3.cartogram()
   *  .projection(d3.geo.albersUsa())
   *  .value(function(d) {
   *    return Math.random() * 100;
   *  });
   * d3.json("path/to/topology.json", function(topology) {
   *  var features = cartogram(topology);
   *  d3.select("svg").selectAll("path")
   *    .data(features)
   *    .enter()
   *    .append("path")
   *      .attr("d", cartogram.path);
   * });
   */
  d3.cartogram = function() {
	//this function returns carto
	
    function carto(topology, geometries) {
      // copy it first
      topology = copy(topology);
	  //console.log("topology")
	  //console.log(topology);

      // objects are projected into screen coordinates
      var projectGeometry = projector(projection);
	  //projectGeometry is a function that hasn't been called yet.


      // project the arcs into screen space
      var tf = transformer(topology.transform),
          projectedArcs = topology.arcs.map(function(arc) {
            var x = 0, y = 0;
            return arc.map(function(coord) {
              coord[0] = (x += coord[0]);
              coord[1] = (y += coord[1]);
              return projection(tf(coord));
            });
          });

      // path with identity projection
      var path = d3.geo.path()
        .projection(null);
	//passing path.projection(null) instead of ident because d3's version changed. 
	//see https://github.com/shawnbot/d3-cartogram/issues/4

//	  console.log("What are the geometries?");
//	  console.log(geometries);

	  //N.V. - this is turning the geometries into geoJSON features?
	
      var objects = object(projectedArcs, {type: "GeometryCollection", geometries: geometries})
          .geometries.map(function(geom) {
            //console.log("calling properties");
            var newProperty = properties.call(null, geom, topology);
            //console.log(newProperty);	
            return {
              type: "Feature",
              id: geom.id,
              properties: newProperty,
              //properties: properties.call(null, geom, topology),
              geometry: geom
            };
          });

      var values = objects.map(value),
          totalValue = sum(values);

      // no iterations; just return the features
      if (iterations <= 0) {
        return objects;
      }

      var i = 0,
          targetSizeError = 1;
      while (i++ < iterations) {
        var areas = objects.map(path.area),
            totalArea = sum(areas),
            sizeErrors = [],
            meta = objects.map(function(o, j) {
              var area = Math.abs(areas[j]), // XXX: why do we have negative areas?
                  v = +values[j],
                  desired = totalArea * v / totalValue,
                  radius = Math.sqrt(area / Math.PI),
                  mass = Math.sqrt(desired / Math.PI) - radius,
                  sizeError = Math.max(area, desired) / Math.min(area, desired);
              sizeErrors.push(sizeError);
              // console.log(o.id, "@", j, "area:", area, "value:", v, "->", desired, radius, mass, sizeError);
              return {
                id:         o.id,
                area:       area,
                centroid:   path.centroid(o),
                value:      v,
                desired:    desired,
                radius:     radius,
                mass:       mass,
                sizeError:  sizeError
              };
            });

        var sizeError = mean(sizeErrors),
            forceReductionFactor = 1 / (1 + sizeError);

        // console.log("meta:", meta);
        // console.log("  total area:", totalArea);
        // console.log("  force reduction factor:", forceReductionFactor, "mean error:", sizeError);

        projectedArcs.forEach(function(arc) {
          arc.forEach(function(coord) {
            // create an array of vectors: [x, y]
            var vectors = meta.map(function(d) {
              var centroid =  d.centroid,
                  mass =      d.mass,
                  radius =    d.radius,
                  theta =     angle(centroid, coord),
                  dist =      distance(centroid, coord),
                  Fij = (dist > radius)
                    ? mass * radius / dist
                    : mass *
                      (Math.pow(dist, 2) / Math.pow(radius, 2)) *
                      (4 - 3 * dist / radius);
              return [
                Fij * Math.cos(theta),
                Fij * Math.sin(theta)
              ];
            });

            // using Fij and angles, calculate vector sum
            var delta = vectors.reduce(function(a, b) {
              return [
                a[0] + b[0],
                a[1] + b[1]
              ];
            }, [0, 0]);

            delta[0] *= forceReductionFactor;
            delta[1] *= forceReductionFactor;

            coord[0] += delta[0];
            coord[1] += delta[1];
          });
        });

        // break if we hit the target size error
        if (sizeError <= targetSizeError) break;
      }

      return {
        features: objects,
        arcs: projectedArcs
      };
    }

    var iterations = 8,
        projection = d3.geo.albers(),
        properties = function(id) {
 //         console.log("in this other properties");
          return {};
        },
        value = function(d) {
          return 1;
        };

    // for convenience
    carto.path = d3.geo.path()
      .projection(null);

    carto.iterations = function(i) {
      if (arguments.length) {
        iterations = i;
        return carto;
      } else {
        return iterations;
      }
    };

    carto.value = function(v) {
      if (arguments.length) {
        value = d3.functor(v);
        return carto;
      } else {
        return value;
      }
    };

    carto.projection = function(p) {
      if (arguments.length) {
        projection = p;
        return carto;
      } else {
        return projection;
      }
    };

    carto.feature = function(topology, geom) {
//      console.log("defining carto.feature");
      return {
        type: "Feature",
        id: geom.id,
        properties: properties.call(null, geom, topology),
        geometry: {
          type: geom.type,
          coordinates: topojson.feature(topology, geom).coordinates //changed from topojson.object. .object was taken out of the api.
        }
      };
    };

    carto.features = function(topo, geometries) {
//      console.log("defining carto.features");
      return geometries.map(function(f) {
        return carto.feature(topo, f);
      });
    };

    carto.properties = function(props) {
//      console.log("in carto.properties");
      if (arguments.length) {
        properties = d3.functor(props);
        return carto;
      } else {
        return properties;
      }
    };
//	console.log("returning carto");
//	console.log(carto);
    return carto;
  };

  var transformer = d3.cartogram.transformer = function(tf) {
    var kx = tf.scale[0],
        ky = tf.scale[1],
        dx = tf.translate[0],
        dy = tf.translate[1];

    function transform(c) {
      return [c[0] * kx + dx, c[1] * ky + dy];
    }

    transform.invert = function(c) {
      return [(c[0] - dx) / kx, (c[1]- dy) / ky];
    };

    return transform;
  };//end transformer(tf)

  function sum(numbers) {
    var total = 0;
    for (var i = numbers.length - 1; i-- > 0;) {
      total += numbers[i];
    }
    return total;
  }

  function mean(numbers) {
    return sum(numbers) / numbers.length;
  }

  function angle(a, b) {
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  function distance(a, b) {
    var dx = b[0] - a[0],
        dy = b[1] - a[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function projector(proj) {
    var types = {
      Point: proj,
      LineString: function(coords) {
        return coords.map(proj);
      },
      MultiLineString: function(arcs) {
        return arcs.map(types.LineString);
      },
      Polygon: function(rings) {
        return rings.map(types.LineString);
      },
      MultiPolygon: function(rings) {
        return rings.map(types.Polygon);
      }
    };
    return function(geom) {
      console.log("returning from projector");
      console.log(types[geom.type](geom.coordinates));
      return types[geom.type](geom.coordinates);
    };
  }

  // identity projection
  function ident(c) {
    return c;
  }

  function copy(o) {
    return (o instanceof Array)
      ? o.map(copy)
      : (typeof o === "string" || typeof o === "number")
        ? o
        : copyObject(o);
  }
  
  function copyObject(o) {
    var obj = {};
    for (var k in o) obj[k] = copy(o[k]);
    return obj;
  }

  function object(arcs, o) {
    function arc(i, points) {
      if (points.length) points.pop();
      for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length; k < n; ++k) {
        points.push(a[k]);
      }
      if (i < 0) reverse(points, n);
    }

    function line(arcs) {
      var points = [];
      for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
      return points;
    }

    function polygon(arcs) {
      return arcs.map(line);
    }

    function geometry(o) {
      o = Object.create(o);
      o.coordinates = geometryType[o.type](o.arcs);
      return o;
    }

    var geometryType = {
      LineString: line,
      MultiLineString: polygon,
      Polygon: polygon,
      MultiPolygon: function(arcs) { return arcs.map(polygon); }
    };
//	console.log("In object()");
//	console.log(o);	
	//--
	if (o.type==="GeometryCollection") {
		o=Object.create(o);
		o.geometries = o.geometries.map(geometry);
		return o;
	} else {
		return geometry(o);
	}
    //N.V. I replaced the if/then below with the if/then above to debug. 
    // return o.type === "GeometryCollection"
//         ? (o = Object.create(o), o.geometries = o.geometries.map(geometry), o)
//         : geometry(o);
  }//end of object(arcs, o);

  function reverse(array, n) {
    var t, j = array.length, i = j - n; while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  }

})(this);