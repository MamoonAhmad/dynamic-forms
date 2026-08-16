import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApplication } from './dynamicForms/index.js';
import appConfig from "./appconfig.json" with { type: 'json' };

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

initializeApplication(app, appConfig);


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});