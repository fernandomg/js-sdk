/**
 * @jest-environment jsdom
 */

// Login: monerium-test-sdk@maildrop.cc
// Password: Passw0rd!

// punkWallet: https://punkwallet.io/pk#0x30fa9f64fb85dab6b4bf045443e08315d6570d4eabce7c1363acda96042a6e1a

import 'jest-localstorage-mock';
import { MoneriumClient } from '../src/index';
import {
  LINK_MESSAGE,
  STORAGE_CODE_VERIFIER,
  STORAGE_REFRESH_TOKEN,
} from '../src/constants';
import { Currency, Order, PaymentStandard } from '../src/types';

import {
  APP_ONE_AUTH_FLOW_CLIENT_ID,
  APP_ONE_CREDENTIALS_CLIENT_ID,
  APP_ONE_CREDENTIALS_SECRET,
  APP_ONE_OWNER_USER_ID,
  APP_ONE_REDIRECT_URL,
  DEFAULT_PROFILE,
  OWNER_SIGNATURE,
  PUBLIC_KEY,
} from './constants';
import { getChain, getNetwork } from '../src/utils';
import { generateCodeChallenge } from '../src/helpers';

const message = 'I hereby declare that I am the address owner.';
describe('MoneriumClient', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });
  test('client initialization', () => {
    const client = new MoneriumClient();

    expect(client).toBeInstanceOf(MoneriumClient);
  });

  test(`verify link message`, () => {
    expect(LINK_MESSAGE).toBe(message);
  });

  test('sandbox environment', () => {
    const client = new MoneriumClient('sandbox');
    const defaultClient = new MoneriumClient();
    const url = client.getAuthFlowURI({
      client_id: '',
      redirect_uri: '',
    });
    const defaultUrl = defaultClient.getAuthFlowURI({
      client_id: '',
      redirect_uri: '',
    });
    expect(defaultUrl).toContain('https://api.monerium.dev');
    expect(url).toContain('https://api.monerium.dev');
  });

  test('production environment', () => {
    const client = new MoneriumClient('production');

    const url = client.getAuthFlowURI({
      client_id: '',
      redirect_uri: '',
    });
    expect(url).toContain('https://api.monerium.app');
  });

  test('class instance with auth flow auth', async () => {
    const client = new MoneriumClient({
      clientId: 'testClientId',
      redirectUrl: 'http://example.com',
    });

    const replaceMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: {
        replace: replaceMock,
      },
      writable: true,
    });

    await client.authorize();

    const codeVerifier = window.sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(replaceMock).toHaveBeenCalledWith(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`
    );
    replaceMock.mockRestore();
  });

  // This is no longer valid, we were calling connect on the constructor, but there was no way to wait for the promise to resolve
  // test('class instance with refresh_token', async () => {
  //   const connectMock = jest
  //     .spyOn(MoneriumClient.prototype, 'connect')
  //     .mockImplementation();
  //   const client = new MoneriumClient({
  //     env: 'production',
  //     clientId: 'testClientId',
  //     clientSecret: 'testSecret',
  //   });

  //   expect(connectMock).toHaveBeenCalled();
  //   expect(client.getEnvironment()).toEqual({
  //     api: 'https://api.monerium.app',
  //     web: 'https://monerium.app',
  //     wss: 'wss://api.monerium.app',
  //   });
  //   connectMock.mockRestore();
  // });

  test('authenticate with client credentials', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const authContext = await client.getAuthContext();

    expect(authContext.userId).toBe(APP_ONE_OWNER_USER_ID);
  });

  test('authorization code flow with chainId', async () => {
    const client = new MoneriumClient();

    const authFlowUrl = client.getAuthFlowURI({
      redirect_uri: 'http://example.com',
      client_id: 'testClientId',
      address: '0x',
      chainId: 5,
    });
    const codeVerifier = window.sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(authFlowUrl).toBe(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code&address=0x&chain=ethereum&network=goerli`
    );
  });

  test('authorization code flow with chain and network', async () => {
    const client = new MoneriumClient();

    const authFlowUrl = client.getAuthFlowURI({
      redirect_uri: 'http://example.com',
      client_id: 'testClientId',
      address: '0x',
      chain: 'ethereum',
      network: 'goerli',
    });

    const codeVerifier = window.sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(authFlowUrl).toBe(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code&address=0x&chain=ethereum&network=goerli`
    );
  });

  test('authorization code flow without chain info', async () => {
    const client = new MoneriumClient();

    const test = client.getAuthFlowURI({
      redirect_uri: 'http://example.com',
      client_id: 'testClientId',
    });

    const codeVerifier = window.sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(test).toBe(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`
    );
  });

  test('link address', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const authContext = await client.getAuthContext();

    const res = await client.linkAddress(authContext.defaultProfile, {
      address: PUBLIC_KEY,
      message: message,
      signature: OWNER_SIGNATURE,
      accounts: [
        {
          network: 'goerli',
          chain: 'ethereum',
          currency: Currency.eur,
        },
        {
          network: 'chiado',
          chain: 'gnosis',
          currency: Currency.eur,
        },
        {
          network: 'mumbai',
          chain: 'polygon',
          currency: Currency.eur,
        },
      ],
    });

    expect(res).toMatchObject({
      address: '0xBd78A5C7efBf7f84C75ef638689A006512E1A6c4',
      id: 'ebec4eed-6dcb-11ee-8aa6-5273f65ed05b',
      message: 'I hereby declare that I am the address owner.',
      meta: {
        linkedBy: '9fdfd981-6dca-11ee-8aa6-5273f65ed05b',
      },
      profile: '9fdfd8f1-6dca-11ee-8aa6-5273f65ed05b',
    });
  });

  test('get profile', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const authContext = await client.getAuthContext();
    const profile = await client.getProfile(authContext.profiles[0].id);

    expect(profile.accounts[0].id).toBe('ebed25b6-6dcb-11ee-8aa6-5273f65ed05b');
  });

  test('get balances', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const balances = await client.getBalances();

    expect(balances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          // id: '4b208818-44e3-11ed-adac-b2efc0e6677d',
          chain: 'ethereum',
          network: 'goerli',
          address: PUBLIC_KEY,
        }),
      ])
    );
  }, 15000);

  test('get orders', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const orders = await client.getOrders();
    const order = orders.find(
      (o: Order) => o.memo === 'Powered by Monerium'
    ) as Order;

    expect(order.kind).toBe('redeem');
    expect(order.amount).toBe('1');
    expect(order.memo).toBe('Powered by Monerium');
  });

  test('get orders by profileId', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const orders = await client.getOrders({
      profile: DEFAULT_PROFILE,
    });

    orders.map((o: Order) => {
      expect(DEFAULT_PROFILE).toBe(o.profile);
    });
  });

  test('get order', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const order = await client.getOrder('2dc957ed-6dcc-11ee-85f9-fae826042a04');

    expect(order.kind).toBe('redeem');
    expect(order.amount).toBe('1');
    expect(order.memo).toBe('Powered by Monerium');
  });

  test('get tokens', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const tokens = await client.getTokens();

    const expected = [
      {
        address: '0x83B844180f66Bbc3BE2E97C6179035AF91c4Cce8',
        chain: 'ethereum',
        currency: 'eur',
        decimals: 18,
        network: 'goerli',
        symbol: 'EURe',
        ticker: 'EUR',
      },
    ];
    expect(tokens).toEqual(expect.arrayContaining(expected));
  });

  test('redirect', async () => {
    const client = new MoneriumClient();

    const replaceMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: {
        replace: replaceMock,
      },
      writable: true,
    });

    await client.authorize({
      redirectUrl: 'http://example.com',
      clientId: 'testClientId',
    });

    const codeVerifier = sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(replaceMock).toHaveBeenCalledWith(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`
    );
    replaceMock.mockRestore();
  });
  test('redirect w auto-link', async () => {
    const client = new MoneriumClient();

    const replaceMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: {
        replace: replaceMock,
      },
      writable: true,
    });

    await client.authorize({
      redirectUrl: 'http://example.com',
      clientId: 'testClientId',
      address: '0x1234',
      signature: '0x5678',
      chainId: 137,
    });

    const codeVerifier = sessionStorage.getItem(STORAGE_CODE_VERIFIER);
    const challenge = generateCodeChallenge(codeVerifier as string);

    expect(replaceMock).toHaveBeenCalledWith(
      `https://api.monerium.dev/auth?client_id=testClientId&redirect_uri=http%3A%2F%2Fexample.com&code_challenge=${challenge}&code_challenge_method=S256&response_type=code&address=0x1234&signature=0x5678&chain=polygon&network=mainnet`
    );
    replaceMock.mockRestore();
  });

  test('authorize with refresh token attempt', async () => {
    const client = new MoneriumClient();
    sessionStorage.setItem(STORAGE_REFRESH_TOKEN, 'testRefreshToken');

    const getItemSpy = jest.spyOn(window.sessionStorage, 'getItem');

    try {
      await client.getAccess({
        clientId: APP_ONE_AUTH_FLOW_CLIENT_ID,
        redirectUrl: APP_ONE_REDIRECT_URL,
      });
    } catch (err) {
      expect((err as any).message).toBe('Unable to load refresh token info');
    }

    expect(getItemSpy).toHaveBeenCalledWith(STORAGE_REFRESH_TOKEN);

    getItemSpy.mockRestore();
  });

  // there is no way to test this without a real time signature, the date is now verified
  test('place order signature error', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const date = new Date().toISOString();
    const placeOrderMessage = `Send EUR 10 to GR1601101250000000012300695 at ${date}`;
    const placeOrderSignatureHash =
      '0x23bf7e1b240d238b13cb293673c3419915402bb34435af62850b1d8e63f82c564fb73ab19691cf248594423dd01e441bb2ccb38ce2e2ecc514dfc3075bea829e1c';

    await client
      .placeOrder({
        amount: '10',
        signature: placeOrderSignatureHash,
        address: PUBLIC_KEY,
        counterpart: {
          identifier: {
            standard: PaymentStandard.iban,
            iban: 'GR1601101250000000012300695',
          },
          details: {
            firstName: 'Mockbank',
            lastName: 'Testerson',
          },
        },
        message: placeOrderMessage,
        memo: 'Powered by Monerium SDK',
        chain: 'ethereum',
        network: 'goerli',
      })
      .catch((err) => {
        expect(err.message).toBe('Invalid signature');
      });
  });

  test('place order timestamp error', async () => {
    const client = new MoneriumClient();

    await client.auth({
      client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
      client_secret: APP_ONE_CREDENTIALS_SECRET,
    });

    const date = 'Thu, 29 Dec 2022 14:58 +00:00';
    const placeOrderMessage = `Send EUR 10 to GR1601101250000000012300695 at ${date}`;
    const placeOrderSignatureHash =
      '0x23bf7e1b240d238b13cb293673c3419915402bb34435af62850b1d8e63f82c564fb73ab19691cf248594423dd01e441bb2ccb38ce2e2ecc514dfc3075bea829e1c';

    await client
      .placeOrder({
        amount: '10',
        signature: placeOrderSignatureHash,
        address: PUBLIC_KEY,
        counterpart: {
          identifier: {
            standard: PaymentStandard.iban,
            iban: 'GR1601101250000000012300695',
          },
          details: {
            firstName: 'Mockbank',
            lastName: 'Testerson',
          },
        },
        message: placeOrderMessage,
        memo: 'Powered by Monerium SDK',
        chain: 'ethereum',
        network: 'goerli',
      })
      .catch((err) => {
        expect(err.message).toBe('Timestamp is expired');
      });
  });

  test('get chain and network from chainId', () => {
    expect(getChain(1)).toBe('ethereum');
    expect(getChain(137)).toBe('polygon');
    expect(getChain(80001)).toBe('polygon');
    expect(getNetwork(1)).toBe('mainnet');
    expect(getNetwork(137)).toBe('mainnet');
    expect(getNetwork(10200)).toBe('chiado');
  });
});

// test("upload supporting document", async () => {
//   const client = new MoneriumClient();

//   await client.auth({
//     client_id: APP_ONE_CREDENTIALS_CLIENT_ID,
//     client_secret: APP_ONE_CREDENTIALS_SECRET,
//   });

//   // const document = client.uploadSupportingDocument();
//   // assertObjectMatch(document, {});
// });
describe('disconnect()', () => {
  it('should remove the codeVerifier from the storage', async () => {
    const sessionStorageSpy = jest.spyOn(window.sessionStorage, 'removeItem');
    const client = new MoneriumClient();

    await client.disconnect();

    expect(sessionStorageSpy).toHaveBeenCalledWith(STORAGE_CODE_VERIFIER);
  });
});
