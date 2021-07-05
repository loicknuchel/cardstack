import { module, test } from 'qunit';
import {
  click,
  currentURL,
  visit,
  waitFor,
  waitUntil,
  fillIn,
  settled,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toBN } from 'web3-utils';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import { encodeDID } from '@cardstack/did-resolver';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { timeout } from 'ember-concurrency';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

module('Acceptance | issue prepaid card', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // TODO: fix typescript for mirage
    (this as any).server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/balances');
    await click('[data-test-workflow-button="issue-prepaid-card"]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, it’s nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('Let’s issue a prepaid card.');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'Before we get started, please connect your xDai chain wallet via your Card Wallet mobile app.'
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(0, 4)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('250000000000000000000'),
      card: toBN('500000000000000000000'),
    });
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    let testDepot = {
      address: depotAddress,
      tokens: [
        {
          balance: '250000000000000000000',
          token: {
            symbol: 'DAI',
          },
        },
        {
          balance: '500000000000000000000',
          token: {
            symbol: 'CARD',
          },
        },
      ],
    };
    layer2Service.test__simulateDepot(testDepot as DepotSafe);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    // await waitFor(`${postableSel(0, 4)} [data-test-depot-balance]`);
    // assert
    //   .dom(`${postableSel(0, 4)} [data-test-depot-balance]`)
    //   .containsText('2500 DAI.CPXD');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('xDai chain wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText('First, you can choose the look and feel of your card');

    post = postableSel(1, 1);

    assert.dom('[data-test-layout-customization-form]').isVisible();
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'A');

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    await fillIn('[data-test-layout-customization-name-input]', '');
    assert
      .dom(`${post} [data-test-boxel-input-error-message]`)
      .containsText('required');
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'JJ');
    assert.dom(`${post} [data-test-boxel-input-error-message]`).doesNotExist();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    let backgroundChoice = prepaidCardColorSchemes[1].background;
    let patternChoice = prepaidCardPatterns[3].patternUrl;

    await waitUntil(
      () =>
        document.querySelectorAll(
          '[data-test-customization-background-loading],[data-test-customization-theme-loading]'
        ).length === 0
    );

    assert
      .dom(
        `${post}  [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .doesNotExist();

    await click(
      `${post}  [data-test-customization-background-selection-item="${backgroundChoice}"]`
    );
    await click(
      `${post} [data-test-customization-pattern-selection-item="${patternChoice}"]`
    );

    assert
      .dom(
        `${post} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .exists();

    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom(`${post} [data-test-layout-customization-form]`).isNotVisible();
    assert.dom(`${post} [data-test-layout-customization-display]`).isVisible();

    assert
      .dom(
        `${post} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
      )
      .exists();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .containsText('Edit')
      .isEnabled();

    await settled();

    assert.dom(milestoneCompletedSel(1)).containsText('Layout customized');

    assert.dom(postableSel(2, 0)).containsText('Nice choice!');
    assert
      .dom(postableSel(2, 1))
      .containsText('How do you want to fund your prepaid card?');

    post = postableSel(2, 2);
    // // funding-source card
    assert
      .dom('[data-test-funding-source-account] [data-test-account-address]')
      .hasText('0x1826...6E44');
    assert
      .dom('[data-test-funding-source-depot-outer] [data-test-account-address]')
      .hasText(depotAddress);
    assert
      .dom('[data-test-funding-source-dropdown="DAI.CPXD"]')
      .containsText('250.00 DAI');
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    assert.dom('[data-test-funding-source-dropdown="DAI.CPXD"]').doesNotExist();
    assert.dom('[data-test-funding-source-token]').containsText('250.00 DAI');

    assert
      .dom(postableSel(2, 3))
      .containsText('choose the face value of your prepaid card');
    // // face-value card
    assert.dom('[data-test-balance-view-summary]').containsText('250.00 DAI');
    await click('[data-test-balance-view-summary]');
    assert
      .dom('[data-test-balance-view-account-address]')
      .containsText(layer2AccountAddress);
    assert
      .dom('[data-test-balance-view-depot-address]')
      .containsText(depotAddress);
    assert
      .dom('[data-test-balance-view-token-amount]')
      .containsText('250.00 DAI');
    assert.dom('[data-test-face-value-display]').doesNotExist();
    assert.dom('[data-test-face-value-option]').exists({ count: 4 });
    assert.dom('[data-test-face-value-option-checked]').doesNotExist();
    assert.dom('[data-test-face-value-option="50000"] input').isDisabled();
    assert.dom('[data-test-face-value-option="100000"] input').isDisabled();
    assert
      .dom('[data-test-face-value-option="50000"]')
      .containsText('50000 SPEND');
    assert.dom('[data-test-face-value-option="50000"]').containsText('500 USD');
    assert
      .dom('[data-test-face-value-option="50000"]')
      .containsText('≈ 500 DAI.CPXD');
    assert.dom('[data-test-face-value-option="10000"] input').isNotDisabled();
    assert.dom('[data-test-face-value-option="5000"] input').isNotDisabled();
    await click('[data-test-face-value-option="5000"]');
    assert.dom('[data-test-face-value-option="5000"] input').isChecked();
    assert.dom('[data-test-face-value-option-checked]').exists({ count: 1 });
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom('[data-test-face-value-option]').doesNotExist();
    assert.dom('[data-test-face-value-display]').containsText('5000 SPEND');
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    await click('[data-test-face-value-option="10000"]');
    assert.dom('[data-test-face-value-option="10000"] input').isChecked();
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom('[data-test-face-value-display]').containsText('10000 SPEND');
    assert.dom('[data-test-face-value-display]').containsText('100 USD');
    assert.dom('[data-test-face-value-display]').containsText('≈ 100 DAI.CPXD');

    await waitFor(milestoneCompletedSel(2));
    assert.dom(milestoneCompletedSel(2)).containsText('Face value chosen');

    assert
      .dom(postableSel(3, 0))
      .containsText('This is what your prepaid card will look like.');

    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-issuer-name]`)
      .containsText('JJ');
    assert
      .dom(
        `${postableSel(
          3,
          1
        )} [data-test-prepaid-card-issuer-name-labeled-value]`
      )
      .containsText('JJ');
    assert
      .dom(
        `${postableSel(3, 1)} [data-test-prepaid-card-face-value-labeled-value]`
      )
      .containsText('10000 SPEND')
      .containsText('100 USD');

    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-balance]`)
      .containsText('10000');
    assert
      .dom(`${postableSel(3, 1)} [data-test-prepaid-card-usd-balance]`)
      .containsText('100');

    assert.dom(
      `${postableSel(
        3,
        1
      )} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
    );

    let prepaidCardCustomizationId = '75218c05-3899-46d6-b431-e7237ba293ca';
    let did = encodeDID({
      type: 'PrepaidCardCustomization',
      uniqueId: prepaidCardCustomizationId,
      version: 1,
    });
    // simulate POST /api/prepaid-card-customizations to persist customizations and return DID
    this.server.post('/prepaid-card-customizations', (_schema, request) => {
      assert.equal(
        request.requestHeaders['authorization'],
        'Bearer: abc123--def456--ghi789'
      );
      let requestJson = JSON.parse(request.requestBody);
      assert.equal(requestJson.data.attributes['issuer-name'], 'JJ');
      assert.equal(
        requestJson.data.relationships.pattern.data.id,
        '80cb8f99-c5f7-419e-9c95-2e87a9d8db32'
      );
      assert.equal(
        requestJson.data.relationships['color-scheme'].data.id,
        '4f219852-33ee-4e4c-81f7-76318630a423'
      );

      return new MirageResponse(
        201,
        {
          'Content-Type': 'application/vnd.api+json',
        },
        JSON.stringify({
          data: {
            type: 'prepaid-card-customizations',
            id: prepaidCardCustomizationId,
            attributes: {
              did,
              'issuer-name': 'JJ',
              'owner-address': layer2AccountAddress,
            },
            relationships: {
              pattern: {
                data: {
                  type: 'prepaid-card-patterns',
                  id: '80cb8f99-c5f7-419e-9c95-2e87a9d8db32',
                },
              },
              'color-scheme': {
                data: {
                  type: 'prepaid-card-color-schemes',
                  id: '"4f219852-33ee-4e4c-81f7-76318630a423"',
                },
              },
            },
          },
        })
      );
    });

    // // preview card
    await click(
      `${postableSel(
        3,
        1
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert
      .dom('[data-test-boxel-action-chin-action-status-area]')
      .containsText(
        'You will receive a confirmation request from the Card Wallet app in a few moments…'
      );

    await layer2Service.test__simulateHubAuthentication(
      'abc123--def456--ghi789'
    );

    await timeout(250);
    layer2Service.test__simulateIssuePrepaidCardForAmount(
      10000,
      '0xaeFbA62A2B3e90FD131209CC94480E722704E1F8'
    );

    await waitFor(milestoneCompletedSel(3));
    assert.dom(milestoneCompletedSel(3)).containsText('Transaction confirmed');

    assert
      .dom(`${postableSel(3, 1)} [data-test-boxel-action-chin]`)
      .containsText('Confirmed');

    assert
      .dom(
        `${postableSel(3, 1)} [data-test-prepaid-card-address-labeled-value]`
      )
      .containsText('0xaeFb...E1F8 on xDai chain');

    assert
      .dom(epiloguePostableSel(0))
      .containsText('Congratulations, you have created a prepaid card!');

    await waitFor(epiloguePostableSel(1));

    assert.dom(epiloguePostableSel(1)).containsText('Prepaid card issued');
    assert
      .dom(`${epiloguePostableSel(1)} [data-test-prepaid-card-issuer-name]`)
      .containsText('JJ');
    assert.dom(
      `${epiloguePostableSel(
        1
      )} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-pattern="${patternChoice}"]`
    );

    layer2Service.test__simulateBalances({
      defaultToken: toBN('150000000000000000000'),
      card: toBN('500000000000000000000'),
    });

    await waitFor(epiloguePostableSel(2));

    assert
      .dom(epiloguePostableSel(2))
      .containsText('This is the remaining balance in your xDai chain wallet');

    await waitFor(epiloguePostableSel(3));

    assert
      .dom(`${epiloguePostableSel(3)} [data-test-balance="DAI.CPXD"]`)
      .containsText('150.0');

    await waitFor(epiloguePostableSel(4));

    assert
      .dom(
        `${epiloguePostableSel(
          4
        )} [data-test-issue-prepaid-card-next-step="dashboard"]`
      )
      .exists();
    await click(
      `${epiloguePostableSel(
        4
      )} [data-test-issue-prepaid-card-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  // test('Initiating workflow with layer 2 wallet already connected', async function (assert) {
  // });

  // test('Disconnecting Layer 2 after proceeding beyond it', async function (assert) {
  // });
});
