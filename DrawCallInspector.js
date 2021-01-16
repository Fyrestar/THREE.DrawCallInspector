const DrawCallInspector = ( () => {

	// Author: Fyrestar https://mevedia.com (https://github.com/Fyrestar/THREE.DrawCallInspector)

	const tempScene = new THREE.Scene;
	const tempCamera = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
	const quad = new THREE.Mesh( new THREE.PlaneBufferGeometry( 2, 2 ), new THREE.MeshBasicMaterial );
	tempScene.add( quad );

	const v2 = new THREE.Vector2;
	const vp = new THREE.Vector4;
	const sc = new THREE.Vector4;

	function touch ( element, cb ) {


		element.addEventListener( 'click', cb );
		element.addEventListener( 'touchstart', cb );

	}

	function DrawCallInspector( renderer, scene, camera, useMaterials = false, skipFrames = -1, scale = 0.25, fade = 0.6 ) {

		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;
		this.stage = 0;
		this.calls = 0;
		this.maxDelta = 0;
		this.fade = fade;
		this.scale = scale;
		this.useMaterials = useMaterials;
		this.skipFrames = skipFrames;
		this.resolution = new THREE.Vector2;
		this.mounted = false;

	}

	DrawCallInspector.prototype = {

		frameIndex: 0,
		needsUpdate: false,
		needsRecord: false,

		mount: function ( element = document.body ) {

			const {
				skipFrames,
				useMaterials
			} = this;

			const self = this;
			const _gl = renderer.getContext();
			const max = Math.max;
			const measure = ( performance || Date );


			this.target = new THREE.WebGLRenderTarget( this.resolution.x, this.resolution.y, {
				format: THREE.RGBAFormat
			} );


			// Material management

			function patchMaterial( shader ) {

				shader.uniforms._uAge =  { value: null };
				shader.uniforms._uDelta = { value: null };
				shader.fragmentShader = 'uniform float _uDelta;\nuniform float _uAge;\n' + shader.fragmentShader;
				shader.fragmentShader = shader.fragmentShader.replace(  /\}(?=[^.]*$)/g, `
							gl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( 1.0 * ( 1.0 - _uAge ) , 0.0, _uAge ), max( _uDelta, _uAge ) );
							}
						`);

			}

			const resultMaterial = new THREE.MeshBasicMaterial({
				color: 0xffffff
			});
			resultMaterial.onBeforeCompile = patchMaterial;

			const MaterialIndex = ( () => {

				const index = {};
				const map = new WeakMap;

				return {

					map,

					push: function ( object, geometry, material ) {

						let viewMaterial = map.get( object );


						if ( viewMaterial && viewMaterial.userData.material !== material && viewMaterial.userData.geometry !== geometry )
							viewMaterial = null;

						if ( !viewMaterial ) {

							const id = geometry.uuid + '_' + material.uuid;

							if ( index[ id ] === undefined ) {

								const viewMaterial = material.clone();

								// To stay sync.

								if ( material.uniforms )
									viewMaterial.uniforms = material.uniforms;


								viewMaterial.onBeforeCompile = patchMaterial;
								viewMaterial.userData.material = material;
								viewMaterial.userData.geometry = geometry;

								index[ id ] = viewMaterial;

							} else {

								map.set( object, index[ id ] );
							}

						}

					}

				}

			})();


			// Uniforms ( per Mesh )

			let uniforms;

			const context = {
				material: null,
				geometry: null,
				group: null,
				set: function ( uniform, value ) {

					if ( uniform ) {

						uniform.setValue( _gl, value, renderer.textures );
						uniforms[ uniform.id ].value = value;

					}

				}
			};

			function updateUniforms( object, geometry, material, group ) {


				context.material = material;
				context.geometry = geometry;
				context.group = group;

				let shader, program, mat = renderer.properties.get( material );

				if ( !mat.program ) {

					const m = object.material;

					object.material = material;

					renderer.compile( object, tempCamera, object );

					object.material = m;

				}

				if ( mat.shader === undefined ) {
					shader = mat;
					program = mat.program;
				} else {
					shader = mat.shader;
					program = shader.program;
				}



				uniforms = shader.uniforms;

				_gl.useProgram( program.program );

				const map = shader.program.getUniforms().map;

				context.set( map._uDelta, object.userData.delta );
				context.set( map._uAge, object.userData.age );


				uniforms = null;


			}





			// Hack to get right before the draw call, renderBufferDirect is changed in different revisions but this should work across most.

			let currentObject;
			let deltaTime = 0;
			let enableMeasure = 0;

			const classes = [
				THREE.Mesh,
				THREE.SkinnedMesh,
				THREE.Line
			];

			if ( THREE.InstancedMesh )
				classes.push( THREE.InstancedMesh );

			for ( let cls of classes ) {

				cls.prototype._isMesh = cls.prototype.isMesh || false;

				Object.defineProperty( cls.prototype, 'isMesh', {

					get: function () {


						if ( enableMeasure ) {

							currentObject = this;

							_gl.finish();
							_gl.readPixels(0, 0, 1, 1, _gl.RGBA, _gl.UNSIGNED_BYTE, pixel);

							deltaTime = measure.now();

						}

						if ( enableMeasure === 1 )
							enableMeasure ++ ;

						return this._isMesh;

					},

					set: function ( value ) {

						this._isMesh = value;

					}

				});



			}

			const pixel = new Uint8Array(4);

			renderer.renderBufferDirect2 = renderer.renderBufferDirect;
			renderer.renderBufferDirect = function( camera, fog, geometry, material, object, group ) {

				if ( self.stage === 1 ) {

					// Try measure draw call

					enableMeasure = 1;

					renderer.renderBufferDirect2( camera, fog, geometry, material, object, group );

					enableMeasure = 0;

					_gl.finish();

					const doff = measure.now();

					// Might be varying and contribute ? If it's synchronous it should be measurable
					// Either way we won't get a usable time value, but a value for comparision to other calls

					_gl.readPixels( 0, 0, 1, 1, _gl.RGBA, _gl.UNSIGNED_BYTE, pixel );

					const now = measure.now();

					const delta = ( now - deltaTime ); // - ( doff - now );

					if ( object.userData.delta === undefined ) {

						object.userData.age = 0;
						object.userData.deltaTime = 0;
						object.userData.delta = 0;

					}


					// Extend original material for result

					if ( useMaterials )
						MaterialIndex.push( object, geometry, material );


					self.maxDelta = max( self.maxDelta, delta );

					object.userData.deltaTime = delta;



				} else if ( self.stage === 2 ) {

					// Rendering visualization

					if ( object.userData.delta !== undefined ) {

						object.userData.age *= .9;
						object.userData.delta += ( ( object.userData.deltaTime / self.maxDelta ) - object.userData.delta ) * self.fade;

						if ( useMaterials ) {

							const viewMaterial = MaterialIndex.map.get( object );

							if ( viewMaterial ) {


								updateUniforms( object, geometry, viewMaterial, group );

								renderer.renderBufferDirect2( camera, fog, geometry, viewMaterial, object, group );


							}

						} else {

							updateUniforms( object, geometry, resultMaterial, group );

							renderer.renderBufferDirect2( camera, fog, geometry, resultMaterial, object, group );

						}


					}

				} else {

					// Measurement disabled

					renderer.renderBufferDirect2( camera, fog, geometry, material, object, group );

				}

			};



			// UI

			const container = this.container = document.createElement( 'div' );
			container.innerHTML = `
			<input style="position: absolute; z-index: 2; right: 10px; top: 10px; opacity: 0.5; width: 5em;" type="number" min="-1" id="record" value="-1" />
			<div style="pointer-events: none; color: gray; display: flex; align-items: center; justify-content: center; position: absolute;left: 0;right: 0; top: 0; bottom: 0; font-size: 150%; font-family: Arial;">< Click to Capture > </div>
			<canvas style="position: relative; z-index: 1;"></canvas>
		`;

			this.domElement = container.children[ 2 ];
			this.ctx = this.domElement.getContext( '2d' );
			this.ctx.font = '20px Arial';
			this.ctx.fillStyle = '#ffffff';

			touch( this.domElement, function cb() {

				self.needsRecord = true;

			} );


			container.children[ 0 ].value = this.skipFrames;
			container.children[ 0 ].addEventListener( 'change', function() {

				self.skipFrames = parseInt( this.value );

			} );



			container.setAttribute( 'style', 'cursor: pointer; position: fixed; z-index: 99999; left: 1em; bottom: 1em; background: silver; border: 1px solid gray;');

			element.appendChild ( this.container );


			this.mounted = true;

		},

		begin: function () {

			if ( this.mounted ) {

				this.renderFrame = this.renderer.info.render.frame;


				if ( this.skipFrames > -1 )
					this.frameIndex ++ ;

				if ( this.needsRecord || ( this.frameIndex > this.skipFrames && this.skipFrames > -1 ) ) {

					this.renderer.getSize( v2 );

					if ( v2.x > 0 && v2.y > 0 ) {

						this.needsRecord = false;
						this.frameIndex = 0;
						this.maxDelta = 0;
						this.needsUpdate = true;


						v2.set( v2.x * this.scale, v2.y * this.scale ).floor();


						this.stage = 1;


						if ( v2.x !== this.resolution.x || v2.y !== this.resolution.y ) {

							this.resolution.copy( v2 );
							this.target.setSize( v2.x, v2.y );

							this.domElement.width = v2.x;
							this.domElement.height = v2.y;

						}


					}

				}


			}

		},

		end: function () {

			if ( this.stage ) {

				const {
					uniforms,
					renderer
				} = this;

				const rt = renderer.getRenderTarget();


				this.calls = this.renderer.info.render.calls;
				this.stage = 2;

				// Render visualization

				renderer.setRenderTarget( this.target );
				renderer.clear();
				renderer.render( this.scene, this.camera );


				renderer.setRenderTarget( rt );

				this.stage = 0;

			}

		},

		update: function() {

			if ( this.needsUpdate ) {

				this.needsUpdate = false;

				const {
					renderer,
					resolution,
					ctx
				} = this;


				const rt = renderer.getRenderTarget();

				renderer.getViewport( vp );
				renderer.getScissor( sc );
				renderer.getSize( v2 );

				vp.x = vp.x || 0;
				vp.y = vp.y || 0;
				vp.z = vp.z || v2.x;
				vp.w = vp.w || v2.y;

				sc.x = sc.x || 0;
				sc.y = sc.y || 0;
				sc.z = sc.z || v2.x;
				sc.w = sc.w || v2.y;

				renderer.setRenderTarget( null );
				renderer.clear();

				renderer.setViewport( 0, 0, resolution.x, resolution.y );
				renderer.setScissor( 0, 0, resolution.x, resolution.y );

				quad.material.map = this.target.texture;
				renderer.render( tempScene, tempCamera );

				ctx.clearRect( 0, 0, resolution.x, resolution.y );
				ctx.drawImage( renderer.domElement, 0, v2.y - resolution.y, resolution.x, resolution.y, 0, 0, resolution.x, resolution.y );

				ctx.font = '15px Arial';
				ctx.fillStyle = '#ffffff';
				ctx.strokeStyle = '#000000';
				ctx.strokeText( this.calls + ' calls', 10, 20 );
				ctx.fillText( this.calls + ' calls', 10, 20 );

				renderer.setViewport( vp );
				renderer.setScissor( sc );
				renderer.setRenderTarget( rt );

			}

		}

	};


	return DrawCallInspector;

})();