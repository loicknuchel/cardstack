/* eslint-disable no-undef */
const FastBootAppServer = require('fastboot-app-server');
const fetch = require('node-fetch');
const Sentry = require('@sentry/node');

function healthCheckMiddleware(req, res, next) {
  let userAgent = req.get('user-agent') || '';
  let isHealthCheck = userAgent.includes('ELB-HealthChecker');

  if (isHealthCheck) {
    res.status(200).send('fastboot server is up and running');
  } else {
    next();
  }
}

Sentry.init({
  dsn: process.env.SSR_WEB_SERVER_SENTRY_DSN,
  environment: process.env.SSR_WEB_ENVIRONMENT ?? 'development',
  tracesSampleRate: 1.0,
});

let server = new FastBootAppServer({
  log: false,
  distPath: 'dist',
  gzip: true, // Optional - Enables gzip compression.
  host: '0.0.0.0', // Optional - Sets the host the server listens on.
  port: 4000, // Optional - Sets the port the server listens on (defaults to the PORT env var or 3000).
  buildSandboxGlobals(defaultGlobals) {
    // Optional - Make values available to the Ember app running in the FastBoot server, e.g. "MY_GLOBAL" will be available as "GLOBAL_VALUE"
    return Object.assign({}, defaultGlobals, {
      btoa: function (str) {
        return Buffer.from(str).toString('base64');
      },
      fetch,
      URLSearchParams,
      NodeSentry: Sentry,
    });
  },
  // This should be false for Twitter/Linkedin according to https://github.com/ember-fastboot/ember-cli-fastboot/tree/master/packages/fastboot-app-server#twitter-and-linkedin
  chunkedResponse: false, // Optional - Opt-in to chunked transfer encoding, transferring the head, body and potential shoeboxes in separate chunks. Chunked transfer encoding should have a positive effect in particular when the app transfers a lot of data in the shoebox.

  beforeMiddleware: function (app) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(healthCheckMiddleware);

    let ignoreUrlPattern = /^\/(assets\/|images\/).*(\..*)/;

    let logger = function (req, res, next) {
      if (!ignoreUrlPattern.test(req.url)) {
        let fullUrl = req.get('host') + req.originalUrl;

        console.log(
          `${new Date().toISOString()}: ${req.method} ${fullUrl} ${
            res.statusCode
          }`
        );
      }
      next();
    };

    // TODO: reconsider how we're using this logger.
    // Afaik we can't tell if the response status code is correct at the point of logging
    // eg. visiting wallet.cardstack.com/does-not-exist produces
    // 2022-08-01T06:47:23.085Z 0RQ2XN: 2022-08-01T06:47:23.085Z: GET wallet.cardstack.com/does-not-exist 200
    // which is misleading. We should remove the status code
    // Also worth noting that afterMiddleware might not run
    app.use(logger);
  },

  // TODO: Seems good to confirm + note that afterMiddleware will not run
  // if fastboot's middleware is successful in getting a response from the ember app
  // This means that we only see afterMiddleware running if there is an uncaught error
  afterMiddleware: function (app) {
    app.use(Sentry.Handlers.errorHandler());
  },
});

server.start();
