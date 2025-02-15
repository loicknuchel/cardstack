import Component from '@glimmer/component';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import tokenToUsd from '@cardstack/safe-tools-client/helpers/token-to-usd';
import PaymentOptionsDropdown from '@cardstack/safe-tools-client/components/payment-options-dropdown';
import TruncatedBlockchainAddress from '@cardstack/safe-tools-client/components/truncated-blockchain-address';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import BlockExplorerButton from '@cardstack/safe-tools-client/components/block-explorer-button';
import Tooltip from '@cardstack/safe-tools-client/components/tooltip';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import { inject as service } from '@ember/service';
import not from 'ember-truth-helpers/helpers/not';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    scheduledPayment: ScheduledPayment;
  }
}

export default class ScheduledPaymentCard extends Component<Signature> {
  @service declare network: NetworkService;

  get paymentType() {
    return this.args.scheduledPayment.recurringDayOfMonth && this.args.scheduledPayment.recurringUntil ? 'Recurring' : 'One-time';
  }

  get onChainCreationPending() {
    let { creationTransactionHash, creationBlockNumber } = this.args.scheduledPayment;
    return creationTransactionHash && !creationBlockNumber && !this.hasOnChainCreationError
  }

  get hasOnChainCreationError() {
    return !!this.args.scheduledPayment.creationTransactionError;
  }

  <template>
    <BoxelCardContainer
      @displayBoundaries={{true}}
      class="scheduled-payment-card">
      <div class="scheduled-payment-card__content" data-test-scheduled-payment-card data-test-scheduled-payment-card-id={{@scheduledPayment.id}}>
        <span class="scheduled-payment-card__pay-at">{{this.paymentType}} on {{formatDate @scheduledPayment.payAt "d/M/yyyy (h:mm a)"}}</span>
        <div class="scheduled-payment-card__payee">
          <span class="scheduled-payment-card__payee-to">To:</span>
          <TruncatedBlockchainAddress @address={{@scheduledPayment.payeeAddress}} @isCopyable={{true}} @copyIconColor='var(--boxel-purple-400)'/>
        </div>
        <div class="scheduled-payment-card__memo" title={{@scheduledPayment.privateMemo}}>
          {{@scheduledPayment.privateMemo}}
        </div>
        <div class="scheduled-payment-card__payment-detail">
          <img class="scheduled-payment-card__token-symbol" src={{@scheduledPayment.paymentTokenQuantity.token.logoURI}} />
          <div class="scheduled-payment-card__token-amounts">
            <span class="scheduled-payment-card__token-amount">{{@scheduledPayment.paymentTokenQuantity.displayable}}</span>
            <span class="scheduled-payment-card__usd-amount">{{tokenToUsd tokenQuantity=@scheduledPayment.paymentTokenQuantity }}</span>
          </div>
          <div class="scheduled-payment-card__status">
            {{#if this.onChainCreationPending}}
              <Tooltip>
                <:trigger>
                  {{svgJar "pending-icon" width="16px" height="16px"}}
                </:trigger>
                <:content>
                  <div class="scheduled_payment_card__tooltip">
                    <p>
                      The transaction to register this payment on blockchain is still pending. The payment will not be attempted until the transaction is confirmed.
                    </p>

                    <p>
                      For more details on the transaction status to register the scheduled payment, please check the transaction in the blockchain explorer.
                    </p>

                    <BlockExplorerButton
                      @networkSymbol={{this.network.symbol}}
                      @transactionHash={{this.args.scheduledPayment.creationTransactionHash}}
                    />
                  </div>
                </:content>
              </Tooltip>
            {{else if this.hasOnChainCreationError}}
              <Tooltip>
                <:trigger>
                  {{svgJar "exclamation-warning" width="16px" height="16px"}}
                </:trigger>
                <:content>
                  <div class="scheduled_payment_card__tooltip">
                    <p>
                      The transaction to register this payment on blockchain has failed. This payment will not be attempted.
                    </p>
                    <p>
                      Please delete the schedule payment and try to schedule it again.
                    </p>

                    <p>
                      For more details on why the on-chain registration failed, please check the transaction in the blockchain explorer.
                    </p>

                    <BlockExplorerButton
                      @networkSymbol={{this.network.symbol}}
                      @transactionHash={{this.args.scheduledPayment.creationTransactionHash}}
                    />
                  </div>
                </:content>
              </Tooltip>
            {{/if}}
          </div>
        </div>
      </div>
      <PaymentOptionsDropdown
        @scheduledPayment={{@scheduledPayment}}
        @canCancel={{not this.onChainCreationPending}}
      />
    </BoxelCardContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'ScheduledPaymentCard': typeof ScheduledPaymentCard;
  }
}
