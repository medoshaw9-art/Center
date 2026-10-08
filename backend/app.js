import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './config/database.js';
import apiRouter from './routes/index.js';

const app=express();
const directory=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({limit:'3mb'}));
app.use(apiRouter);

const builtClient=path.resolve(directory,'../frontend/dist');
if(fs.existsSync(builtClient)){
 app.use(express.static(builtClient));
 app.get('/{*path}',(request,response,next)=>{
  if(request.path.startsWith('/api/'))return next();
  response.sendFile(path.join(builtClient,'index.html'));
 });
}

app.use((error, request, response, next) => {
  console.error(error);
  if (response.headersSent) return next(error);
  const payload = { error: "حدث خطأ غير متوقع" };
  if (process.env.NODE_ENV !== "production") payload.details = error.message;
  response.status(500).json(payload);
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () =>
  console.log(`Center API listening on http://localhost:${port}`),
);
