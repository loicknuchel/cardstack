import {
  getConstantByNetwork,
  getSDK,
  isSchedulerSupportedChain,
  convertChainIdToName,
} from '@cardstack/cardpay-sdk';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import { ChainConnectionManager } from '@cardstack/safe-tools-client/utils/chain-connection-manager';
import walletProviders, {
  WalletProviderId,
} from '@cardstack/safe-tools-client/utils/wallet-providers';

import { action } from '@ember/object';
import type { default as Owner } from '@ember/owner';
import Service, { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { timeout } from 'ember-concurrency';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import Web3 from 'web3';

export default class Wallet extends Service {
  @service declare network: NetworkService;

  @tracked isConnected = false;
  @tracked providerId: WalletProviderId | undefined;
  @tracked address: string | undefined;
  @tracked isConnecting = false;

  @tracked nativeTokenBalance: Record<'symbol' | 'amount', string> | undefined;
  @tracked safes = [];

  // TODO: replace with ethers
  web3 = new Web3();
  chainConnectionManager: ChainConnectionManager;

  walletProviders = walletProviders.map((w) =>
    w.id === 'metamask'
      ? {
          ...w,
          enabled: !!window.ethereum?.isMetaMask,
          explanation: window.ethereum?.isMetaMask
            ? ''
            : 'MetaMask extension not detected',
        }
      : { ...w, enabled: true, explanation: '' }
  );

  constructor(owner: Owner) {
    super(owner);

    this.chainConnectionManager = new ChainConnectionManager(
      this.network.symbol,
      this.network.chainId,
      owner
    );
    this.chainConnectionManager.on('connected', (accounts: string[]) => {
      this.isConnected = true;
      this.address = Web3.utils.toChecksumAddress(accounts[0]);
    });

    this.chainConnectionManager.on('disconnected', () => {
      this.isConnected = false;
    });

    this.chainConnectionManager.on('chain-changed', (chainId: number) => {
      if (!isSchedulerSupportedChain(chainId)) {
        // TODO: improve unsupported net handling
        alert('Unsupported network! Choose a supported one and reconnect');
        this.disconnect();
        return;
      }
      this.network.onChainChanged(chainId);
    });

    const providerId = this.chainConnectionManager.getProviderIdForChain(
      this.network.chainId
    );
    if (providerId !== 'wallet-connect' && providerId !== 'metamask') {
      return;
    }

    this.providerId = providerId;
    this.chainConnectionManager.reconnect(this.web3, this.providerId);
  }

  async switchNetwork(chainId: number) {
    if (this.providerId !== 'metamask') {
      return;
    }

    if (!window.ethereum) {
      return;
    }

    const chainIdHex = `0x${chainId.toString(16)}`;

    try {
      //@ts-expect-error currentProvider does not match Web3Provider Property 'request' does not exist on type 'EthereumProvider'
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
    } catch (error) {
      if (error.code === 4902) {
        // Network not added in Metamask. We prompt the user to add it.

        const networkName = convertChainIdToName(chainId);

        try {
          //@ts-expect-error currentProvider does not match Web3Provider Property 'request' does not exist on type 'EthereumProvider'
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: getConstantByNetwork('name', networkName),
                nativeCurrency: {
                  name: getConstantByNetwork('nativeTokenName', networkName),
                  symbol: getConstantByNetwork(
                    'nativeTokenSymbol',
                    networkName
                  ),
                  decimals: getConstantByNetwork(
                    'nativeTokenDecimals',
                    networkName
                  ),
                },
                blockExplorerUrls: [
                  getConstantByNetwork('blockExplorer', networkName),
                ],
                rpcUrls: getConstantByNetwork('publicRpcUrls', networkName),
              },
            ],
          });
        } catch (error) {
          const message = `Unable to add selected network to Metamask. Please try again or contact support. As an alternative, you can add it to your Metamask wallet manually, and reload the page. Follow the instructions at https://metamask.zendesk.com/hc/en-us/articles/360043227612-How-to-add-a-custom-network-RP`;
          alert(message);
          throw error;
        }
      }
    }
  }

  @action connect(providerId: WalletProviderId, onConnectSuccess: () => void) {
    this.providerId = providerId;

    if (!this.isConnected) {
      this.isConnecting = true;
      taskFor(this.connectWalletTask)
        .perform()
        .then(() => {
          if (this.isConnected) {
            onConnectSuccess();
          }
        })
        .catch((e) => {
          console.log(e);
        });
    }
  }

  @task *connectWalletTask() {
    if (!this.providerId) {
      return;
    }

    yield this.chainConnectionManager.connect(this.web3, this.providerId);
    yield timeout(500); // allow time for strategy to verify connected chain -- it might not accept the connection

    this.isConnecting = false;
  }

  @action cancelConnection() {
    this.isConnecting = false;
  }

  @action disconnect() {
    this.chainConnectionManager.disconnect();
  }

  @action async fetchNativeTokenBalance() {
    const assets = await getSDK('Assets', this.web3);
    const balance = await assets.getNativeTokenBalance(this.address);
    this.nativeTokenBalance = {
      symbol: getConstantByNetwork('nativeTokenSymbol', this.network.symbol),
      amount: balance || '0',
    };

    return this.nativeTokenBalance;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    wallet: Wallet;
  }
}
