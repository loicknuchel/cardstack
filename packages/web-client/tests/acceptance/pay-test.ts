import { module, test } from 'qunit';
import { visit, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import sinon from 'sinon';

import { MirageTestContext } from 'ember-cli-mirage/test-support';
import {
  formatUsd,
  generateMerchantPaymentUrl,
  MerchantSafe,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import config from '@cardstack/web-client/config/environment';

// selectors
const MERCHANT = '[data-test-merchant]';
const MERCHANT_INFO_ADDRESS_ONLY =
  '[data-test-payment-request-merchant-address]';
const MERCHANT_INFO_MISSING_MESSAGE =
  '[data-test-payment-request-merchant-info-missing]';
const MERCHANT_MISSING_MESSAGE = '[data-test-merchant-missing]';
const MERCHANT_LOGO = '[data-test-merchant-logo]';
const AMOUNT = '[data-test-payment-request-amount]';
const USD_AMOUNT = '[data-test-payment-request-usd-amount]';
const QR_CODE = '[data-test-styled-qr-code]';
const DEEP_LINK = '[data-test-payment-request-deep-link]';
const PAYMENT_URL = '[data-test-payment-request-url]';

// fixed data
const universalLinkDomain = config.universalLinkDomain;
const exampleDid = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';
const spendSymbol = 'SPD';
const usdSymbol = 'USD';
const invalidCurrencySymbol = 'WUT';
const network = 'sokol';
const merchantName = 'Mandello';
const merchantInfoBackground = '#00ffcc';
const merchantInfoTextColor = '#000000';
const nonexistentMerchantId = 'nonexistentmerchant';
const merchantSafe: MerchantSafe = {
  type: 'merchant',
  createdAt: Date.now() / 1000,
  address: '0xE73604fC1724a50CEcBC1096d4229b81aF117c94',
  owners: ['0xAE061aa45950Bf5b0B05458C3b7eE474C25B36a7'],
  infoDID: exampleDid,
} as MerchantSafe;
const merchantSafeWithoutInfo: MerchantSafe = {
  type: 'merchant',
  createdAt: Date.now() / 1000,
  address: '0xE73604fC1724a50CEcBC1096d4229b81aF117c85',
  owners: ['0xAE061aa45950Bf5b0B05458C3b7eE474C25B36a7'],
  infoDID: undefined,
} as MerchantSafe;
const spendAmount = 300;
const usdAmount = spendToUsd(spendAmount);

module('Acceptance | pay', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(async function (this: MirageTestContext) {
    let safeViewer = this.owner.lookup('service:safe-viewer');
    sinon
      .stub(safeViewer, 'view')
      .callsFake(async function (_network: string, address: string) {
        if (address === merchantSafe.address) return merchantSafe;
        else if (address === merchantSafeWithoutInfo.address)
          return merchantSafeWithoutInfo;
        else return undefined;
      });

    let resolver = new Resolver({ ...getResolver() });
    let resolvedDID = await resolver.resolve(exampleDid);
    let didAlsoKnownAs = resolvedDID?.didDocument?.alsoKnownAs![0]!;
    let customizationJsonFilename = didAlsoKnownAs.split('/')[4].split('.')[0];

    this.server.create('merchant-info', {
      id: customizationJsonFilename,
      name: merchantName,
      slug: 'mandello1',
      did: exampleDid,
      color: merchantInfoBackground,
      'text-color': merchantInfoTextColor,
      'owner-address': '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44',
    });
  });

  test('it renders correctly with SPD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}&currency=${spendSymbol}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with no currency provided', async function (assert) {
    // this is basically defaulting to SPEND
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);
    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly with USD as currency', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${usdAmount}&currency=${usdSymbol}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);
    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: usdSymbol,
      amount: usdAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if currency is unrecognised', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=300&currency=${invalidCurrencySymbol}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(USD_AMOUNT).doesNotExist();

    // we just pass this currency to the wallet to handle without
    // displaying the amounts if we don't recognize the currency
    // currently this is anything that is not SPD or USD
    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: invalidCurrencySymbol,
      amount: 300,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders correctly if amount is malformed', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=30a&currency=${spendSymbol}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).doesNotExist();
    assert.dom(USD_AMOUNT).doesNotExist();

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafe.address,
      currency: spendSymbol,
      amount: 0,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders the clickable link by default when in an iOS browser', async function (assert) {
    let isIOSService = this.owner.lookup('service:is-ios');
    sinon.stub(isIOSService, 'isIOS').returns(true);

    await visit(
      `/pay/${network}/${merchantSafe.address}?amount=${spendAmount}&currrency=${spendSymbol}`
    );
    await waitFor(MERCHANT);

    assert.dom(MERCHANT).hasAttribute('data-test-merchant', merchantName);
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-background',
        merchantInfoBackground
      );
    assert
      .dom(MERCHANT_LOGO)
      .hasAttribute(
        'data-test-merchant-logo-text-color',
        merchantInfoTextColor
      );

    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);

    // assert that the deep link view is rendered
    assert.dom(QR_CODE).doesNotExist();
    assert
      .dom(DEEP_LINK)
      .containsText('Pay Merchant')
      .hasAttribute(
        'href',
        generateMerchantPaymentUrl({
          network,
          merchantSafeID: merchantSafe.address,
          currency: spendSymbol,
          amount: spendAmount,
        })
      );
    assert.dom(PAYMENT_URL).containsText(
      generateMerchantPaymentUrl({
        domain: universalLinkDomain,
        network,
        merchantSafeID: merchantSafe.address,
        currency: spendSymbol,
        amount: spendAmount,
      })
    );
  });

  test('it renders appropriate UI when merchant info is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${merchantSafeWithoutInfo.address}?amount=${spendAmount}&currency=${spendSymbol}`
    );
    await waitFor(MERCHANT_INFO_ADDRESS_ONLY);

    assert.dom(MERCHANT).doesNotExist();
    assert
      .dom(MERCHANT_INFO_ADDRESS_ONLY)
      .containsText(merchantSafeWithoutInfo.address);
    assert
      .dom(MERCHANT_INFO_MISSING_MESSAGE)
      .containsText(
        'Unable to find merchant details for this address. Use caution when paying.'
      );
    assert.dom(AMOUNT).containsText(`§${spendAmount}`);
    assert
      .dom(USD_AMOUNT)
      .containsText(`${formatUsd(spendToUsd(spendAmount)!)}`);

    let expectedUrl = generateMerchantPaymentUrl({
      domain: universalLinkDomain,
      network,
      merchantSafeID: merchantSafeWithoutInfo.address,
      currency: spendSymbol,
      amount: spendAmount,
    });
    assert.dom(QR_CODE).hasAttribute('data-test-styled-qr-code', expectedUrl);
    assert.dom(PAYMENT_URL).containsText(expectedUrl);
  });

  test('it renders appropriate UI when merchant safe is not fetched', async function (assert) {
    await visit(
      `/pay/${network}/${nonexistentMerchantId}?amount=${spendAmount}&currency=${spendSymbol}`
    );

    await waitFor(MERCHANT_MISSING_MESSAGE);

    assert
      .dom(MERCHANT_MISSING_MESSAGE)
      .containsText(
        'Oops, no Merchant found - please ask the merchant to confirm the payment link'
      );
  });

  test('it renders appropriate UI when URL is not complete', async function (assert) {
    await visit(`/pay/sok`);

    await waitFor(MERCHANT_MISSING_MESSAGE);

    assert
      .dom(MERCHANT_MISSING_MESSAGE)
      .containsText(
        'Oops, no Merchant found - please ask the merchant to confirm the payment link'
      );
  });
});
