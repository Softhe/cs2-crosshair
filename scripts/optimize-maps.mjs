import sharp from 'sharp';
import {readdir,stat} from 'node:fs/promises';
const directory=process.argv[2]??'.tools/extracted/panorama/images/crosshair';
for(const name of await readdir(directory)){
  if(!name.endsWith('.png'))continue;
  const source=`${directory}/${name}`,destination=`public/maps/${name.replace('xhair_','').replace('_png','').replace('.png','.webp')}`;
  await sharp(source).webp({quality:88}).toFile(destination);
  console.log(name,(await stat(source)).size,'=>',(await stat(destination)).size);
}
