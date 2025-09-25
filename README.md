## What?

This project helps to upgrade deprecated Ready accounts (see the [Supported account versions table](#supported-account-versions-and-upgrade-methods)) to a version that can be used in the extension.
NOTE: this only works on mainnet, V0 transactions have been disabled on the other networks

## How?

Install bun <https://bun.sh/docs/installation>

Run

```bash
yarn install
```

Create a file name `.env` following the example in `.env.example`. Make sure you fill ADDRESS with the address of the account to upgrade, and PRIVATE_KEY with the private key controling that account.

Otherwise you can run the user-input.sh script with the following command:

```bash
source scripts/user-input.sh
```

Then run

```bash
bun run upgrade
```

It will output a transaction hash. You can go to your block explorer to see if the transaction succeeds

## How Account Upgrades Work

This application helps upgrade old Ready account contracts to the latest version (v0.4.0). The upgrade process varies depending on the account version and proxy type.

### Supported Account Versions and Upgrade Methods

| Version  | Old Proxy                                             | New Proxy                                         | No Proxy                                       |
| -------- | ----------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| v0.2.0   | v0.2.3.1 via meta-tx-v0 (uses implementation address) | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.1   | v0.2.3.1 via meta-tx-v0 (uses implementation address) | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.2   | Not supported (1)                                     | v0.2.3.1 via meta-tx-v0 (uses class hash)         | Not supported                                  |
| v0.2.3.0 | v0.4.0 via direct transaction\* (uses class hash)     | v0.4.0 via direct transaction\* (uses class hash) | Not supported                                  |
| v0.2.3.1 | v0.4.0 via direct transaction\* (uses class hash)     | v0.4.0 via direct transaction\* (uses class hash) | Not supported                                  |
| v0.3.0   | Not supported (2)                                     | v0.4.0 via outside execution (uses class hash)    | v0.4.0 via outside execution (uses class hash) |
| v0.3.1   | Not supported (2)                                     | v0.4.0 via outside execution (uses class hash)    | v0.4.0 via outside execution (uses class hash) |

_\*: Upgrade from v2.3.x to v4.0.0 always contain data `[0x0]` to make sure that the proxy (old or new) is removed_

> (1): Old proxy is not compatible with account versions that do library calls.
> (2): With the existing contracts it is not possible to have a v0.3.x account with an old proxy.

### Upgrade Process

1. **Account Detection**: The application detects the current account version and proxy type by checking the class hash
2. **Verification**: Verifies that the provided private key matches the account owner and that no guardian is set
3. **Upgrade Execution**: Depending on the version and proxy type:
   - **Direct transactions**: For v0.2.3.x accounts, executes upgrade directly
   - **V0 Meta-transactions**: For v0.2.x accounts, uses a meta transaction contract to execute v0 transaction to upgrade
   - **Outside execution**: For v0.3.x accounts, uses outside execution calls that require manual execution

### Requirements

- Account must not have a guardian set
- Private key must match the account owner
- Sufficient STRK balance for transaction fees (where applicable)
