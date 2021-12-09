import CardModel from '@cardstack/core/src/card-model';
import type {
  CardJSONResponse,
  CompiledCard,
  Format,
  RawCard,
  Builder,
  CardOperation,
  CardId,
} from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/raw-card-deserializer';
import { fetchJSON } from './jsonapi-fetch';
import config from 'cardhost/config/environment';
import { Compiler, defineModules } from '@cardstack/core/src/compiler';
import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import dynamicCardTransform from './dynamic-card-transform';
import { encodeCardURL } from '@cardstack/core/src/utils';
import Cards from 'cardhost/services/cards';

export const LOCAL_REALM = 'https://cardstack.local';
export const DEMO_REALM = 'https://demo.com';

const { cardServer } = config as any; // Environment types arent working

type RegisteredLocalModule = {
  state: 'registered';
  dependencyList: string[];
  implementation: Function;
};

type LocalModule =
  | RegisteredLocalModule
  | {
      state: 'preparing';
      implementation: Function;
      moduleInstance: object;
    }
  | {
      state: 'evaluated';
      moduleInstance: object;
    }
  | {
      state: 'broken';
      exception: any;
    };

// this might want to get renamed to something more generic like "Editor" or
// "Creator" because it encompasses all API for manipulating cards at the source
// code level, whether or not you're storing them in an in-browser local realm.
export default class LocalRealm implements Builder {
  // these are the canonical sources for cards stored in our local realm, key is card id
  private rawCards = new Map<string, RawCard>();

  // cache of raw cards that we loaded from the server (because we needed them
  // as dependencies)
  private remoteRawCards = new Map<string, RawCard>();

  private compiledCardCache = new Map<string, CompiledCard>();
  private compiler: Compiler;
  private localModules = new Map<string, LocalModule>();
  private deserializer = new RawCardDeserializer();

  constructor(private ownRealmURL: string, private cards: Cards) {
    this.compiler = new Compiler({
      builder: this,
    });
  }

  async load(url: string, format: Format): Promise<CardJSONResponse> {
    let compiled = await this.getCompiledCard(url);
    let raw = await this.getRawCard(url);

    // TODO: reduce data shape for the given format like we do on the server
    return {
      data: {
        type: 'card',
        id: url,
        attributes: raw.data,
        meta: {
          componentModule: compiled[format].moduleName,
        },
      },
    };
  }

  async loadForRoute(
    routeCardURL: string,
    pathname: string
  ): Promise<CardModel> {
    let routeCard = await this.getCompiledCard(routeCardURL);
    let routeCardClass = (
      await this.cards.loadModule<any>(routeCard.schemaModule)
    ).default;
    let routableCardURL = new routeCardClass().routeTo(pathname);
    if (!routableCardURL) {
      throw new Error(`Could not find routable card: ${routableCardURL}`);
    }
    return await this.cards.load(routableCardURL, 'isolated');
  }

