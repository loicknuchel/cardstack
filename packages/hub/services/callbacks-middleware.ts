import Router from '@koa/router';
import { RouterContext } from '@koa/router';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import { Memoize } from 'typescript-memoize';
import { CardstackError } from '../utils/error';
import { SessionContext } from './authentication-middleware';
import { inject } from '../di/dependency-injection';
import WyreCallbackRoute from '../routes/wyre-callback';

const ROUTE_PREFIX = '/callbacks';
const routePrefixPattern = new RegExp(`^${ROUTE_PREFIX}/(.*)`);

export default class CallbacksMiddleWare {
  wyreCallbackRoute: WyreCallbackRoute = inject('wyre-callback-route', { as: 'wyreCallbackRoute' });
  middleware() {
    return (ctxt: RouterContext<SessionContext, Record<string, unknown>>, next: Koa.Next) => {
      let m = routePrefixPattern.exec(ctxt.request.path);
      if (!m) {
        return next();
      }
      ctxt.request.path = `/${m[1]}`;

      if (this.isJSON(ctxt)) {
        return this.jsonHandlers(ctxt, next);
      } else {
        throw new CardstackError(`Only "application/json" requests are supported at this endpoint`);
      }
    };
  }

  @Memoize()
  get jsonHandlers() {
    let { wyreCallbackRoute } = this;
    let router = new Router();
    router.post('/wyre', wyreCallbackRoute.post);
    router.all('/(.*)', notFound);
    return router.routes();
  }

  isJSON(ctxt: RouterContext<SessionContext, Record<string, unknown>>) {
    let contentType = ctxt.request.headers['content-type'];
    let isJson = contentType && contentType.includes('application/json');
    let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
    let types = acceptedTypes.split(',');
    let acceptsJson = types.some((t) => mimeMatch(t, 'application/json'));
    return isJson || acceptsJson;
  }
}

function notFound(ctx: Koa.Context) {
  ctx.status = 404;
}
declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'callbacks-middleware': CallbacksMiddleWare;
  }
}
