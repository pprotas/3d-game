var camera, scene, renderer, controls;

var objects = [];
var notes = [];

var raycasterF, raycasterB, raycasterL, raycasterR, raycasterX, INTERSECTED;
var composer, outlinePass, allowPickUp;

var lantern;

var blocker = document.getElementById('blocker');
var instructions = document.getElementById('instructions');
var deathscreen = document.getElementById('deathscreen');

var pickUp = document.getElementById('pickUp');
var hint = document.getElementById('hint');

var props;

// http://www.html5rocks.com/en/tutorials/pointerlock/intro/

var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;

if (havePointerLock) {

	var element = document.body;
	
	function tryPickUp(){
		if(allowPickUp === true){
			note++;
			scene.remove(INTERSECTED);
			notes.splice(notes.indexOf(INTERSECTED), 1);
		}
		if(note == 6){
			hint.style.display = 'block';
		}
	}

	var pointerlockchange = function (event) {

		if (health) {
			if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {

				controlsEnabled = true;
				controls.enabled = true;

				blocker.style.display = 'none';
				pickUp.style.display = 'none';


			} else {

				controls.enabled = false;

				blocker.style.display = 'block';

				instructions.style.display = '';
				pickUp.style.display = 'none';

			}
		}

	};

	var pointerlockerror = function (event) {

		instructions.style.display = '';

	};

	// Hook pointer lock state change events
	document.addEventListener('pointerlockchange', pointerlockchange, false);
	document.addEventListener('mozpointerlockchange', pointerlockchange, false);
	document.addEventListener('webkitpointerlockchange', pointerlockchange, false);

	document.addEventListener('pointerlockerror', pointerlockerror, false);
	document.addEventListener('mozpointerlockerror', pointerlockerror, false);
	document.addEventListener('webkitpointerlockerror', pointerlockerror, false);

	instructions.addEventListener('click', function (event) {

		instructions.style.display = 'none';

		// Ask the browser to lock the pointer
		element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
		element.requestPointerLock();

	}, false);

} else {	

	instructions.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';

}

var controlsEnabled = false;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var canJump = false;
var crouch = false;
var sprint = false;
var health = 100;
var stamina = 1000;
var note = 0;
var monster;
var monsterTeleport = false;
var achtervolg = false;
var sound;
var rayXOrigin = 10;

var prevTime = performance.now();
var velocity = new THREE.Vector3();
var direction = new THREE.Vector3();
var vertex = new THREE.Vector3();
var color = new THREE.Color();

init();
animate();

