import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import isEmail from 'validator/lib/isEmail';
import crypto from 'crypto';

export interface EmailCardDropRequest {
  id: string;
  ownerAddress: string;
  emailHash: string;
  verificationCode: string;
  claimedAt?: Date;
  requestedAt: Date;
  transactionHash?: string;
}

export default class EmailCardDropRequestsRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });
  clock = inject('clock');

  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let timestamp = new Date(this.clock.now());
    let ownerAddress = ctx.request.query['eoa'] as string;

    if (!ownerAddress) {
      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            code: '400',
            title: 'Missing required parameter: eoa',
            detail: 'Please provide an ethereum address via the eoa query parameter',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let previousRequests = await this.emailCardDropRequestQueries.query({
      ownerAddress,
    });

    let claimed = Boolean(previousRequests[0]?.transactionHash);

    let result = this.emailCardDropRequestSerializer.serializeEmailCardDropRequestStatus({
      timestamp,
      ownerAddress,
      claimed,
    });

    ctx.status = 200;
    ctx.body = result;
    ctx.type = 'application/vnd.api+json';
    return;
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let email = ctx.request.body.data.attributes.email;

    let hash = crypto.createHash('sha256');
    hash.update(email);
    let emailHash = hash.digest('hex');

    let verificationCode = (crypto.randomInt(1000000) + '').padStart(6, '0');

    if (isEmail(email)) {
      const emailCardDropRequest: EmailCardDropRequest = {
        id: shortUuid.uuid(),
        ownerAddress: ctx.state.userAddress,
        emailHash,
        verificationCode,
        requestedAt: new Date(this.clock.now()),
      };

      let db = await this.databaseManager.getClient();

      await this.databaseManager.performTransaction(db, async () => {
        await this.emailCardDropRequestQueries.insert(emailCardDropRequest);
      });

      await this.workerClient.addJob('send-email-card-drop-verification', {
        id: emailCardDropRequest.id,
        email,
      });

      await this.workerClient.addJob('subscribe-email', {
        id: emailCardDropRequest.id,
        email,
      });

      let serialized = this.emailCardDropRequestSerializer.serialize(emailCardDropRequest);

      ctx.status = 201;
      ctx.body = serialized;
    } else {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            detail: 'Email address is not valid',
            source: { pointer: '/data/attributes/email' },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      };
    }

    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'email-card-drop-requests-route': EmailCardDropRequestsRoute;
  }
}