  async createRawCard(rawCard: RawCard): Promise<void> {
    if (this.inOwnRealm(rawCard)) {
      this.rawCards.set(rawCard.id, rawCard);
    } else {
      throw new Error('unimplemented');
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    let cardId = this.parseOwnRealmURL(url);
    if (cardId) {
      let card = this.rawCards.get(cardId.id);
      if (!card) {
        throw new Error(`${url} not found in local realm`);
      }
      return card;
    } else {
      let cached = this.remoteRawCards.get(url);
      if (cached) {
        return cached;
      } else {
        let response = await fetchJSON<any>(
          [cardServer, 'sources/', encodeURIComponent(url)].join('')
        );

        let raw = this.deserializer.deserialize(response.data, response).raw;
        this.remoteRawCards.set(url, raw);
        return raw;
      }
    }
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let cached = this.compiledCardCache.get(url);
    if (cached) {
      return cached;
    }

    let cardId = this.parseOwnRealmURL(url);
    if (cardId) {
      let rawCard = await this.getRawCard(url);
      let compiledCard = await this.compiler.compile(rawCard);
      defineModules(compiledCard, (local, type, src) =>
        this.define(url, local, type, src)
      );
      this.compiledCardCache.set(url, compiledCard);
      return compiledCard;
    } else {
      let response = await fetchJSON<any>(
        [
          cardServer,
          'sources/',
          encodeURIComponent(url),
          '?include=compiledMeta',
        ].join('')
      );

      let { compiled, raw } = this.deserializer.deserialize(
        response.data,
        response
      );
      if (!compiled) {
        throw new Error(`expected to find compiled meta alongside raw card`);
      }
      this.remoteRawCards.set(url, raw);
      return compiled;
    }
  }

  generateId(): string {
    let id;
    while (!id) {
      let possibleId = String(Math.floor(Math.random() * 10000));
      if (!this.rawCards.has(possibleId)) {
        id = possibleId;
      }
    }
    return id;
  }

  async send(op: CardOperation): Promise<CardJSONResponse> {
    if ('create' in op) {
      let data = op.create.payload.data.attributes;

      let id = this.generateId();

      this.createRawCard({
        realm: this.ownRealmURL,
        id,
        data,
        adoptsFrom: op.create.parentCardURL,
      });

      return this.load(id, 'isolated');
    } else if ('update' in op) {
      let { cardURL: url } = op.update;
      let cardId = this.parseOwnRealmURL(url);
      if (!cardId) {
        throw new Error(`${url} is not in this realm`);
      }
      let data = op.update.payload.data.attributes;
      let existingRawCard = this.rawCards.get(cardId.id);
      if (!existingRawCard) {
        throw new Error(
          `Tried to update a local card that doesn't exist: ${url}`
        );
      }

      existingRawCard.data = data;
      return this.load(url, 'isolated');
    } else {
      throw assertNever(op);
    }
  }

  private inOwnRealm(card: RawCard): boolean {
    return card.realm === this.ownRealmURL;
  }

  private parseOwnRealmURL(url: string): CardId | undefined {
    if (url.startsWith(this.ownRealmURL)) {
      return {
        realm: this.ownRealmURL,
        id: url.slice(this.ownRealmURL.length),
      };
    }
    return undefined;
  }

  private async evaluateModule<T extends object>(
    moduleIdentifier: string,
    module: RegisteredLocalModule
  ): Promise<T> {
    let moduleInstance = Object.create(null);
    this.localModules.set(moduleIdentifier, {
      state: 'preparing',
      implementation: module.implementation,
      moduleInstance,
    });
    try {
      let dependencies = await Promise.all(
        module.dependencyList.map((dependencyIdentifier) => {
          if (dependencyIdentifier === 'exports') {
            return moduleInstance;
          } else {
            let absIdentifier = resolveModuleIdentifier(
              dependencyIdentifier,
              moduleIdentifier
            );
            return this.cards.loadModule(absIdentifier);
          }
        })
      );
      module.implementation(...dependencies);
      this.localModules.set(moduleIdentifier, {
        state: 'evaluated',
        moduleInstance,
      });
      return moduleInstance;
    } catch (exception) {
      this.localModules.set(moduleIdentifier, {
        state: 'broken',
        exception,
      });
      throw exception;
    }
  }

  async loadModule<T extends object>(moduleIdentifier: string): Promise<T> {
    let module = this.localModules.get(moduleIdentifier);
    if (!module) {
      throw new Error(`missing local module ${moduleIdentifier}`);
    }
    switch (module.state) {
      case 'preparing':
      case 'evaluated':
        return module.moduleInstance as T;
      case 'broken':
        throw module.exception;
      case 'registered':
        return await this.evaluateModule(moduleIdentifier, module);
      default:
        throw assertNever(module);
    }
  }

  private define(
    cardURL: string,
    localModule: string,
    type: string,
    source: string
  ): string {
    let moduleIdentifier = `@cardstack/local-realm-compiled/${encodeCardURL(
      cardURL
    )}/${localModule}`;

    // this local is here for the evals to see
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let define = this.registerModule.bind(this);

    switch (type) {
      case JS_TYPE: {
        eval(dynamicCardTransform(moduleIdentifier, source));
        return moduleIdentifier;
      }
      case CSS_TYPE:
        eval(`
          define('${moduleIdentifier}', [], function(){
            const style = document.createElement('style');
            style.innerHTML = \`${source}\`;
            style.setAttribute('data-asset-url', '${moduleIdentifier}');
            document.head.appendChild(style);
          })
        `);
        return moduleIdentifier;
      default:
        return moduleIdentifier;
    }
  }

  private registerModule(
    moduleIdentifier: string,
    dependencyList: string[],
    implementation: Function
  ): void {
    this.localModules.set(moduleIdentifier, {
      state: 'registered',
      dependencyList,
      implementation,
    });
  }
}

function resolveModuleIdentifier(
  moduleIdentifier: string,
  requester: string
): string {
  if (!moduleIdentifier.startsWith('.')) {
    return moduleIdentifier;
  }
  return new URL(
    moduleIdentifier,
    'http://imaginary-origin/' + requester
  ).pathname.slice(1);
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}
