import { generateMerchantPaymentUrl, spendToUsd } from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { usdToSpend } from '@cardstack/cardpay-sdk';
import { inject as service } from '@ember/service';
import IsIOS from '../services/is-ios';
import { useResource } from 'ember-resources';
import { MerchantInfo } from '../resources/merchant-info';
import config from '@cardstack/web-client/config/environment';

export default class CardPayMerchantServicesController extends Controller {
  @service('is-ios') declare isIOSService: IsIOS;
  queryParams = ['amount', 'currency'];
  @tracked amount: number = 0;
  @tracked currency: string = 'SPD';
  merchantInfo = useResource(this, MerchantInfo, () => ({
    infoDID: this.model.merchantSafe.infoDID,
  }));

  get canDeepLink() {
    return this.isIOSService.isIOS();
  }
  get displayedAmounts() {
    // TODO: add rounding based on currency decimal limits
    if (!this.isValidAmount) {
      return {
        SPD: null,
        USD: null,
      };
    } else if (this.currency === 'SPD') {
      return {
        SPD: this.amount,
        USD: spendToUsd(this.amount),
      };
    } else if (this.currency === 'USD') {
      return {
        SPD: usdToSpend(this.amount),
        USD: this.amount,
      };
    } else {
      return {
        SPD: null,
        USD: null,
      };
    }
  }
  get isValidAmount() {
    return !isNaN(this.amount) && this.amount > 0;
  }

  // This is necessary because iOS respects users' decisions to visit your site
  // and will stay on the site if the link has the same domain
  // see https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html
  // also might be useful for folks on older versions of iOS (~9)
  get deepLinkPaymentURL() {
    return generateMerchantPaymentUrl({
      network: this.model.network,
      merchantSafeID: this.model.merchantSafe.address,
      currency: this.currency,
      amount: this.isValidAmount ? this.amount : 0,
    });
  }

  get paymentURL() {
    return generateMerchantPaymentUrl({
      domain: config.universalLinkDomain,
      network: this.model.network,
      merchantSafeID: this.model.merchantSafe.address,
      currency: this.currency,
      amount: this.isValidAmount ? this.amount : 0,
    });
  }
}
