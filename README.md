# THREE.DrawCallInspector
This is a quick experimental attempt of a helper to monitor draw call costs. It could help spotting expensive draw calls caused by costly shaders and geometries.

# Update
It is now using the disjoint timer extension that is available for WebGL2 giving more precise results and being able to run non-blocking. For WebGL1 it falls back to the previous method. It now measure straight at the WebGL API draw call by proxying the function.

I'm going to extend this further soon with different analysis options, multiple inspector views etc.

![image](https://user-images.githubusercontent.com/28584767/157782016-8bad04da-d782-4213-a909-ebbca1b499a3.png)
![image](https://user-images.githubusercontent.com/28584767/157782042-0f13420f-6a99-40c0-bc48-0b9394667aa6.png)

_(Demo scene not included in the example, it's from sketchfab, when using locally any gltf scene can be placed in the directory, enable the demoScene bool in the index.html to load the model instead the primitives example)_

**Example**: https://codepen.io/Fyrestar/full/PoGXVZv

You see a sphere with a expensive shader, a high oply sphere in the middle and boxes, when going close you see the boxes become hotter even if the spheres are in view, as the boxes cover more pixels on the screen.

**The output**:

The output is a map that renders all objects tinted as a heatmap by how much time they took relative to each other. This means a average scene with equally expensive meshes in view is likely going to be mostly blueish, while if there is a more expensive objectt with an expensive shader it will be more red while the cheapest go towards solid blue.

**Usage**:

Create the inspector, **call mount** in order to attach the UI and add the hooks into THREE.

    const dci = new THREE.DrawCallInspector( renderer, scene, camera );
    dci.mount();

In your render loop right at the beginning call `dci.update()` for the overlay output. And at your scene draw call, call `dci.begin()` before and `dci.end()` after your scene is rendered to the screen or a render target.

    dci.update();

    dci.begin();
    renderer.render( scene, camera );
    dci.end();


Click on the overlay for a capture or enter a number of frames in the input, so it will automatically take a snapshot after that number of frames. 


**Parameters**:

* `renderer`
* `scene`
* `camera`
* `options`

**Options**
* `enabled (bool)`
A flag to disable the tool, it's wont create UI or do anything, to leave it in the code but enable it when required.
* `record (constant)`
Either THREE.DrawCallInspector.RecordDraw (default) or THREE.DrawCallInspector.RecordRange, RecordDraw will measure right before and right after the actual WebGL drawcall, while RecordRender will measure before and after renderBufferDirect.
* `wait (bool)`
For WebGL2, will wait till all timing queries finished before making the next so the timings of the same draw call are available.
* `enableMaterials (bool)`
You have the option to let the plugin extend your scenes original materials which are going to be extended, this is only useful for custom and special shaders where the transformation otherwise would make it not visible without. 

* `overlayStrength (float , 0-1)`
When `enableMaterials` is enabled, this is how much the heat coloring is mixed with it's original rendered color, default is 0.5.
* `skipFrames (number)`
For WebGL1 this should be set to manual (-1) to render by clicking on it, or a higher number as the blocking methods will cause a lagg when measuring, for WebGL2 the measurments can be done in realtime, however timings are fluctuating so it makes sense to use some delay before the next time queries are issued. 
* `scale (float , 0-1)`
The size of the overlay relative to the screen.
* `fade (float, 0+-1 )`
The results are lerped across captures to get closer to some average viewable result, with a value of 1 the measured delta time is instantly used for the next capture preview.
* `bias (float, 0+-1 )`
When the results are lerped and they were shorter they will decrease slower by this factor, if an object really doesn't take long it should be able to cool down then.

**Compatibility**:

This should work with all most recent 114+ revisions.
