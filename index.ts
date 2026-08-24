import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeApplication } from './dynamicForms/index';
import type { AppConfig } from './dynamicForms/types';

dotenv.config();

const appConfig: AppConfig = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'appConfig.json'), 'utf-8')
);

const app = express();
app.use(bodyParser.json());
app.use(cors());

initializeApplication(app, appConfig);


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