function init() {
	pickUp.style.display = 'none';
	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 101);

	scene = new THREE.Scene();
	scene.background = new THREE.Color(000000);
	scene.fog = new THREE.Fog(000000, 0, 50);

	controls = new THREE.PointerLockControls(camera);
	scene.add(controls.getObject());

	monster = new Monster();
	monster.position.set(220, 0, -170);

	scene.add(monster);
	objects.push(monster);

	lantern = new THREE.Group();
	loadOBJModel("models/", "lantern.obj", "models/", "lantern.mtl", (mesh) => {
		mesh.material = new THREE.MeshPhongMaterial();
		mesh.scale.set(2, 4, 2);
		mesh.position.x = 3;
		mesh.position.z = -3;
		lantern.add(mesh);

		var l = new THREE.PointLight(0xffd6aa, 1, 35);
		l.castShadow = true;
		l.shadow.mapSize.width = 512;  // default
		l.shadow.mapSize.height = 512; // default
		l.shadow.camera.near = 0.5;       // default
		l.shadow.camera.far = 500      // default
		lantern.add(l);
	});
	scene.add(lantern);
	camera.add(lantern);

	props = new THREE.Group();
	loadObjects();
	objects.push(props);
	scene.add(props);

	var onKeyDown = function (event) {

		switch (event.keyCode) {

			case 38: // up
			case 87: // w
				moveForward = true;
				break;

			case 37: // left
			case 65: // a
				moveLeft = true; break;

			case 40: // down
			case 83: // s
				moveBackward = true;
				break;

			case 39: // right
			case 68: // d
				moveRight = true;
				break;
			case 67: //c
				crouch = true;
				break;
			case 16: //shift
				sprint = true;
				break;
			case 70: //f
				fly = true;
				break;
			case 88: //x
				monsterTeleport = true;
				break;
			case 82: //r
				if (!health) location.reload();
			case 69: //e
				tryPickUp();
				break;
		}
	};

	var onKeyUp = function (event) {

		switch (event.keyCode) {

			case 38: // up
			case 87: // w
				moveForward = false;
				break;

			case 37: // left
			case 65: // a
				moveLeft = false;
				break;

			case 40: // down
			case 83: // s
				moveBackward = false;
				break;

			case 39: // right
			case 68: // d
				moveRight = false;
				break;
			case 67: //c
				crouch = false;
				break;
			case 16: //shift
				sprint = false;
				break;
			case 88: //x
				monsterTeleport = false;
				break;
		}
	};

	document.addEventListener('keydown', onKeyDown, false);
	document.addEventListener('keyup', onKeyUp, false);

	raycasterF = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), 0, 6);
	raycasterB = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), 0, 6);
	raycasterL = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(-1, 0, 0), 0, 6);
	raycasterR = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0, 6);

	raycasterX = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, 0), 0, 15);

	//AFRICA
	var listener = new THREE.AudioListener();
	camera.add(listener);

	// create a global audio source
	var sound = new THREE.Audio(listener);

	// load a sound and set it as the Audio object's buffer AFRICAAAAAAAAAAAAAAAAAAAAAAAAAA
	var audioLoader = new THREE.AudioLoader();
	audioLoader.load('sounds/Toto-Africa.mp3', function (buffer) {
		sound.setBuffer(buffer);
		sound.setLoop(true);
		sound.setVolume(0.5);
		sound.play();
	});
	// floor number : 1,4,10,23,39 best,,240best,241,243
	var textureLoader = new THREE.TextureLoader();
	var floorTexture = textureLoader.load('textures/pattern_41/specular.png');
	//var floorTexture = new THREE.ImageUtils.loadTexture('textures/cookiehunger.png')//lolzies

	floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
	floorTexture.repeat.set(100, 100);

	var floorMaterial = new THREE.MeshPhongMaterial({
		map: floorTexture,
		side: THREE.DoubleSide
	});

	var floorGeometry = new THREE.PlaneBufferGeometry(700, 700, 1, 1);

	var floor = new THREE.Mesh(floorGeometry, floorMaterial);
	floor.position.y = -0.5;
	floor.rotation.x = Math.PI / 2;
	floor.receiveShadow = true;
	scene.add(floor);


	//cealing	
	//var ceilingTexture = new THREE.ImageUtils.loadTexture('textures/cookienightmare.jpg')//lolzies
	var ceilingTexture = textureLoader.load('textures/ceiling.png')
	ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping;
	ceilingTexture.repeat.set(100, 100);

	var cealingMaterial = new THREE.MeshPhongMaterial({
		map: ceilingTexture,
		side: THREE.DoubleSide
	});

	var ceilingGeometry = new THREE.PlaneBufferGeometry(700, 700, 1, 1);

	var ceiling = new THREE.Mesh(ceilingGeometry, cealingMaterial);
	ceiling.position.y = 20;
	ceiling.rotation.x = Math.PI / 2;
	scene.add(ceiling);

	loader = new THREE.JSONLoader();

	loader.load("models/json/doors.json", function (geometry) {
		mesh = new THREE.Mesh(geometry, new THREE.MeshNormalMaterial());
		mesh.scale.set(10, 10, 10);
		mesh.position.y = 150;
		mesh.position.x = 0;
		scene.add(mesh);
	});


	walls.forEach(function (element) {
		objects.push(element);
		scene.add(element);
	});

	var lastPositionx = controls.getObject().position.x;
	var lastPositionz = controls.getObject().position.z;

	window.setInterval(function () {
		if (Math.sqrt(Math.pow(controls.getObject().position.x - lastPositionx, 2) + Math.pow(controls.getObject().position.z - lastPositionz, 2)) < 10) {
			achtervolg = true;
		}
		lastPositionx = controls.getObject().position.x;
		lastPositionz = controls.getObject().position.z;
	}, 5000);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);

	composer = new THREE.EffectComposer(renderer);
	var renderPass = new THREE.RenderPass(scene, camera);
	composer.addPass(renderPass);
	outlinePass = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
	composer.addPass(outlinePass);

	document.body.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize, false);

	var notePlane = new THREE.PlaneGeometry(1.5, 3);
	var noteMaterial = new THREE.MeshPhongMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
	var noteObj = new THREE.Mesh(notePlane, noteMaterial);

	scene.add(noteObj);
	for(i = 0; i < 6; i++){
		notes.push(noteObj.clone());
		scene.add(notes[i]);
	}
	notes[0].position.set(139, 8, 26);
	notes[0].position.set(-80, 10, -20.5);
	notes[2].position.set(-160, 1, -47);
	notes[3].position.set(-36, 3, 47);
	notes[4].position.set(-3, 4, 166);
	notes[5].position.set(51, 6, 78.7);
	
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
	requestAnimationFrame(animate);

	if (controlsEnabled === true) {
		document.getElementById("health").innerHTML = "HP Points: " + health;
		document.getElementById("stamina").innerHTML = "Stamina: " + stamina / 10;
		document.getElementById("notes").innerHTML = "Notes: " + note;

		raycasterF.ray.origin.copy(controls.getObject().position);
		camera.getWorldDirection(raycasterF.ray.direction);
		raycasterF.ray.origin.y = 10;

		raycasterB.ray.origin.copy(controls.getObject().position);
		raycasterB.ray.direction.set(-raycasterR.ray.direction.z, 0, raycasterR.ray.direction.x);
		raycasterB.ray.origin.y = 10;

		raycasterL.ray.origin.copy(controls.getObject().position);
		raycasterL.ray.direction.set(-raycasterB.ray.direction.z, 0, raycasterB.ray.direction.x);
		raycasterL.ray.origin.y = 10;

		raycasterR.ray.origin.copy(controls.getObject().position);
		raycasterR.ray.direction.set(-raycasterF.ray.direction.z, 0, raycasterF.ray.direction.x);
		raycasterR.ray.origin.y = 10;

		raycasterX.ray.origin.copy(controls.getObject().position);
		camera.getWorldDirection(raycasterX.ray.direction);
		raycasterX.ray.origin.y = rayXOrigin;

		var intersectionsF = raycasterF.intersectObjects(objects);
		var intersectionsB = raycasterB.intersectObjects(objects);
		var intersectionsL = raycasterL.intersectObjects(objects);
		var intersectionsR = raycasterR.intersectObjects(objects);

		var intersectionsX = raycasterX.intersectObjects(notes, true);

		if (intersectionsX.length > 0) {
			if ( INTERSECTED != intersectionsX[ 0 ].object ) {
				if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
				INTERSECTED = intersectionsX[ 0 ].object;
				INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
				INTERSECTED.material.emissive.setHex( 0xff0000 );

				allowPickUp = true;

				pickUp.style.display = 'block';
			}
		} else {
			if ( INTERSECTED ) INTERSECTED.material.emissive.setHex( INTERSECTED.currentHex );
			INTERSECTED = null;
			pickUp.style.display = 'none';
			allowPickUp = false;
		}

		var forwardObject = intersectionsF.length > 0;
		var backObject = intersectionsB.length > 0;
		var leftObject = intersectionsL.length > 0;
		var rightObject = intersectionsR.length > 0;

		var time = performance.now();
		var delta = (time - prevTime) / 1000;

		monster.lookAt(controls.getObject().position.x, 0, controls.getObject().position.z);

		velocity.x -= velocity.x * 10.0 * delta;
		velocity.z -= velocity.z * 10.0 * delta;

		velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

		direction.z = Number(moveForward) - Number(moveBackward);
		direction.x = Number(moveLeft) - Number(moveRight);
		direction.normalize(); // this ensures consistent movements in all directions

		if (moveForward || moveBackward) velocity.z -= direction.z * 100.0 * delta;
		if (moveLeft || moveRight) velocity.x -= direction.x * 100.0 * delta;


		if (sprint && stamina > 2) {
			if (moveForward) {
				velocity.z += -1.5;
				stamina -= 3;
			}
		}
		else {
			if (!((moveForward || moveBackward) && !(moveForward && moveBackward)) && !((moveLeft || moveRight) && !(moveLeft && moveRight)))
				if (stamina < 1000) stamina += 2; else stamina = 1000;

		}

		if (crouch) {
			if (camera.position.y > -5) camera.position.y -= 0.5;
			else camera.position.y = -5;
			rayXOrigin = 5;
			velocity.x = velocity.x / 1.2;
			velocity.z = velocity.z / 1.2;
		}
		else {
			if (camera.position.y < 0) camera.position.y += 0.5;
			else camera.position.y = 0;
			rayXOrigin = 10;
		}

		if (Math.abs(controls.getObject().position.x - monster.position.x) < 12 && Math.abs(controls.getObject().position.z - monster.position.z) < 12) {
			//health -= 1;
		}

		if (monsterTeleport) {
			achtervolg = true;
		}

		if (achtervolg) {
			achtervolg = false;
			monster.position.set(controls.getObject().position.x, 0, controls.getObject().position.z - 10);
			var interval = window.setInterval(function () {
				if (Math.sqrt(Math.pow(controls.getObject().position.x - monster.position.x, 2) + Math.pow(controls.getObject().position.z - monster.position.z, 2)) > 100) {
					window.clearInterval(interval);
					monster.position.set(0, 100, 0);
				}
				else {
					monster.position.set(controls.getObject().position.x, 0, controls.getObject().position.z - 10);
				}
			}, 3000);
		}

		if (forwardObject === true) {
			velocity.z = 1;
		}
		if (backObject === true) {
			velocity.z = -1;
		}
		if (leftObject === true) {
			velocity.x = 1;
		}
		if (rightObject === true) {
			velocity.x = -1;
		}

		controls.getObject().translateX(velocity.x * delta);
		controls.getObject().translateY(velocity.y * delta);
		controls.getObject().translateZ(velocity.z * delta);

		if (controls.getObject().position.y < 10) {

			velocity.y = 0;
			controls.getObject().position.y = 10;

			canJump = true;

		}

		if (!health) {
			document.getElementById("health").innerHTML = "HP Points: " + health;
			controlsEnabled = false;
			controls.enabled = false;
			blocker.style.display = 'block';
			deathscreen.style.display = '';
		}

		prevTime = time;
	}

	renderer.render(scene, camera);
}
