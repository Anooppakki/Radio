/**
 * Inspired by this pen from Justin Windle, cheers m8! (http://codepen.io/soulwire/pen/Dscga)
 */
(function(){
	var AudioAnalyser = function (_audio)
	{
		// Store `this` for use in inner scopes
		var _this = this;
		var numBands, smoothing, muted;
		var context, jsNode, analyser, source;
		var isInitialized;

		/**
		 * Initializer
		 */
		function init(_numBands, _smoothing, _muted)
		{
			// Set the local variables / settings
			_this.audio = _audio != null ? _audio : new Audio();

			numBands = _numBands != null ? _numBands : 32;
			smoothing = _smoothing != null ? _smoothing : 0.1;
			muted = _muted != null ? _muted : false;

			// Check if an audio object is given, otherwise make one from the source string
			if (typeof _this.audio === 'string') {
				var src = _this.audio;

				_this.audio = new Audio();
				_this.audio.crossOrigin = 'anonymous';
				_this.audio.controls = true;
				_this.audio.src = src;
			}

			// Create the AudioContext
			context = new AudioAnalyser.AudioContext();

			// Create the ScriptProcessor
			jsNode = context.createScriptProcessor(1024,1,1);

			// Create the Context's Analyser
			analyser = context.createAnalyser();
			analyser.smoothingTimeConstant = smoothing;
			analyser.fftSize = numBands * 2;

			isInitialized = false;

			// Allocate a new Unsigned int8 array
			_this.bands = new Uint8Array(analyser.frequencyBinCount);

			// Add eventlistener for the 'play' event, gets fired once enough data is buffered
			// to play the stream / tune.
			_this.audio.addEventListener('play', ready, false);
		}

		/**
		 * Called when the audio is ready to play
		 */
		function ready()
		{
			if (isInitialized) {
				return;
			}

			// Create media element from source
			source = context.createMediaElementSource(_this.audio);

			// Connect the analyser to the source
			source.connect(analyser);

			// Connect the jsNode to the analyser
			analyser.connect(jsNode);

			// Connect the destination to the jsNode
			jsNode.connect(context.destination);

			// Check if the sound should be playing
			if (!muted) {
				// Connect the destination to the audio source
				source.connect(context.destination);
			}

			// Call the processAudio() function
			jsNode.onaudioprocess = processAudio;

			isInitialized = true;
		}

		/**
		 * Called whenever there is new FFT data available
		 */
		function processAudio(e)
		{
			analyser.getByteFrequencyData(_this.bands);

			var out = e.outputBuffer.getChannelData(0);
			var int = e.inputBuffer.getChannelData(0);
			var max = 0;

			for (var i = 0; i < int.length; i++) {
				out[i] = 0; // prevent feedback + we only need the input data
				max = int[i] > max ? int[i] : max;
			}

			// set the energy value
			_this.energy = max;

			//convert from magnitude to decibel
			_this.decibels = 20 * Math.log( Math.max(max, Math.pow(10,-72/20)) ) / Math.LN10;

			if (!_this.audio.paused) {
				if (_this.onUpdate != null && typeof _this.onUpdate === 'function') {
					_this.onUpdate(_this.bands, _this.decibels, _this.energy); // call the onUpdate method
				}
			}
		}

		// Finally, start the init method
		init();
	};

	/**
	 * Start method
	 */
	AudioAnalyser.prototype.start = function () {
		return this.audio.play();
	};

	/**
	 * Stop method
	 */
	AudioAnalyser.prototype.stop = function () {
		return this.audio.pause();
	};

	// Set the AudioContext, if that's not found, try the (deprecated) webkitAudioContext
	AudioAnalyser.AudioContext = window.AudioContext || window.webkitAudioContext;

	// If the AudioAnalyser is enabled / working.
	AudioAnalyser.enabled = AudioAnalyser.AudioContext != null;

	// Make the AudioAnalyser globally available
	window.AudioAnalyser = AudioAnalyser;
})();

