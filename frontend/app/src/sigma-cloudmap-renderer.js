;(function(sigma){
  sigma.renderers.def = sigma.renderers.canvas
  sigma.canvas.allnodes = function(){}
  sigma.canvas.allnodes.def = sigmaCloudmapRenderer()

  function sigmaCloudmapRenderer() {

    // Return the renderer itself:
    var renderer = function(nodes, context, isAnimated, settings) {
      var i
      var l
      var args = arguments
      var prefix = settings('prefix') || ''
      var scaleFactor = backingScale(context);
      var w = context.canvas.clientWidth * scaleFactor
      var h = context.canvas.clientHeight * scaleFactor
      var size = Math.min(w, h)

      context.save()

      if (isAnimated) {
        var imgData_Filling = paintGooeyLayer(nodes, prefix, context, w, h, {
          rgb: [222, 230, 238],
          blurRadius: 0,
          contrastFilter: false,
          nodeSize: .025 * size
        })
        var imgData_Accent = paintGooeyLayer(nodes, prefix, context, w, h, {
          rgb: [255, 255, 255],
          blurRadius: 0,
          contrastFilter: false,
          nodeSize: .002 * size
        })
        var imgd = mergeImgdLayers([imgData_Filling, imgData_Accent], w, h)
        context.putImageData( imgd, 0, 0 )
      } else {
        var imgData_Border = paintGooeyLayer(nodes, prefix, context, w, h, {
          rgb: [184, 193, 200],
          blurRadius: .03  * size,
          contrastFilter: true,
          contrastThreshold: 0.8,
          contrastSteepness: 0.03,
          nodeSize: .015 * size
        })
        var imgData_Filling = paintGooeyLayer(nodes, prefix, context, w, h, {
          rgb: [222, 230, 238],
          blurRadius: .03  * size,
          contrastFilter: true,
          contrastThreshold: 0.90,
          contrastSteepness: 0.006,
          nodeSize: .015 * size
        })
        var imgData_Accent = paintGooeyLayer(nodes, prefix, context, w, h, {
          rgb: [255, 255, 255],
          blurRadius: .005 * size,
          contrastFilter: true,
          contrastThreshold: 0.2,
          contrastSteepness: 0.05,
          nodeSize: 0.0015 * size
        })

        var imgd = mergeImgdLayers([imgData_Border, imgData_Filling, imgData_Accent], w, h)
        context.putImageData( imgd, 0, 0 )
      }


    }

    function mergeImgdLayers(imgdArray, w, h) {
      var imgd = imgdArray.shift()
      var imgd2
      while (imgd2 = imgdArray.shift()) {
        var pix = imgd.data
        var pix2 = imgd2.data
        for ( var i = 0, pixlen = pix.length; i < pixlen; i += 4 ) {
          var src_rgb = [pix2[i  ]/255, pix2[i+1]/255, pix2[i+2]/255]
          var src_alpha = pix2[i+3]/255
          var dst_rgb = [pix[i  ]/255, pix[i+1]/255, pix[i+2]/255]
          var dst_alpha = pix[i+3]/255
          var out_alpha = src_alpha + dst_alpha * (1 - src_alpha)
          var out_rgb = [0, 0, 0]
          if (out_alpha > 0) {
            out_rgb[0] = (src_rgb[0] * src_alpha + dst_rgb[0] * dst_alpha * (1 - src_alpha)) / out_alpha
            out_rgb[1] = (src_rgb[1] * src_alpha + dst_rgb[1] * dst_alpha * (1 - src_alpha)) / out_alpha
            out_rgb[2] = (src_rgb[2] * src_alpha + dst_rgb[2] * dst_alpha * (1 - src_alpha)) / out_alpha
          }
          pix[i  ] = Math.floor(out_rgb[0] * 255)
          pix[i+1] = Math.floor(out_rgb[1] * 255)
          pix[i+2] = Math.floor(out_rgb[2] * 255)
          pix[i+3] = Math.floor(out_alpha * 255)
        }
      }
      return imgd
    }

    function paintGooeyLayer(nodes, prefix, context, w, h, settings){
      context.clearRect(0, 0, w, h);

      var color = 'rgba('+settings.rgb[0]+','+settings.rgb[1]+','+settings.rgb[2]+',1)'
      var minalpha = 0

      // This is to prevent transparent areas to be assimiled as "black"
      if (settings.contrastFilter) {
        minalpha = 0.1
        paintAll(context, w, h, 'rgba('+settings.rgb[0]+','+settings.rgb[1]+','+settings.rgb[2]+','+minalpha+')')
      }

      for (i = 0, l = nodes.length; i < l; i++) {
        if (!nodes[i].hidden) {
          var node = nodes[i]
          // Draw
          context.beginPath()
          context.arc(
            node[prefix + 'x'],
            node[prefix + 'y'],
            settings.nodeSize,
            0,
            Math.PI * 2,
            true
          );
          context.lineWidth = settings.nodeSize / 5;
          context.fillStyle = color
          context.fill()
        }
      }

      var imgd = context.getImageData(0, 0, w, h)

      if (settings.blurRadius > 0) {
        blur(imgd, w, h, settings.blurRadius)
      }
      if (settings.contrastFilter) {
        alphacontrast(imgd, w, h, minalpha, settings.contrastThreshold, settings.contrastSteepness)
      }

      return imgd
    }

    function paintAll(ctx, w, h, color) {
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.fillStyle = color
      ctx.fill()
      ctx.closePath()
    }

    function alphacontrast(imgd, w, h, minalpha, threshold, factor) {
      var threshold255 = threshold * 255
      var contrast = buildConstrastFunction(factor, threshold255, minalpha)
      var pix = imgd.data

      // Split channels
      var channels = [[], [], [], []] // rgba
      for ( var i = 0, pixlen = pix.length; i < pixlen; i += 4 ) {
        // Just process the alpha channel
        pix[i+3] = contrast(pix[i+3])
      }

    }

    function buildConstrastFunction(factor, threshold255, minalpha) {
      var samin = 255 / (1 + Math.exp( -factor * (0 - threshold255) ))
      var samax = 255 / (1 + Math.exp( -factor * (1 - threshold255) ))
      var contrast = function(alpha) {
        var alpha2 = alpha / ( 1 - minalpha ) - 255 * minalpha // Alpha corrected to remove the minalpha
        var s_alpha = 255 / (1 + Math.exp( -factor * (alpha2 - threshold255) )) // Sigmoid contrast
        return (s_alpha - samin) / (samax - samin) // Correct the extent of the sigmoid function
      }
      return contrast
    }

    function blur(imgd, w, h, r) {
      var i
      var pix = imgd.data
      var pixlen = pix.length

      // Split channels
      var channels = [] // rgba
      for ( i=0; i<4; i++) {
        var channel = new Uint8ClampedArray(pixlen/4);
        channels.push(channel)
      }
      for ( i = 0; i < pixlen; i += 4 ) {
        channels[0][i/4] = pix[i  ]
        channels[1][i/4] = pix[i+1]
        channels[2][i/4] = pix[i+2]
        channels[3][i/4] = pix[i+3]
      }

      channels.forEach(function(scl){
        var tcl = scl.slice(0)
        var bxs = boxesForGauss(r, 3);
        boxBlur (scl, tcl, w, h, (bxs[0]-1)/2);
        boxBlur (tcl, scl, w, h, (bxs[1]-1)/2);
        boxBlur (scl, tcl, w, h, (bxs[2]-1)/2);
        scl = tcl
      })

      // Merge channels
      for ( var i = 0, pixlen = pix.length; i < pixlen; i += 4 ) {
        pix[i  ] = channels[0][i/4]
        pix[i+1] = channels[1][i/4]
        pix[i+2] = channels[2][i/4]
        pix[i+3] = channels[3][i/4]
      }
    }

    return renderer
  }

  function backingScale(context) {
    if ('devicePixelRatio' in window) {
        if (window.devicePixelRatio > 1) {
            return window.devicePixelRatio;
        }
    }
    return 1;
  }

  /**
   * This method renders the graph on the canvases.
   *
   * @param  {?object}                options Eventually an object of options.
   * @return {sigma.renderers.canvas}         Returns the instance itself.
   */
  sigma.renderers.canvas.prototype.render = function(options) {
    options = options || {};

    var a,
        i,
        k,
        l,
        o,
        id,
        end,
        job,
        start,
        edges,
        renderers,
        rendererType,
        batchSize,
        tempGCO,
        index = {},
        graph = this.graph,
        nodes = this.graph.nodes,
        prefix = this.options.prefix || '',
        drawEdges = this.settings(options, 'drawEdges'),
        drawNodes = this.settings(options, 'drawNodes'),
        drawLabels = this.settings(options, 'drawLabels'),
        drawEdgeLabels = this.settings(options, 'drawEdgeLabels'),
        embedSettings = this.settings.embedObjects(options, {
          prefix: this.options.prefix
        });

    // Call the resize function:
    this.resize(false);

    // Check the 'hideEdgesOnMove' setting:
    if (this.settings(options, 'hideEdgesOnMove'))
      if (this.camera.isAnimated || this.camera.isMoving)
        drawEdges = false;

    // Apply the camera's view:
    this.camera.applyView(
      undefined,
      this.options.prefix,
      {
        width: this.width,
        height: this.height
      }
    );

    // Clear canvases:
    this.clear();

    // Kill running jobs:
    for (k in this.jobs)
      if (conrad.hasJob(k))
        conrad.killJob(k);

    // Find which nodes are on screen:
    this.edgesOnScreen = [];
    this.nodesOnScreen = this.camera.quadtree.area(
      this.camera.getRectangle(this.width, this.height)
    );

    for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
      index[a[i].id] = a[i];

    // START TUNING SIGMA
    renderers = sigma.canvas.allnodes.def
    renderers(
      this.nodesOnScreen,
      this.contexts.nodes,
      this.camera.isAnimated || this.camera.isMoving,
      embedSettings
    )
    // END TUNING SIGMA

    // Draw edges:
    // - If settings('batchEdgesDrawing') is true, the edges are displayed per
    //   batches. If not, they are drawn in one frame.
    if (drawEdges) {
      // First, let's identify which edges to draw. To do this, we just keep
      // every edges that have at least one extremity displayed according to
      // the quadtree and the "hidden" attribute. We also do not keep hidden
      // edges.
      for (a = graph.edges(), i = 0, l = a.length; i < l; i++) {
        o = a[i];
        if (
          (index[o.source] || index[o.target]) &&
          (!o.hidden && !nodes(o.source).hidden && !nodes(o.target).hidden)
        )
          this.edgesOnScreen.push(o);
      }

      // If the "batchEdgesDrawing" settings is true, edges are batched:
      if (this.settings(options, 'batchEdgesDrawing')) {
        id = 'edges_' + this.conradId;
        batchSize = embedSettings('canvasEdgesBatchSize');

        edges = this.edgesOnScreen;
        l = edges.length;

        start = 0;
        end = Math.min(edges.length, start + batchSize);

        job = function() {
          tempGCO = this.contexts.edges.globalCompositeOperation;
          this.contexts.edges.globalCompositeOperation = 'destination-over';

          renderers = sigma.canvas.edges;
          for (i = start; i < end; i++) {
            o = edges[i];
            (renderers[
              o.type || this.settings(options, 'defaultEdgeType')
            ] || renderers.def)(
              o,
              graph.nodes(o.source),
              graph.nodes(o.target),
              this.contexts.edges,
              embedSettings
            );
          }

          // Draw edge labels:
          if (drawEdgeLabels) {
            renderers = sigma.canvas.edges.labels;
            for (i = start; i < end; i++) {
              o = edges[i];
              if (!o.hidden)
                (renderers[
                  o.type || this.settings(options, 'defaultEdgeType')
                ] || renderers.def)(
                  o,
                  graph.nodes(o.source),
                  graph.nodes(o.target),
                  this.contexts.labels,
                  embedSettings
                );
            }
          }

          // Restore original globalCompositeOperation:
          this.contexts.edges.globalCompositeOperation = tempGCO;

          // Catch job's end:
          if (end === edges.length) {
            delete this.jobs[id];
            return false;
          }

          start = end + 1;
          end = Math.min(edges.length, start + batchSize);
          return true;
        };

        this.jobs[id] = job;
        conrad.addJob(id, job.bind(this));

      // If not, they are drawn in one frame:
      } else {
        renderers = sigma.canvas.edges;
        for (a = this.edgesOnScreen, i = 0, l = a.length; i < l; i++) {
          o = a[i];
          (renderers[
            o.type || this.settings(options, 'defaultEdgeType')
          ] || renderers.def)(
            o,
            graph.nodes(o.source),
            graph.nodes(o.target),
            this.contexts.edges,
            embedSettings
          );
        }

        // Draw edge labels:
        // - No batching
        if (drawEdgeLabels) {
          renderers = sigma.canvas.edges.labels;
          for (a = this.edgesOnScreen, i = 0, l = a.length; i < l; i++)
            if (!a[i].hidden)
              (renderers[
                a[i].type || this.settings(options, 'defaultEdgeType')
              ] || renderers.def)(
                a[i],
                graph.nodes(a[i].source),
                graph.nodes(a[i].target),
                this.contexts.labels,
                embedSettings
              );
        }
      }
    }

    // Draw nodes:
    // - No batching
    if (drawNodes) {
      renderers = sigma.canvas.nodes;
      for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
        if (!a[i].hidden)
          (renderers[
            a[i].type || this.settings(options, 'defaultNodeType')
          ] || renderers.def)(
            a[i],
            this.contexts.nodes,
            embedSettings
          );
    }

    // Draw labels:
    // - No batching
    if (drawLabels) {
      renderers = sigma.canvas.labels;
      for (a = this.nodesOnScreen, i = 0, l = a.length; i < l; i++)
        if (!a[i].hidden)
          (renderers[
            a[i].type || this.settings(options, 'defaultNodeType')
          ] || renderers.def)(
            a[i],
            this.contexts.labels,
            embedSettings
          );
    }

    this.dispatchEvent('render');

    return this;
  };

  // From http://blog.ivank.net/fastest-gaussian-blur.html

  function boxesForGauss(sigma, n) { // standard deviation, number of boxes
  
    var wIdeal = Math.sqrt((12*sigma*sigma/n)+1);  // Ideal averaging filter width 
    var wl = Math.floor(wIdeal);  if(wl%2==0) wl--;
    var wu = wl+2;
    
    var mIdeal = (12*sigma*sigma - n*wl*wl - 4*n*wl - 3*n)/(-4*wl - 4);
    var m = Math.round(mIdeal);
    // var sigmaActual = Math.sqrt( (m*wl*wl + (n-m)*wu*wu - n)/12 );
        
    var sizes = [];  for(var i=0; i<n; i++) sizes.push(i<m?wl:wu);
    return sizes;
  }

  function boxBlur (scl, tcl, w, h, r) {
    for(var i=0; i<scl.length; i++) tcl[i] = scl[i];
    boxBlurH(tcl, scl, w, h, r);
    boxBlurT(scl, tcl, w, h, r);
  }

  function boxBlurH (scl, tcl, w, h, r) {
    var iarr = 1 / (r+r+1);
    for(var i=0; i<h; i++) {
      var ti = i*w, li = ti, ri = ti+r;
      var fv = scl[ti], lv = scl[ti+w-1], val = (r+1)*fv;
      for(var j=0; j<r; j++) val += scl[ti+j];
      for(var j=0  ; j<=r ; j++) { val += scl[ri++] - fv       ;   tcl[ti++] = Math.round(val*iarr); }
      for(var j=r+1; j<w-r; j++) { val += scl[ri++] - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
      for(var j=w-r; j<w  ; j++) { val += lv        - scl[li++];   tcl[ti++] = Math.round(val*iarr); }
    }
  }

  function boxBlurT (scl, tcl, w, h, r) {
    var iarr = 1 / (r+r+1);
    for(var i=0; i<w; i++) {
      var ti = i, li = ti, ri = ti+r*w;
      var fv = scl[ti], lv = scl[ti+w*(h-1)], val = (r+1)*fv;
      for(var j=0; j<r; j++) val += scl[ti+j*w];
      for(var j=0  ; j<=r ; j++) { val += scl[ri] - fv     ;  tcl[ti] = Math.round(val*iarr);  ri+=w; ti+=w; }
      for(var j=r+1; j<h-r; j++) { val += scl[ri] - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ri+=w; ti+=w; }
      for(var j=h-r; j<h  ; j++) { val += lv      - scl[li];  tcl[ti] = Math.round(val*iarr);  li+=w; ti+=w; }
    }
  }

})(sigma);