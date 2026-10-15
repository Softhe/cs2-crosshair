import {createApp} from './app.js';
const port=Number(process.env.PORT??4181);
createApp().listen(port,process.env.HOST??'127.0.0.1',()=>console.log(`Crosshair server listening on port ${port}.`));
