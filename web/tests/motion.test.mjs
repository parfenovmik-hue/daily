import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slideViewportBounds} from '../public/motion.js';
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
test('Page motion stops above mobile bottom navigation',()=>{
 assert.deepEqual(slideViewportBounds(rect(0,220,440,1000),rect(0,880,440,76),956),{bottom:880,clipLeft:0});
});
test('Desktop sidebar does not collapse the transition and stays outside its painted area',()=>{
 const sidebar=rect(100,32,180,380);
 assert.deepEqual(slideViewportBounds(rect(100,0,1240,1000),sidebar,1000),{bottom:1000,clipLeft:180});
 assert.deepEqual(slideViewportBounds(rect(300,190,1040,700),sidebar,1000),{bottom:1000,clipLeft:0});
});
test('Viewport bounds cover missing navigation and short desktop windows',()=>{
 assert.deepEqual(slideViewportBounds(rect(0,100,440,400),null,568),{bottom:568,clipLeft:0});
 assert.deepEqual(slideViewportBounds(rect(0,0,1100,350),rect(24,32,180,302),350),{bottom:350,clipLeft:204});
});