(function(){
	window.Analyser = function (_audioElem) {
		this.numOfBands = 32;
		this.smoothing = 0.3;

		var beforeInputInterval;
		var beforeInputTimeout = 16; // +/- 60 fps
		var tempCounter = 0;
		var tempFrequency = 15;
		var tempAmplitude = 0.6;

		var analyser;
		var _this = this;

		// Sets everything up
		this.init = function(_numOfBands, _smoothing)
		{
			// The source of the mp3 stream, an html5 audio element or the path to the strema.
			var source;

			if (!_audioElem) {
				source = 'http://52.28.104.70:8000/broadcast';
			} else {
				source = _audioElem;
			}

			// The number of bands to read
			_this.numOfBands = _numOfBands != null ? _numOfBands : 32;

			// The amount of smoothing to use
			_this.smoothing = _smoothing != null ? _smoothing : 0.3;

			// Allocate a new AudioAnalyser, give the mp3/path, number of bands and the smoothing as arguments
			analyser = new AudioAnalyser(source, _this.numOfBands, _this.smoothing);

			// Listen to the onUpdate event
			analyser.onUpdate = function (_bands, _decibels, _energy) {
				if (beforeInputInterval != null) {
					clearInterval(beforeInputInterval);

					beforeInputInterval = null;
				}

				// set the global bands variable to the newly received bands
				Analyser.bands = _bands;

				// set the global decibels variable to the newly received db's
				Analyser.decibels = _decibels;

				// set the energy value
				Analyser.energy = _energy;

				if (_energy == 0) {
					createTempData();
				}

				// call the onUpdate method, if it exists
				if (_this.onUpdate != null && typeof _this.onUpdate === 'function') {
					_this.onUpdate(_bands, _decibels, Analyser.energy); // call the onUpdate method
				}
			};
		};

		function createTempData()
		{
			tempCounter++;

			Analyser.energy = Math.sin(tempCounter / tempFrequency) * tempAmplitude;

			for (var i = 0; i < Analyser.bands.length; i++) {
				Analyser.bands[i] = Math.sin((i + tempCounter) / tempFrequency) * (Math.random() * 255);
			}
		}

		/**
		 * Call to start the analyser
		 */
		this.start = function () {
			// Start the AudioAnalyser
			analyser.start();

			// Start the timer for the temporary visuals / input
			beforeInputInterval = setInterval(createTempData, beforeInputTimeout);
		};

		/**
		 * Call to stop the analyser
		 */
		this.stop = function () {
			// Start the AudioAnalyser
			analyser.stop();
		};
	};

	Analyser.bands = [];
	Analyser.decibels = 0;
	Analyser.energy = 0;
})();

(function(){
	var calc = function () {
		this.map = function (value, low1, high1, low2, high2)
		{
			return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
		}
	};

	window.Calc = new calc();
})();




