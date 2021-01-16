# THREE.DrawCallInspector
This is a quick experimental attempt of a helper to monitor draw call costs. It could help spotting expensive draw calls caused by costly shaders. This is just experimental for now. I had some test runs it took some time till the expensive started to outweigh. A sort of hack is used in order to do measurements and to get as close as possible to the actual draw call without core modifications.

![dci](/vis4.png)

**Example**: https://codepen.io/Fyrestar/full/PoGXVZv

**The output**:

The output is a map that renders all objects tinted with red weight by how much time they took relatively to each other. This means a average scene with equally expensive meshes in view is likely going to be mostly fully red, while if there is a more expensive objectt with an expensive shader it will be more red while the others fade towards white.

**Important**:

There is no way to get some exact timings of a draw call, but comparing all timing weighted by the longest seems to give a reasonable result. When a render call is measured after and before every render call it is tried to wait for it being finished, the more draw calls you have the slower this process will be - in a large scene this can take several seconds. Everything is pretty driver dependent, possibly browser as well so for now i can't tell if this will work reliable in every condition.

By default i recommend not using the original materials unless they are required for special vertex transformations, that means skinned meshes or similar won't be animated in the output redscale which is not relevant anyway but enough to see what is causing cost.

**Usage**:

Create the inspector, **call mount** in order to attach the UI and add the hooks into THREE, if you don't want to add/remove the code all time you want to inspect just only call mount when needed, such as commenting the line out or when a query parameter is given.

    const dci = new THREE.DrawCallInspector( renderer, scene, camera );
    dci.mount();

In you render loop right at the beginning call `dci.update()` for the overlay output. And at your scene draw call, call `dci.begin()` before and `dci.end()` after your scene is rendered to the screen or a render target.

    dci.update();

    dci.begin();
    renderer.render( scene, camera );
    dci.end();


Click on the overlay for a capture or enter a number of frames in the input, so it will automatically take a snapshot after that number of frames. 


**Parameters**:

* `renderer`
* `scene`
* `camera`
* `useMaterials (true/false)`
You have the option to let the plugin extend your scenes original materials which are going to be extended, this is only useful for custom and special shaders where the transformation otherwise would make it not visible without. 
* `skipFrames (number)`
As mentioned measuring can take quite long the more draw calls you have, it is unlikely you will get a realtime preview so by default (-1) you have to click/touch the overlay to take a snapshot.
* `scale (float , 0-1)`
The size of the overlay relative to the screen.
* `fade (float, 0+-1 )`
The results are lerped across captures to get closer to some average result, with a value of 1 the measured delta time is instantly used for the next capture preview.


**Compatibility**:

This should work with all most recent 100+ revisions.
