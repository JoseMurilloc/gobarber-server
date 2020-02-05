import 'dotenv/config';

import express from 'express';
import { resolve } from 'path';
import * as Sentry from '@sentry/node';
import Youch from 'youch';
import 'express-async-errors';
import sentryConfig from './config/sentry';

import routes from './routes';

import './database';

class App {
  constructor() {
    this.server = express();

    Sentry.init(sentryConfig);

    this.middlewares();
    this.routes();
    this.expitionHandle();
  }

  middlewares() {
    this.server.use(Sentry.Handlers.requestHandler());
    this.server.use(express.json());
    this.server.use(
      `/files`,
      express.static(resolve(__dirname, '..', 'tmp', 'uploads'))
    );
  }

  routes() {
    this.server.use(routes);
    this.server.use(Sentry.Handlers.errorHandler());
  }

  expitionHandle() {
    this.server.use(async (err, req, res, next) => {
      if (['development', 'test'].includes(process.env.NODE_ENV)) {
        const errors = await new Youch(err, req).toJSON();

        console.error(err);

        return res.status(500).json(errors);
      }

      return res.status(500).json({ error: 'Internal server error' });

    });
  }
}

export default new App().server;