(function() {
  "use strict";

  var canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    w = canvas.width = window.innerWidth,
    h = canvas.height = window.innerHeight,
    points = [],
    drawCount = 0,
    rotationRadius = 0,
    rotationRadiusUp = true,
    center = {
      x: w / 2,
      y: h / 2
    },
    settings = {
      speed: 1,
      rotationSpeed: -1,
      rotationRadiusFrom: 178,
      rotationRadiusTo: 280,
      rotationRadiusSpeed: 1.5,
      connectionDistance: 0,
      connectionDistanceFract: 12.1,
      lineWidth: 4.4,
      size: 0.4,
      killAfter: 190,
      hue: 187,
      saturation: 100,
      brightness: 50,
      backgroundSaturation: 0,
      backgroundBrightness: 0,
      backgroundAlpha: 0.033,
      randomSize: 0,
      pushEvery: 1,
      scaleFrom: 680,
      scaleTo: 760,
      scaleMin: -0.4,
      scaleMax: 0.1
    },
    analyser;

  function setup() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;

    // Allocate a new analyser
    analyser = new Analyser(document.getElementById('stream'));
    analyser.init();
    analyser.start();

    ctx.fillStyle = 'hsl(' + settings.hue + ',40%,50%)';
    ctx.fillRect(0, 0, w, h);

    rotationRadius = settings.rotationRadiusFrom;

    var gui = new dat.GUI();
    gui.add(settings, 'speed').min(0).max(500).step(2);
    gui.add(settings, 'rotationSpeed').min(-500).max(500).step(2);
    gui.add(settings, 'rotationRadiusFrom').min(0).max(500).step(2);
    gui.add(settings, 'rotationRadiusTo').min(0).max(1000).step(2);
    gui.add(settings, 'rotationRadiusSpeed').min(0.0).max(3.0).step(0.01);
    gui.add(settings, 'connectionDistance').min(0).max(500).step(1);
    gui.add(settings, 'connectionDistanceFract').min(0.0).max(35.0).step(0.1);
    gui.add(settings, 'lineWidth').min(0).max(20).step(0.1);
    gui.add(settings, 'size').min(0.2).max(20).step(0.1);
    gui.add(settings, 'killAfter').min(10).max(1000).step(2);
    gui.add(settings, 'hue').min(0).max(360).step(1);
    gui.add(settings, 'saturation').min(0).max(100).step(1);
    gui.add(settings, 'brightness').min(0).max(100).step(1);
    gui.add(settings, 'backgroundSaturation').min(0).max(100).step(1);
    gui.add(settings, 'backgroundBrightness').min(0).max(100).step(1);
    gui.add(settings, 'backgroundAlpha').min(0.0).max(1.0).step(0.01);
    gui.add(settings, 'randomSize').min(0).max(5).step(0.1);
    gui.add(settings, 'pushEvery').min(1).max(100).step(1);
    gui.add(settings, 'scaleFrom').min(0).max(5000).step(10);
    gui.add(settings, 'scaleTo').min(0).max(5000).step(10);
    gui.add(settings, 'scaleMin').min(-2.0).max(2.0).step(0.1);
    gui.add(settings, 'scaleMax').min(0.0).max(5.0).step(0.1);
    gui.close();
    
    draw();
  }

  function draw() {
    ctx.fillStyle = 'hsla(' + settings.hue + ',' + settings.backgroundSaturation + '%,' + settings.backgroundBrightness + '%, ' + settings.backgroundAlpha + ')';
    ctx.fillRect(-(w / 2), -(h / 2), w * 2, h * 2);

    ctx.save();

    if (Analyser.bands != null && Analyser.bands.length > 0) {
      var lowEnd = Analyser.bands[0] + Analyser.bands[1] + Analyser.bands[2] + Analyser.bands[3] + Analyser.bands[4];
      var scale = mapValue(lowEnd, settings.scaleFrom, settings.scaleTo, settings.scaleMin, settings.scaleMax);

      ctx.translate((w - (w * scale)) / 2, (h - (h * scale)) / 2);
      ctx.scale(scale, scale);
    }

    ctx.fillStyle = 'hsl(' + settings.hue + ',' + settings.saturation + '%,' + settings.brightness + '%)';
    ctx.strokeStyle = 'hsl(' + settings.hue + ',' + settings.saturation + '%,' + settings.brightness + '%)';
    ctx.lineWidth = settings.lineWidth;

    var distanceAdd = Calc.map(rotationRadius, settings.rotationRadiusFrom, settings.rotationRadiusTo, 1.0, settings.connectionDistanceFract);

    var connDistance = settings.connectionDistance;
    connDistance += distanceAdd;

    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      point.draw();

      for (var n = 0; n < points.length; n++) {
        var connection = points[n];
        var distanceX = Math.pow((connection.x - point.x), 2);
        var distanceY = Math.pow((connection.y - point.y), 2);
        var distance = Math.sqrt(distanceX + distanceY);

        if (distance <= connDistance) {
          ctx.strokeStyle = 'hsla(' + settings.hue + ',' + settings.saturation + '%,' + settings.brightness + '%, ' + connection.opacity + ')';

          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(connection.x, connection.y);
          ctx.stroke();
          ctx.closePath();
        }

        connection = null;
      }
    }

    drawCount++;

    pushPoints();

    ctx.restore();

    if (rotationRadiusUp) {
      rotationRadius += settings.rotationRadiusSpeed;
    } else {
      rotationRadius -= settings.rotationRadiusSpeed;
    }

    if (rotationRadius > settings.rotationRadiusTo) {
      rotationRadiusUp = false;
    } else if (rotationRadius < settings.rotationRadiusFrom) {
      rotationRadiusUp = true;
    }

    window.requestAnimationFrame(draw);
  }

  function pushPoints() {
    if (drawCount % settings.pushEvery == 0) {
      var centerX = Math.sin(drawCount / settings.rotationSpeed) * rotationRadius;
      var centerY = Math.cos(drawCount / settings.rotationSpeed) * rotationRadius;

      for (var i = 0; i < 1; i++) {
        var xSpeed = (Math.random() * (settings.speed / 10)) - (settings.speed / 20);
        var ySpeed = (Math.random() * (settings.speed / 10)) - (settings.speed / 20);

        points.push(new Point(center.x + centerX, center.y + centerY, xSpeed, ySpeed, settings.killAfter));
      }
    }
  }

  var Point = function(_x, _y, _xSpeed, _ySpeed, _killAfter) {
    this.x = _x;
    this.y = _y;
    this.xSpeed = _xSpeed;
    this.ySpeed = _ySpeed;
    this.killAfter = _killAfter != null ? _killAfter : 400;
    this.lifetime = 0;
    this.opacity = 1.0;

    var _this = this;

    this.draw = function() {
      if (_this.lifetime > _this.killAfter) {
        _this.dealloc();

        return;
      }

      var xNoise = ((Math.random() * settings.randomSize) - settings.randomSize / 2);
      var yNoise = ((Math.random() * settings.randomSize) - settings.randomSize / 2);

      _this.x += _this.xSpeed + xNoise;
      _this.y += _this.ySpeed + yNoise;

      if (_this.x < settings.size || _this.x > (w - settings.size)) {
        _this.dealloc();

        return;
      }

      if (_this.y < settings.size || _this.y > (h - settings.size)) {
        _this.dealloc();

        return;
      }

      _this.opacity = 1.0 - (_this.lifetime / _this.killAfter);

      ctx.fillStyle = 'hsla(' + settings.hue + ',' + settings.saturation + '%,' + settings.brightness + '%,' + _this.opacity + ')';

      ctx.beginPath();
      ctx.arc(_this.x, _this.y, settings.size, 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();

      _this.lifetime++;
    };

    this.dealloc = function() {
      var index = points.indexOf(_this);

      if (index > -1) {
        points.splice(index, 1);
      }

      _this = null; // remove strong reference to 'this'
    };
  };

  function mapValue(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
  }

  window.addEventListener('resize', function() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;

    center = {
      x: w / 2,
      y: h / 2
    };

    ctx.fillStyle = 'hsl(' + settings.hue + ',40%,50%)';
    ctx.fillRect(0, 0, w, h);
  }, false);

  setup();
})();