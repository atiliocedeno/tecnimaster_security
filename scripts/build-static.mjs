import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const file of ['index.html','mision-vision.html','confirmacion.html','robots.txt','sitemap.xml','assets'])await cp(file,`dist/${file}`,{recursive:true});
